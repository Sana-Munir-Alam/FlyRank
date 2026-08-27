const path = require("path");
const { getReportData } = require("../src/report");
const { buildReportHtml, renderPdf } = require("../src/pdf");

async function main() {
    const data = getReportData();
    const html = buildReportHtml(data);
    const outputPath = path.join(__dirname, "..", "reports", "test.pdf");

    await renderPdf(html, outputPath);
    console.log(`PDF created: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});