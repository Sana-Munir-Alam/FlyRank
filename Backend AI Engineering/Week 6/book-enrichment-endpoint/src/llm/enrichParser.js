const fs = require("fs");
const path = require("path");
const { EnrichOutputSchema } = require("./enrichSchema");
const { llmClient, LLM_MODEL } = require("./client");

const PROMPT_VERSION = "enrich-v1";
const SYSTEM_PROMPT = fs.readFileSync( path.join(__dirname, "../../prompts/enrich-v1.md"), "utf8" );
const QUARANTINE_PATH = path.join(__dirname, "../../logs/quarantine.jsonl");
const LLM_CALLS_PATH = path.join(__dirname, "../../logs/llm-calls.jsonl");

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function isRetryable(err) {
  if (err.status && RETRYABLE_STATUS.has(err.status)) return true;
  if (err.name === "APIConnectionTimeoutError") return true;
  return false; // 400/401/403 fall through here never retried
}

function getRetryAfterMs(err) {
  const header = err.headers?.get?.("retry-after");
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

function extractJson(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(stripped);
  // For Execution of 422 test error block uncomment the line below and comment the lines above
  // throw new Error("TEMPORARY TEST: forcing parse failure");
  
}

function logQuarantine(entry) {
  fs.mkdirSync(path.dirname(QUARANTINE_PATH), { recursive: true });
  fs.appendFileSync(QUARANTINE_PATH, JSON.stringify(entry) + "\n");
}

function logCall(entry) {
  const line = JSON.stringify(entry);
  console.log(line);
  fs.mkdirSync(path.dirname(LLM_CALLS_PATH), { recursive: true });
  fs.appendFileSync(LLM_CALLS_PATH, line + "\n");
}

async function callModel(messages, { repairNeeded = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const completion = await llmClient.chat.completions.create({
        model: LLM_MODEL, temperature: 0.2, messages,
      });
      logCall({
        event: "llm_call", promptVersion: PROMPT_VERSION, model: LLM_MODEL,
        inputTokens: completion.usage?.prompt_tokens ?? null,
        outputTokens: completion.usage?.completion_tokens ?? null,
        durationMs: Date.now() - startedAt, repairNeeded, attempt,
      });
      return completion.choices[0].message.content;
    } catch (err) {
      lastError = err;
      const retryable = isRetryable(err);
      logCall({
        event: "llm_call_failed", promptVersion: PROMPT_VERSION, model: LLM_MODEL,
        durationMs: Date.now() - startedAt,
        attempt, status: err.status ?? null, retryable, repairNeeded,
      });
      if (!retryable || attempt === MAX_ATTEMPTS) throw err;
      const backoff = getRetryAfterMs(err) ?? (BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 250);
      await sleep(backoff);
    }
  }
  throw lastError;
}

async function enrich(input) {
  const baseMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(input) },
  ];

  const firstRaw = await callModel(baseMessages, {repairNeeded: false});
  const firstAttempt = tryParseAndValidate(firstRaw);
  if (firstAttempt.ok) return firstAttempt;

  // repair — exactly one retry, per the spec
  const repairMessages = [
    ...baseMessages,
    { role: "assistant", content: firstRaw },
    { role: "user", content: `Your previous answer was rejected for this reason: ${firstAttempt.error}. Return only corrected JSON matching the schema.` },
  ];
  const secondRaw = await callModel(repairMessages, { repairNeeded: true });
  const secondAttempt = tryParseAndValidate(secondRaw);
  if (secondAttempt.ok) return secondAttempt;

  logQuarantine({
    timestamp: new Date().toISOString(),
    input,
    promptVersion: PROMPT_VERSION,
    rawOutput: secondRaw,
    error: secondAttempt.error,
  });
  return { ok: false };
}

function tryParseAndValidate(raw) {
  try {
    const parsed = extractJson(raw);
    const result = EnrichOutputSchema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, error: JSON.stringify(result.error.issues) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { enrich };