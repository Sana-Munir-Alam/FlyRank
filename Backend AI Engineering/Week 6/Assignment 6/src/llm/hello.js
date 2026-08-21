const { llmClient, LLM_MODEL } = require("./client");

// Test the LLM client by sending a simple prompt to the model and logging the response.
(async () => {
    try {
        const res = await llmClient.chat.completions.create({
            model: LLM_MODEL,
            messages: [{ role: "user", content: "Reply with exactly one word: ready" }],
        });
        console.log(res.choices[0].message.content);
    } catch (err) {
        console.error("LLM test failed:", err);
        process.exit(1);
    }
})();
