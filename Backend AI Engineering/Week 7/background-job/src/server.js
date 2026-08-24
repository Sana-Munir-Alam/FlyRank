const express = require("express");
const app = express();
const { randomUUID } = require("crypto");
const { serve } = require("inngest/express");
const { inngest } = require("./inngest");
const { sayHello, makeReport } = require("./functions");
const { reports } = require("./reports");

app.use(express.json());
const PORT = 3000;

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Import the Inngest client and background functions
app.use("/api/inngest", serve({
    client: inngest,
    functions: [sayHello, makeReport]
 }));

// Endpoint to request a report
app.post("/reports", async (req, res) => {
    const { topic } = req.body;
    const id = randomUUID();
    reports.set(id, {id, topic, status: "pending"});

    await inngest.send({
        name: "report/requested",
        data: {id, topic}
    });
    res.status(202).json({ id, status: "pending" });
});

// Endpoint to get the status of a report
app.get("/reports/:id", (req, res) => {
    const report = reports.get(req.params.id);
    if (!report) {
        return res.status(404).json({error: "Report not found"});
    }
    res.json(report);
});

app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
});