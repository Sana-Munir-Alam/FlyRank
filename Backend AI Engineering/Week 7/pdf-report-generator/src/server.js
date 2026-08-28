const express = require("express");
const app = express();
const db = require("./db");
const path = require("path");
const { getReportData } = require("./report");
const { buildReportHtml, renderPdf } = require("./pdf");

app.use(express.json());

const PORT = 3000;

app.get("/health", (req, res) => {
  res.status(200).json({status: "ok"});
});

// POST /reports
app.post("/reports", async (req, res) => {
    try {
        const force = req.body?.force === true;

        // If this is not a forced request, look for today's latest report.
        if (!force) {
            const today = new Date().toISOString().slice(0, 10);
            const existingReport = db.prepare(`SELECT id, path, created_at FROM reports WHERE created_at LIKE ? ORDER BY id DESC LIMIT 1`).get(`${today}%`);
            if (existingReport) {
                return res.status(200).json({id: existingReport.id, file: `/reports/${existingReport.id}/file`});
            }
        }

        // No report today, or force === true.
        const data = getReportData();           // Get the aggregated report data.
        const html = buildReportHtml(data);     // Convert the data into HTML.

        // Insert first so SQLite generates the report ID.
        const insertResult = db.prepare(`INSERT INTO reports (path, created_at) VALUES (?, ?)`).run(null, new Date().toISOString());
        const reportId = Number(insertResult.lastInsertRowid);

        const relativePath = path.join("reports", `${reportId}.pdf`);
        const absolutePath = path.join(__dirname, "..", relativePath);
        
        await renderPdf(html, absolutePath);

        db.prepare(`UPDATE reports SET path = ? WHERE id = ?`).run(relativePath, reportId);
        return res.status(201).json({id: reportId, file: `/reports/${reportId}/file`});

    } catch (error) {
        console.error("Report generation failed:",error);
        return res.status(500).json({error: "Failed to generate report"});
    }
});

// GET /reports/:id
app.get("/reports/:id", (req, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId)) {
        return res.status(404).json({error: "Report not found"});
    }

    const report = db.prepare(`SELECT id, path, created_at FROM reports WHERE id = ?`).get(reportId);
    if (!report) {
        return res.status(404).json({error: "Report not found"});
    }

    res.status(200).json({
        id: report.id,
        path: report.path,
        created_at: report.created_at,
        file: `/reports/${report.id}/file`
    });
});

// GET /reports/:id/file
app.get("/reports/:id/file", (req, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId)) {
        return res.status(404).json({error: "Report not found"});
    }

    const report = db.prepare(`SELECT id, path FROM reports WHERE id = ?`).get(reportId);
    if (!report) {
        return res.status(404).json({error: "Report not found"});
    }
    if (!report.path) {
        return res.status(404).json({error: "Report file not found"});
    }

    const absolutePath = path.join(__dirname, "..", report.path);
    res.sendFile(absolutePath, (error) => {
        if (error) {
            console.error("Failed to send report:", error);
            if (!res.headersSent) {
                res.status(404).json({error: "Report file not found"});
            }
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});