# Testing evidence — Stage 0 through Stage 5

This file contains the actual terminal output and screenshots proving each stage's checkpoint. See `README.md` for setup, architecture, and usage.

---

## Stage 0 — Setup

**Checkpoint:** `GET /health` returns `200`, and `playwright install chromium` finishes without errors.

![Setup and Playwright install](screenshots/Setup.png)

```text
curl -i http://localhost:3000/health

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 15

{"status":"ok"}
```

![Health check](screenshots/Health.png)

**Result:** Passed. Chromium, FFmpeg, and Chrome Headless Shell all downloaded with no errors.

---

## Stage 1 — Seeded database (bookstore, Option B)

**Checkpoint:** `SELECT COUNT(*)` → 60, even after seeding twice.

```text
node -e "const books = require('./books.json'); console.log('Books:', books.length);"
Books: 60
```

![Initial books.json inspection and first seed](screenshots/Initial_report_db.png)

**First run:**

```text
npm run seed
Loaded 60 books from books.json
Books in database: 60

sqlite> SELECT COUNT(*) FROM books;
60
sqlite> SELECT * FROM books LIMIT 5;
1|A Light in the Attic|51.77|3|https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html
2|Tipping the Velvet|53.74|1|https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html
3|Soumission|50.1|1|https://books.toscrape.com/catalogue/soumission_998/index.html
4|Sharp Objects|47.82|4|https://books.toscrape.com/catalogue/sharp-objects_997/index.html
5|Sapiens: A Brief History of Humankind|54.23|5|https://books.toscrape.com/catalogue/sapiens-a-brief-history-of-humankind_996/index.html
```

![Stage 1 first run](screenshots/Stage1_first_run.png)

**Second run (proving the seed is safe to run twice — row count stays at 60, does not double):**

```text
npm run seed
Loaded 60 books from books.json
Books in database: 60

sqlite> SELECT COUNT(*) FROM books;
60
sqlite> SELECT id, title FROM books ORDER BY id LIMIT 3;
1|A Light in the Attic
2|Tipping the Velvet
3|Soumission
```

![Stage 1 second run](screenshots/Stage1_second_run.png)

**Result:** Passed. Row count is 60 after both runs the `DELETE FROM books` before insert works as intended.

---

## Stage 2 — Aggregation queries

**Checkpoint:** test script prints one JSON object with four populated sections and real numbers.

```text
npm run test-report
```

![Stage 2 aggregation output](screenshots/Stage2.png)

Full output:

```json
{
  "totalBooks": 60,
  "averagePrice": 35,
  "topBooks": [
    { "id": 41, "title": "Slow States of Collapse: Poems", "price": 57.31, "rating": 3 },
    { "id": 16, "title": "Our Band Could Be Your Life: Scenes from the American Indie Underground, 1981-1991", "price": 57.25, "rating": 3 },
    { "id": 59, "title": "The Past Never Ends", "price": 56.5, "rating": 4 },
    { "id": 58, "title": "The Pioneer Woman Cooks: Dinnertime...", "price": 56.41, "rating": 1 },
    { "id": 57, "title": "The Secret of Dreadwillow Carse", "price": 56.13, "rating": 1 }
  ],
  "booksPerRating": [
    { "rating": 1, "count": 15 },
    { "rating": 2, "count": 8 },
    { "rating": 3, "count": 13 },
    { "rating": 4, "count": 10 },
    { "rating": 5, "count": 14 }
  ]
}
```

**Sanity check:** `15 + 8 + 13 + 10 + 14 = 60` matches `totalBooks`, confirming the `GROUP BY rating` query and the Stage 1 rating conversion are both correct.

**Result:** Passed.

---

## Stage 3 — HTML to PDF with clean page breaks

**Checkpoint:** `reports/test.pdf` opens, is ≥2 pages, no row cut in half, header repeats on both pages.

```text
npm run render-test
PDF created: .../pdf-report-generator/reports/test.pdf
```

![Stage 3 render](screenshots/Stage3.png)

**Verification:** the "All Books" table breaks cleanly between row 12 (Shakespeare's Sonnets) and row 13 (Set Me Free). No row is split across the page boundary, and the header row (`ID Title Price Rating`) reprints at the top of the next page. Confirmed by extracting the PDF's text content directly.

**Result:** Passed.

---

## Stage 4 — Generate and serve by link

**Checkpoint:** `time curl -i -X POST /reports` returns `201` + link after a visible pause; `curl -o my-report.pdf .../file` downloads a real PDF.

```text
time curl -i -X POST http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":1,"file":"/reports/1/file"}
curl ... 0.00s user 0.00s system 1% cpu 0.485 total

ls -lh reports/
-rw-r--r--  100K  1.pdf
-rw-r--r--  100K  test.pdf

curl -i http://localhost:3000/reports/1
HTTP/1.1 200 OK
{"id":1,"path":"reports/1.pdf","created_at":"2026-08-27T19:20:10.610Z","file":"/reports/1/file"}

curl -o my-report.pdf http://localhost:3000/reports/1/file
100k  100k    0     0  14.8M      0 --:--:-- --:--:-- --:--:-- 16.2M

curl -i http://localhost:3000/reports/999999
HTTP/1.1 404 Not Found
{"error":"Report not found"}

time curl -i -X POST http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":2,"file":"/reports/2/file"}
curl ... 0.00s user 0.00s system 1% cpu 0.717 total
```

![Stage 4 API generation and download](screenshots/Stage4.png)

**Result:** Passed. Both POSTs took a visible sub-second-but-noticeable pause (0.485s / 0.717s) versus an effectively instant `/health` response confirming the full pipeline (query → render → store) runs synchronously inside the request, as required. Each POST produced a distinct file (`1.pdf`, `2.pdf`), and the unknown-id case correctly returns `404`.

---

## Stage 5 — Duplicate requests make one report

**Checkpoint:** two rapid POSTs → same `id` in both responses, one new file in `reports/`. `{ "force": true }` → a new id.

```text
ls reports/*.pdf | wc -l
3

curl -i -X POST http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":3,"file":"/reports/3/file"}

curl -i -X POST http://localhost:3000/reports
HTTP/1.1 200 OK
{"id":3,"file":"/reports/3/file"}

curl -i -X POST -H "Content-Type: application/json" -d '{"force":true}' http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":4,"file":"/reports/4/file"}

ls reports/*.pdf | wc -l
5

curl -i -X POST http://localhost:3000/reports
HTTP/1.1 200 OK
{"id":4,"file":"/reports/4/file"}

curl -i -X POST http://localhost:3000/reports
HTTP/1.1 200 OK
{"id":4,"file":"/reports/4/file"}

ls reports/*.pdf | wc -l
5

curl -i -X POST -H "Content-Type: application/json" -d '{"force":true}' http://localhost:3000/reports
HTTP/1.1 201 Created
{"id":5,"file":"/reports/5/file"}

ls reports/*.pdf | wc -l
6
```

![Stage 5 idempotency](screenshots/Stage5.png)

**Result:** Passed.

- First plain POST → `201`, new report (`id: 3`).
- Second plain POST, fired immediately after → `200`, same `id: 3`. No new file.
- `force: true` → `201`, new report (`id: 4`), file count rises 3 → 5.
- Two more plain POSTs after that → both `200`, `id: 4` (correctly picked up the *latest* report from today, not the stale `id: 3`). File count stays at 5.
- A second `force: true` → `201`, `id: 5`, file count rises to 6.

Status codes are correctly split throughout: `200` for "returned existing," `201` only when a new file was actually generated.

---

## Page 1 of a generated report

![Bookstore report, page 1](screenshots/pdf-page1.png)