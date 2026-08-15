# Web Scraper

A JavaScript web scraper built for practicing responsible and controlled web scraping using the Books to Scrape sandbox. It downloads the first three catalogue pages of Books to Scrape, visits all 60 book pages, turns messy HTML into clean, validated JSON records, survives a broken page without crashing, and ends every run with an honest report of what happened.

## How to run it

```bash
git clone https://github.com/sana-munir-alam/flyrank.git
cd flyrank/scraper
npm install
node src/index.js
```

Requires Node.js 20+. No database, paid proxy, cloud account, or credit card is needed.

Running it produces:
- `output/books.json` — validated book records
- `output/books.csv` — the same records as CSV
- `output/errors.json` — records that failed schema validation, with reasons (empty on a clean run)
- `output/run-report.json` — a summary of what happened during the run
- `output/dashboard.html` — a one-page visual summary, open it in a browser
- `output/request-log.jsonl` — one line per HTTP request actually made, with URL, status, and attempt number

Running it again reuses the cached HTML in `cache/` (not committed to this repo — see `.gitignore`) and produces the same 60 records, it does not duplicate them.

## Target Classification

### Target Website

The target website for this project is:

**https://books.toscrape.com/**

Books to Scrape is a fictional bookstore specifically designed as a web-scraping practice environment. The parent website, ToScrape, describes the Books section as a safe place for beginners to learn web scraping and explicitly states that the site wants to be scraped.

The Books to Scrape website itself also displays the message **"We love being scraped!"**, confirming that it is intentionally provided for scraping practice.

### Why This Site Is Appropriate

This website is appropriate for this project because it is explicitly designed as a sandbox for web-scraping practice. It contains fictional book data and identifies itself as a demo website for scraping purposes.

The website also states that its prices and ratings are randomly assigned and have no real meaning, making it suitable for experimentation without relying on real commercial data.

### Scraping Scope

The scraper is limited to:

* The first **3 catalogue pages** only.
* **60 book detail pages** in total.
* No pages outside this defined scope are scraped.

### Data Collected

For each book, the scraper collects:

* Title
* Product URL (canonical identity of the record)
* Price (raw text and a normalized number)
* Availability
* Rating
* Description (or `null` if the book has none — never invented)
* Source catalogue page (provenance)
* Fetch timestamp (provenance)

### robots.txt Check

The following robots.txt URL was checked:

`https://books.toscrape.com/robots.txt`

The result was:

**404 Not Found**

This means there is no robots.txt file available at that location. This result is not treated as permission to scrape the website on its own — a missing file is silence, not a grant of permission. The actual justification for using this site comes from its explicit statements that it is a scraping sandbox and that it is intended to be scraped.

### Responsible Scraping

This project is intentionally limited to the Books to Scrape sandbox and to the first three catalogue pages. It is not assumed to be appropriate for other websites simply because this site permits scraping.

**I will not reuse this code on another site without checking its rules and terms first.**

## Politeness rules this scraper follows

- **User-agent**: every request identifies itself as `FlyRankInternship-A9/1.0 (+https://github.com/sana-munir-alam/flyrank)`, so a site owner checking their logs can find out who made the request and why.
- **Timeout**: every request gives up after 5 seconds instead of hanging forever.
- **Delay**: at least 500ms between real (non-cached) requests to the site. Cached pages incur no delay, since they never leave the machine.
- **Cache**: every fetched page is saved to `cache/` and reused on subsequent runs, so a given page is only requested from the live site once.
- **Retry rules**: a timeout or server error (5xx) is retried up to twice, with exponential backoff plus jitter between attempts, and the `Retry-After` header is respected if the server sends one. A 404 or 403 is never retried — the page either doesn't exist or the site has said no, and asking again would not change that.
- **Isolation**: each book page is fetched and processed independently. One broken page is logged and skipped; it never stops the run.
- **Request log**: every real HTTP request (not cache reads) is appended to `output/request-log.jsonl` with its URL, status, and attempt number (a full paper trail of what actually left the machine).

## Record schema

Each validated record in `books.json` has this shape (enforced with Zod, see `src/schema.js`):

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "price_gbp": 51.77,
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-08-14T17:30:53.912Z"
}
```

`product_url` is treated as each record's canonical identity — if the same book were discovered twice, it counts once, and it's the key used for change detection between runs. `source_page` and `fetched_at` are provenance: the receipt showing where and when a fact came from, kept on every record and never overwritten.

## Sample run report

This is a real `output/run-report.json` from this repo's code, run clean against the live site with an empty book cache:

```json
{
  "start_time": "2026-08-14T17:30:53.071Z",
  "duration_ms": 43736,
  "pages_fetched": 60,
  "cache_hits": 3,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "changes": {
    "new": 1,
    "changed": 0,
    "unchanged": 59,
    "gone": 0
  }
}
```

Note on `new: 1`: this isn't a bug. The 3 catalogue pages were still cached from an earlier run (hence `cache_hits: 3`), but all 60 book pages were freshly fetched. One of those 60 books had been intentionally broken in an earlier retry test (see below) and had briefly dropped out of `books.json` as `gone`. On this run it fetched successfully again, so change detection correctly reported it as `new` relative to the last-saved file — a real demonstration of the change-detection extra working, not an inconsistency.

## Optional extras built

Per the assignment's "Make it yours" section, the following extras were implemented:

- **CSV export** (`src/csv.js`) — produces `output/books.csv` from the validated records. All 9 fields flatten cleanly into columns; the only field needing real escaping is `description`, since it can contain commas, double quotes, and line breaks. Each is wrapped in double quotes with internal quotes doubled per standard CSV escaping, verified against the real output.
- **Changed since last run** (`src/change-detection.js`) — each record is hashed (SHA-256 over every field except `fetched_at`, so the timestamp changing on every run doesn't falsely mark every record as "changed"). Comparing hashes by `product_url` between the previous and current `books.json` reports how many records are new, changed, unchanged, or gone.
- **Tiny dashboard** (`src/dashboard.js`) — `output/dashboard.html`, a static local page showing record count, price range, failure count, last-run timestamp, and the new/changed/unchanged/gone breakdown.
- **Selector fixtures** (`test/fixtures/`) — two hand-written HTML fixtures (`normal-book.html`, `missing-description.html`) exercise the parser without any network call. Verified: a normal book parses every field correctly including trimming surrounding whitespace, and a book with no description block returns `description: null` rather than an empty string or a crash.
- **Retry like a pro** (in `src/index.js`'s `getPage()`) — upgraded from Stage 5's flat single retry to exponential backoff with random jitter (`500ms × 2^attempt + up to 250ms jitter`), respecting a `Retry-After` header when the server sends one, retrying up to twice, and logging every real request's URL, status, and attempt number to `output/request-log.jsonl`.

### Testing the retry-like-a-pro logic

Verified by temporarily setting `REQUEST_TIMEOUT` to 1ms against one uncached real book URL, forcing every attempt to fail:

```
FETCH .../a-light-in-the-attic_1000/index.html (attempt 1)
Retrying .../a-light-in-the-attic_1000/index.html after 692ms...
FETCH .../a-light-in-the-attic_1000/index.html (attempt 2)
Retrying .../a-light-in-the-attic_1000/index.html after 1249ms...
FETCH .../a-light-in-the-attic_1000/index.html (attempt 3)
FAILED .../a-light-in-the-attic_1000/index.html: Request timed out after 1ms
```

The delays (692ms, 1249ms) are neither identical nor fixed — they show real exponential growth (500ms base doubling per attempt) plus jitter (roughly 0–250ms added each time), and the run continued to the remaining books afterward rather than crashing. `REQUEST_TIMEOUT` is set to a real `5000` in the committed code; `1` was only ever a temporary local value used to force this test.

### Testing the failure-survival logic (Stage 5)

`src/index.js` contains a commented-out block that adds one intentionally invalid book URL to the discovered list. Uncommenting it and running the scraper demonstrates that one bad page is logged and skipped without stopping the run: `books.json` still ends up with all real records, and `run-report.json` shows `failed_pages: 1`.

### Parser unit tests

```bash
npm test
```

```
✔ extracts a normal book correctly (5.41475ms)
✔ returns null when description is missing (1.106458ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

## Ethics note

This scraper only touches a site that explicitly invites scraping. That's not a general license — it's specific to this sandbox. In any other context: use an official API when one exists, never bypass logins, paywalls, or explicit blocks, and collect only the data actually needed for the task.

## Known limitation

The CSS selectors in `src/parser.js` (`article.product_page`, `p.price_color`, `p.star-rating`, etc.) are tied to Books to Scrape's current HTML structure. If the site were redesigned, these selectors would silently return `null` for every field rather than raising a clear error — there's currently no automated check that would catch a structural change like that, only the fixture tests, which only catch it if the fixtures themselves are updated to match the new markup.

## Project Structure

```text
scraper/
├── README.md
├── .gitignore
├── package.json
├── src/
│   ├── index.js                # main pipeline: fetch, discover, extract, normalize, validate, store, report
│   ├── parser.js               # HTML raw record extraction
│   ├── schema.js               # Zod schema for validated book records
│   ├── csv.js                  # JSON records → CSV
│   ├── change-detection.js     # hash-based diff between runs
│   └── dashboard.js            # static HTML summary generator
├── test/
│   ├── parser.test.js
│   └── fixtures/
│       ├── normal-book.html
│       └── missing-description.html
├── output/
│   ├── books.csv   
│   ├── books.json
│   ├── dashboard.html
│   ├── errors.json
│   └── request-log.jsonl
│   ├── run-report.json
└── cache/                      # not committed — cached HTML for development
```

## Notes

This project is for learning and demonstrating responsible web-scraping practices. The target website contains fictional/demo data intended for scraping exercises.