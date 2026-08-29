const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

function buildReportHtml(data, minRating = null) {
    const today = new Date()
        .toISOString()
        .slice(0, 10);

    const reportTitle = minRating === null
        ? "Bookstore Report"
        : `Books Rated ${minRating}★ and Above`;

    const topBooksRows = data.topBooks
        .map(
            (book) => `
                <tr>
                    <td>${book.title}</td>
                    <td>£${book.price.toFixed(2)}</td>
                    <td>${book.rating}★</td>
                </tr>
            `
        )
        .join("");

    const allBooksRows = data.allBooks
        .map(
            (book) => `
                <tr>
                    <td>${book.id}</td>
                    <td>${book.title}</td>
                    <td>£${book.price.toFixed(2)}</td>
                    <td>${book.rating}★</td>
                </tr>
            `
        )
        .join("");

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <title>${reportTitle}</title>

            <style>
                :root {
                    --brand: #173f5f;
                    --brand-light: #eaf2f8;
                    --text: #1f2933;
                    --muted: #6b7280;
                    --border: #d9e1e8;
                    --background: #f7f9fb;
                }

                @page {
                    size: A4;
                    margin: 18mm 16mm 20mm 16mm;

                    @bottom-center {
                        content: "Bookstore Report  •  Page " counter(page) " of " counter(pages);
                        font-size: 9px;
                        color: #6b7280;
                    }
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    font-family: Arial, Helvetica, sans-serif;
                    color: var(--text);
                    background: white;
                    font-size: 11px;
                    line-height: 1.45;
                }

                /* Header / branding */

                .brand-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-bottom: 14px;
                    border-bottom: 3px solid var(--brand);
                    margin-bottom: 20px;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .logo {
                    width: 38px;
                    height: 38px;
                    background: var(--brand);
                    color: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: bold;
                }

                .brand-name {
                    font-size: 15px;
                    font-weight: bold;
                    color: var(--brand);
                    letter-spacing: 0.3px;
                }

                .brand-subtitle {
                    font-size: 9px;
                    color: var(--muted);
                    margin-top: 2px;
                }

                .report-date {
                    text-align: right;
                    color: var(--muted);
                    font-size: 9px;
                }

                /* Report title */

                h1 {
                    margin: 0 0 5px;
                    font-size: 25px;
                    color: var(--brand);
                    letter-spacing: -0.4px;
                }

                .report-description {
                    color: var(--muted);
                    margin-bottom: 22px;
                    font-size: 11px;
                }

                /* Summary cards */

                .summary {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 26px;
                }

                .summary-item {
                    flex: 1;
                    border: 1px solid var(--border);
                    border-left: 4px solid var(--brand);
                    border-radius: 5px;
                    padding: 12px 14px;
                    background: var(--background);
                }

                .summary-label {
                    color: var(--muted);
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    margin-bottom: 5px;
                }

                .summary-value {
                    color: var(--brand);
                    font-size: 19px;
                    font-weight: bold;
                }

                /* Sections */

                h2 {
                    margin: 22px 0 10px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid var(--border);
                    color: var(--brand);
                    font-size: 15px;
                    break-after: avoid;
                }

                .all-books {
                    margin-top: 28px;
                }

                /* Tables */

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }

                th,
                td {
                    border: 1px solid var(--border);
                    padding: 7px 8px;
                    text-align: left;
                }

                th {
                    background: var(--brand);
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                }

                td {
                    font-size: 10px;
                }

                tbody tr:nth-child(even) {
                    background: #f8fafc;
                }

                tbody tr {
                    break-inside: avoid;
                }

                thead {
                    display: table-header-group;
                }

                /* Keep important blocks together */

                .summary,
                .summary-item {
                    break-inside: avoid;
                }
            </style>
        </head>

        <body>

            <header class="brand-header">
                <div class="brand">
                    <div class="logo">B</div>
                    <div>
                        <div class="brand-name">
                            BOOKSTORE ANALYTICS
                        </div>

                        <div class="brand-subtitle">
                            Data Report
                        </div>
                    </div>
                </div>

                <div class="report-date">
                    Generated<br>
                    ${today}
                </div>
            </header>

            <main>
                <h1>${reportTitle}</h1>

                <div class="report-description">
                    A summary of the bookstore dataset, including pricing,
                    ratings, and the most expensive books.
                </div>

                <section class="summary">
                    <div class="summary-item">
                        <div class="summary-label">
                            Total Books
                        </div>

                        <div class="summary-value">
                            ${data.totalBooks}
                        </div>
                    </div>

                    <div class="summary-item">
                        <div class="summary-label">
                            Average Price
                        </div>

                        <div class="summary-value">
                            £${data.averagePrice.toFixed(2)}
                        </div>
                    </div>
                </section>

                <h2>Top 5 Most Expensive Books</h2>

                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Rating</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${topBooksRows}
                    </tbody>
                </table>

                <h2 class="all-books">
                    All Books
                </h2>

                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Rating</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${allBooksRows}
                    </tbody>
                </table>
            </main>
        </body>
        </html>
    `;
}

async function renderPdf(html, outputPath) {
    const outputDirectory = path.dirname(outputPath);
    fs.mkdirSync(outputDirectory, {recursive: true});
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage();
        await page.setContent(html);
        await page.pdf({path: outputPath, format: "A4", printBackground: true});
    } finally {
        await browser.close();
    }
}

module.exports = {
    buildReportHtml,
    renderPdf
};