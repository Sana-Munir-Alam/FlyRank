const { z } = require("zod");

const httpsURLSchema = z.string().url().refine((url) => url.startsWith("https://"), { message: "URL must use HTTPS" });

const BookSchema = z.object({
    title: z.string().min(1),
    product_url: httpsURLSchema,
    price_text: z.string().min(1),
    price_gbp: z.number().finite().nonnegative(),
    availability_text: z.string().min(1),
    rating_text: z.string().min(1),
    description: z.string().nullable(),
    source_page: httpsURLSchema,
    fetched_at: z.string().datetime()
});

module.exports = {
    BookSchema
};