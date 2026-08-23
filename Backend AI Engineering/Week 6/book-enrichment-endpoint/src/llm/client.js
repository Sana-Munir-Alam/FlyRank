const OpenAI = require("openai");
require("dotenv").config();

if (!process.env.LLM_API_KEY) {
  throw new Error("LLM_API_KEY is not set — check your .env");
}

const llmClient = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL,
  timeout: 30000,   // 30 sec
  maxRetries: 0,
});

const LLM_MODEL = process.env.LLM_MODEL || "gemini-3.6-flash";

module.exports = { llmClient, LLM_MODEL };