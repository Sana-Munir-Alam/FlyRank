const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");
const { BookSchema } = require("./schema");

const START_URL = "https://books.toscrape.com/catalogue/page-1.html";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const USER_AGENT = "FlyRankInternship-A9/1.0 (+https://github.com/sana-munir-alam/flyrank)";
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const BOOKS_FILE = path.join( OUTPUT_DIR, "books.json" );
const ERRORS_FILE = path.join( OUTPUT_DIR, "errors.json" );
const REQUEST_DELAY = 500;
const REQUEST_TIMEOUT = 5000;
const MAX_CATALOGUE_PAGES = 3;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPage(url, cacheFile) {
    try {
        const html = await fs.readFile(cacheFile, "utf8");
        const stats = await fs.stat(cacheFile);
        console.log(`CACHE HIT ${cacheFile}`);
        return { html, fromCache: true, fetchedAt: stats.mtime.toISOString() };
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    console.log(`FETCH ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const fetchedAt = new Date().toISOString();

    try {
        const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
        if (response.status !== 200) throw new Error(`Request failed with status ${response.status}`);
        const html = await response.text();
        await fs.mkdir(path.dirname(cacheFile), { recursive: true });
        await fs.writeFile(cacheFile, html, "utf8");
        return { html, fromCache: false, fetchedAt };
    } catch (error) {
        if (error.name === "AbortError") throw new Error(`Request timed out after ${REQUEST_TIMEOUT}ms: ${url}`);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function cacheFileForUrl(url) {
    const parsedUrl = new URL(url);
    const filename = parsedUrl.pathname.replace(/^\/+/, "").replace(/\//g, "_");
    return path.join(CACHE_DIR, "books", filename); // no appended .html this time
}

function extractBookLinks(html, pageUrl) {
    const $ = cheerio.load(html);
    const bookUrls = [];
    $("article.product_pod h3 a").each((index, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        const absoluteUrl = new URL(href, pageUrl).href;
        bookUrls.push(absoluteUrl);
    });
    return bookUrls;
}

function findNextPage(html, pageUrl) {
    const $ = cheerio.load(html);
    const nextHref = $("li.next a").attr("href");
    if (!nextHref) return null;
    return new URL(nextHref, pageUrl).href;
}

async function discoverBooks() {
    let currentPageUrl = START_URL;
    const discoveredBooks = [];
    let cataloguePages = 0;

    while (currentPageUrl && cataloguePages < MAX_CATALOGUE_PAGES) {
        cataloguePages++;
        const catalogueCacheFile = path.join(CACHE_DIR, `catalogue-page-${cataloguePages}.html`);
        console.log(`\nProcessing catalogue page ${cataloguePages}`);

        const { html, fromCache } = await getPage(currentPageUrl, catalogueCacheFile);
        const bookUrls = extractBookLinks(html, currentPageUrl);

        console.log(`Found ${bookUrls.length} book links`);

        for (const productUrl of bookUrls) {
            discoveredBooks.push({ productUrl, sourcePage: currentPageUrl });
        }

        const nextPageUrl = findNextPage(html, currentPageUrl);
        if (!nextPageUrl) break;

        currentPageUrl = nextPageUrl;

        if (!fromCache && cataloguePages < MAX_CATALOGUE_PAGES) await sleep(REQUEST_DELAY);
    }

    const uniqueBooks = [];
    const seen = new Set();

    for (const book of discoveredBooks) {
        if (seen.has(book.productUrl)) continue;
        seen.add(book.productUrl);
        uniqueBooks.push(book);
    }

    return { books: uniqueBooks, cataloguePages };
}

function extractBookRecord(html, productUrl, sourcePage, fetchedAt) {
    const $ = cheerio.load(html);
    const productArea = $("article.product_page");
    const title = productArea.find("div.product_main h1").first().text().trim() || null;
    const priceText = productArea.find("p.price_color").first().text().trim() || null;
    const availabilityText = productArea.find("p.instock.availability").first().text().replace(/\s+/g, " ").trim() || null;
    const ratingText = productArea.find("p.star-rating").first().attr("class")?.replace("star-rating", "").trim() || null;
    const description = $("#product_description").next("p").first().text().trim() || null;

    return { title, product_url: productUrl, price_text: priceText, availability_text: availabilityText, rating_text: ratingText, description, source_page: sourcePage, fetched_at: fetchedAt };
}

async function fetchBookRecord(productUrl, sourcePage) {
    const cacheFile = cacheFileForUrl(productUrl);
    const { html, fromCache, fetchedAt } = await getPage(productUrl, cacheFile);
    if (!fromCache) await sleep(REQUEST_DELAY); // only delay on real network hits
    return extractBookRecord(html, productUrl, sourcePage, fetchedAt);
}

function normalizePrice(priceText) {
    if (!priceText) { return null; }
    const cleaned = priceText.replace("£", "").trim();  // Remove the pound sign and any leading/trailing whitespace
    const price = Number(cleaned);                  // Convert the cleaned string to a number
    return Number.isFinite(price) ? price : null;   // Returns null if the conversion fails
}

function normalizeRecord(rawRecord) {
    return { ...rawRecord, price_gbp: normalizePrice(rawRecord.price_text) };
}

async function main() {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });            // Create the output directory if it doesn't exist

    const { books, cataloguePages } = await discoverBooks();

    console.log(`\ncatalogue_pages=${cataloguePages}`);
    console.log(`discovered=${books.length}`);
    console.log(`unique_urls=${books.length}`);

    const validRecords = [];
    const errors = [];

    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const rawRecord = await fetchBookRecord(book.productUrl, book.sourcePage);
        const normalizedRecord = normalizeRecord(rawRecord);
        const result = BookSchema.safeParse(normalizedRecord);

        if (result.success) {
            validRecords.push(result.data);
        } else {
            errors.push({
                product_url: rawRecord.product_url,
                reason: result.error.issues
            });
        }
    }
    
    console.log(`\ndetail_pages=${books.length}`);
    console.log(`valid_records=${validRecords.length}`);
    console.log(`errors=${errors.length}`);

    await fs.writeFile( BOOKS_FILE, JSON.stringify( validRecords, null, 2 ), "utf8" );
    await fs.writeFile( ERRORS_FILE, JSON.stringify( errors, null, 2 ), "utf8" );
    console.log(`\nWrote ${BOOKS_FILE}`);
    console.log(`Wrote ${ERRORS_FILE}`);
}

main().catch((error) => {
    console.error("Scraper failed:", error.message);
    process.exit(1);
});