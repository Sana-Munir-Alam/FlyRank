require("dotenv").config();
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { EnrichInputSchema, EnrichOutputSchema } = require("../llm/enrichSchema");
const { enrich } = require("../llm/enrichParser");

router.post("/enrich", async (req, res) => {
    try {
        const result = EnrichInputSchema.safeParse(req.body);   // Validate the input against the EnrichInputSchema
        if (!result.success) {
            const issue = result.error.issues[0];
            return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
        }
        const validatedInput = result.data;

        // Check if LLM feature is enabled
        if (process.env.LLM_ENABLED === "false") {
            return res.status(503).json({ error: "LLM feature is temporarily disabled." });
        }
        
        if (process.env.LLM_STUB === "1") {                     // If LLM_STUB is set to "1", return a stub response for  testing
            const stub = {
                category: "other",
                summary: "Stub response for local testing.",
                quality_flags: [],
            };
            return res.status(200).json(EnrichOutputSchema.parse(stub)); // Validate the stub response against the Schema
        }

        const enrichResult = await enrich(validatedInput);
        if (!enrichResult.ok) {
            return res.status(422).json({ error: "Model could not produce a valid answer after one repair attempt." });
        }
        return res.status(200).json(enrichResult.data);

    } catch (error) {
        console.error("Enrichment error:", error);
        if (error.name === "APIConnectionTimeoutError") {
            return res.status(504).json({ error: "The model took too long to respond." });
        }
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;