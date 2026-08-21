require("dotenv").config();
const express = require("express");
const router = express.Router();
const { EnrichInputSchema, EnrichOutputSchema } = require("../llm/enrichSchema");

router.post("/enrich", async (req, res) => {
    try {
        // Validate the input against the EnrichInputSchema
        const result = EnrichInputSchema.safeParse(req.body);
        
        if (!result.success) {
            const issue = result.error.issues[0];
            return res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
        }

        const validatedInput = result.data;

        if (process.env.LLM_STUB === "1") {
            const stub = {
                category: "other",
                summary: "Stub response for local testing.",
                quality_flags: [],
            };
            return res.status(200).json(EnrichOutputSchema.parse(stub)); // Validate the stub response against the Schema
        }
        return res.status(501).json({ error: "Model call not implemented yet (Stage 2)" });
    } catch (error) {
        console.error("Enrichment error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;