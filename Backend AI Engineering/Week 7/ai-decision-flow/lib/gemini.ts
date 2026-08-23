import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const VALID_DECISIONS = ["YES", "NO"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

export async function getDecision(prompt: string): Promise<Decision> {
  if (!prompt || !prompt.trim()) {
    // Fail loud and early a silent "NO" on an empty prompt would look like a real decision instead of a data problem.
    throw new Error("Node has an empty prompt cannot ask the model anything.");
  }

  const response = await openai.chat.completions.create({
    model: "gemini-3.6-flash",
    messages: [
      {
        role: "system",
        content: "You are a strict binary classifier. Respond with exactly one word: YES or NO. No punctuation, no explanation, nothing else.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const cleaned = raw.trim().toUpperCase();

  if (!VALID_DECISIONS.includes(cleaned as Decision)) {
    throw new Error(`Model returned an unparseable decision: "${raw}"`);
  }

  return cleaned as Decision;
}