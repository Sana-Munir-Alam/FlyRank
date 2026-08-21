require("dotenv").config();
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { EnrichInputSchema, EnrichOutputSchema } = require("../llm/enrichSchema");
const { llmClient, LLM_MODEL } = require("../llm/client");

const SYSTEM_PROMPT = fs.readFileSync( path.join(__dirname, "../../prompts/enrich-v1.md"), "utf8" );

router.post("/enrich", async (req, res) => {
    try {
        const result = EnrichInputSchema.safeParse(req.body);   // Validate the input against the EnrichInputSchema
        if (!result.success) {
            const issue = result.error.issues[0];
            return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
        }
        const validatedInput = result.data;
        
        if (process.env.LLM_STUB === "1") {                     // If LLM_STUB is set to "1", return a stub response for  testing
            const stub = {
                category: "other",
                summary: "Stub response for local testing.",
                quality_flags: [],
            };
            return res.status(200).json(EnrichOutputSchema.parse(stub)); // Validate the stub response against the Schema
        }

        // Call the LLM API with the validated input
        const completion = await llmClient.chat.completions.create({
        model: LLM_MODEL,
        temperature: 0.2,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(validatedInput) },
        ],
        });

        const raw = completion.choices[0].message.content;
        return res.status(200).json({ raw });

    } catch (error) {
        console.error("Enrichment error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;