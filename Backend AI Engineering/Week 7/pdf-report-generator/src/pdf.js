const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

function buildReportHtml(data) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const topBooksRows = data.topBooks
    .map(
      (book) => `
        <tr>
          <td>${book.title}</td>
          <td>£${book.price.toFixed(2)}</td>
          <td>${book.rating}</td>
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
          <td>${book.rating}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">

      <title>Bookstore Report</title>

      <style>
        @page {
          size: A4;
          margin: 20mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #222;
          font-size: 12px;
          line-height: 1.4;
        }

        h1 {
          margin-bottom: 4px;
        }

        .date {
          color: #666;
          margin-bottom: 24px;
        }

        .summary {
          display: flex;
          gap: 40px;
          margin-bottom: 30px;
        }

        .summary-item {
          border: 1px solid #ddd;
          padding: 12px 18px;
        }

        .summary-label {
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 20px;
          font-weight: bold;
        }

        h2 {
          margin-top: 24px;
          margin-bottom: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }

        th, td {
          border: 1px solid #ccc;
          padding: 7px;
          text-align: left;
        }

        th {
          font-weight: bold;
        }

        tr {
          break-inside: avoid;
        }

        thead {
          display: table-header-group;
        }

        .all-books {
          margin-top: 30px;
        }
      </style>
    </head>

    <body>
      <h1>Bookstore Report</h1>

      <div class="date">
        Report date: ${today}
      </div>

      <div class="summary">
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
      </div>

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
    </body>
    </html>
  `;
}

async function renderPdf(html, outputPath) {
    const outputDirectory = path.dirname(outputPath);

    fs.mkdirSync(outputDirectory, {
        recursive: true
    });

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