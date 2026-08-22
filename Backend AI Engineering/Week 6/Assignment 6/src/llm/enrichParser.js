const fs = require("fs");
const path = require("path");
const { EnrichOutputSchema } = require("./enrichSchema");
const { llmClient, LLM_MODEL } = require("./client");

const PROMPT_VERSION = "enrich-v1";
const SYSTEM_PROMPT = fs.readFileSync( path.join(__dirname, "../../prompts/enrich-v1.md"), "utf8" );
const QUARANTINE_PATH = path.join(__dirname, "../../logs/quarantine.jsonl");

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

async function callModel(messages) {
  const completion = await llmClient.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0.2,
    messages,
  });
  return completion.choices[0].message.content;
}

async function enrich(input) {
  const baseMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(input) },
  ];

  const firstRaw = await callModel(baseMessages);
  const firstAttempt = tryParseAndValidate(firstRaw);
  if (firstAttempt.ok) return firstAttempt;

  // repair — exactly one retry, per the spec
  const repairMessages = [
    ...baseMessages,
    { role: "assistant", content: firstRaw },
    { role: "user", content: `Your previous answer was rejected for this reason: ${firstAttempt.error}. Return only corrected JSON matching the schema.` },
  ];
  const secondRaw = await callModel(repairMessages);
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