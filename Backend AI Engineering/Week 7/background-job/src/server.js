const express = require("express");
const app = express(); 
const { serve } = require("inngest/express");
const { inngest } = require("./inngest");
const { sayHello } = require("./functions");

app.use(express.json());
const PORT = 3000;

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Import the Inngest client and background functions
app.use("/api/inngest", serve({
    client: inngest,
    functions: [sayHello]
 }));

app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
});