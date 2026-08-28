# Week 7: PDF Report Generator

## 1. What it does

This project demonstrates a complete data-to-document reporting pipeline. The API queries bookstore data stored in SQLite, aggregates it into report-ready values, renders those values as HTML, converts the HTML into a PDF with Playwright and Chromium, stores the generated PDF on disk, and exposes it through an HTTP download link.

The project also demonstrates API-level idempotency: repeated report requests on the same day reuse the latest generated report unless `{ "force": true }` is supplied.

The pipeline is:

```text
SQLite → SQL aggregation → HTML → Playwright/Chromium → PDF file → API download link
```

This assignment is standalone and lives inside the `pdf-report-generator/` folder of the Week 7 repository.

## 2. Dataset

**Option B — Bookstore**

The dataset is the `books.json` file produced in the A9 bookstore scraping assignment. It contains 60 scraped book records.

The report database stores:

- `id`
- `title`
- `price`
- `rating`
- `url`

The Stage 1 seed script clears the existing `books` rows before inserting the 60 records, so it can safely be run more than once without producing duplicate rows.

## 3. Requirements

- Node.js 22.5+ (this project uses the built-in `node:sqlite` module, which requires this version or later)
- npm
- Playwright
- Chromium for Playwright

The project was developed and tested with:

```text
Node.js v22.17.0
```

For a fresh clone:

```bash
npm install
npx playwright install chromium
```

The Chromium install step is required even after `npm install` — Playwright's browser binary is not published to npm and is not restored by a normal dependency install.

## 4. How to run it

From the `pdf-report-generator/` folder:

### 1. Seed the database

```bash
npm run seed
```

This reads `books.json`, clears the existing book rows, and inserts the 60 records. Safe to run more than once (row count stays at 60).

### 2. Start the API

In the first terminal:

```bash
npm start
```

The API runs at:

```text
http://localhost:3000
```

### 3. Generate or reuse a report

In a second terminal:

```bash
time curl -i -X POST http://localhost:3000/reports
```

A newly generated report returns `201 Created`. If a report has already been generated that day, a normal request returns `200 OK` with the existing report's ID and file link.

### 4. Download the PDF

Use the ID returned by the POST request:

```bash
curl -o my-report.pdf http://localhost:3000/reports/<id>/file
```

The downloaded file is a real PDF.

For the full terminal captures and screenshots behind every stage's checkpoint, see [`testing.md`](testing.md). It contains a stage-by-stage log of the exact commands run and their output, plus the setup and database screenshots referenced below.

## 5. API endpoints

| Endpoint | What it does |
| --- | --- |
| `GET /health` | Confirms that the API is running. |
| `POST /reports` | Generates a report or reuses the latest report generated today. Returns `201` for a new report and `200` when reusing an existing report. |
| `GET /reports/:id` | Returns report metadata and its file link. Unknown IDs return `404`. |
| `GET /reports/:id/file` | Serves the generated PDF from disk. Unknown IDs return `404`. |

### Force a new report

```bash
curl -i \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"force":true}' \
  http://localhost:3000/reports
```

`force: true` skips the daily idempotency check and generates a fresh report.

## 6. Aggregation SQL

The report data is produced by the following queries in `src/report.js`.

### Total number of books

```sql
SELECT COUNT(*) AS total
FROM books
```

### Average price

```sql
SELECT AVG(price) AS average
FROM books
```

The JavaScript result is rounded to two decimal places before it is placed in the report object.

### Top 5 most expensive books

```sql
SELECT *
FROM books
ORDER BY price DESC
LIMIT 5
```

### Number of books per star rating

```sql
SELECT rating, COUNT(*) AS count
FROM books
GROUP BY rating
ORDER BY rating
```

The report also reads all book rows for the long table used to demonstrate PDF page breaks:

```sql
SELECT *
FROM books
ORDER BY id
```

## 7. PDF rendering

The report is first built as an HTML string by `buildReportHtml(data)` and then rendered by `renderPdf(html, outputPath)`.

Playwright uses Chromium to print the report as A4:

```js
await page.pdf({
  path: outputPath,
  format: "A4",
  printBackground: true
});
```

The print CSS prevents table rows from being split across pages and repeats the table header when the table continues:

```css
tr {
  break-inside: avoid;
}

thead {
  display: table-header-group;
}
```

The generated PDF is stored under `reports/`.

## 8. Artifact handling

The PDF itself is stored on disk. The SQLite `reports` table stores only metadata and the relative file path:

```text
reports
├── id
├── path
└── created_at
```

The API returns a small JSON response containing the report ID and a link:

```json
{
  "id": 1,
  "file": "/reports/1/file"
}
```

The PDF bytes are served separately through:

```text
GET /reports/:id/file
```

This keeps the generated artifact out of the JSON response, only the download endpoint moves megabytes.

## 9. Background job boundary

I would move report generation to a background job once an inline request regularly takes more than about 1–2 seconds or the `books` table grows large enough that querying and rendering a report noticeably blocks API requests.

## 10. Idempotency

The daily report check protects against duplicate report generation caused by repeated requests, double-clicks, retries, or clients accidentally submitting the same request more than once.

In a real system, a missing idempotency check could cause money to be lost by charging a customer twice when a payment request is retried after a timeout.

## 11. Test evidence and screenshots

The detailed Stage 0–5 test evidence. Full terminal captures for every checkpoint is kept in [`testing.md`](testing.md) so that this README stays focused on setup, architecture, and usage.

The repository includes screenshots covering:

- setup and health check
- initial database state
- repeated Stage 1 seeding (proving the seed script is safe to run twice)
- Stage 2 aggregation output
- Stage 3 PDF generation
- Stage 4 API report generation and download
- Stage 5 idempotency (duplicate POSTs, force flag)
- **page 1 of a generated report PDF** (`screenshots/pdf-page1.png`)

## 12. Repository structure

```text
pdf-report-generator/
├── README.md
├── testing.md
├── books.json
├── package.json
├── package-lock.json
├── screenshots/
│   ├── Health.png
│   ├── Initial_report_db.png
│   ├── pdf-page1.png
│   ├── Setup.png
│   ├── Stage1_first_run.png
│   ├── Stage1_second_run.png
│   ├── Stage2.png
│   ├── Stage3.png
│   ├── Stage4.png
│   ├── Stage5.png
│   └── pdf-page1.png
├── scripts/
│   ├── seed.js
│   ├── test-report.js
│   └── render-test.js
└── src/
    ├── db.js
    ├── pdf.js
    ├── report.js
    └── server.js
```

Generated files are intentionally excluded from Git:

```gitignore
report.db
reports/
```