const { z } = require("zod");

// Define a Zod schema for the enriched task object.
const EnrichInputSchema = z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(3000).nullable(),
});

const EnrichOutputSchema = z.object({
    category: z.enum([ "fiction", "non-fiction", "poetry", "childrens", "other", ]),
    summary: z.string().max(200),
    quality_flags: z.array(
        z.enum([ "missing_description", "description_too_short", "likely_truncated", ])
    ),
});

module.exports = {
    EnrichInputSchema,
    EnrichOutputSchema,
};