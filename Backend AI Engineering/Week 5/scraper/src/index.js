const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

const START_URL = "https://books.toscrape.com/catalogue/page-1.html";
const CACHE_DIR = path.join(__dirname, "..", "cache");

const USER_AGENT = "FlyRankInternship-A9/1.0 (+https://github.com/sana-munir-alam/flyrank)";
const REQUEST_DELAY = 500;
const MAX_CATALOGUE_PAGES = 3;

// Wait for a specified number of milliseconds.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch a URL and return its HTML. If the HTML is already cached, use the cached version instead.
async function getPage(URL, pageNumber) {
    const cacheFile = path.join( CACHE_DIR, `catalogue-page-${pageNumber}.html`);
    // Try Cache First
    try {
        const html = await fs.readFile(cacheFile, "utf8");
        console.log(`CACHE HIT page=${pageNumber}`);
        return { html, fromCache: true };
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    // Page isn't cached, so make a real network request
    console.log(`FETCH page=${pageNumber}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);

    try {
        const response = await fetch(URL, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
        if (response.status !== 200) {
            throw new Error( `Request failed with status ${response.status}` );
        }

        const html = await response.text();                 // Read the raw HTML
        await fs.mkdir(CACHE_DIR, { recursive: true });     // Make sure the cache directory exists
        await fs.writeFile(cacheFile, html, "utf8");       // Save the HTML
        
        console.log( `SAVED page=${pageNumber} size=${Buffer.byteLength( html, "utf8" )} bytes` );
        return { html, fromCache: false };
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error( `Request for page ${pageNumber} timed out after 5 seconds.` );
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Find the book links on a catalogue page.
function extractBookLinks(html, pageURL) {
    const $ = cheerio.load(html);
    const bookURLs = [];
    // For each book link, extract the href attribute and convert it to an absolute URL.
    $("article.product_pod h3 a").each((index, element) => {    
        const href = $(element).attr("href");
        if (!href) { return; }
        const absoluteURL = new URL(href, pageURL).href;        // Convert relative URL into an absolute URL.
        bookURLs.push(absoluteURL);                             // Add the absolute URL to the list of book URLs.
    });
    return bookURLs;
}

// Find the catalogue page's "next" link.
function findNextPage(html, pageURL) {
    const $ = cheerio.load(html);
    const nextHref = $("li.next a").attr("href");
    if (!nextHref) { return null; }
    return new URL(nextHref, pageURL).href;
}

// Main crawler.
async function main() {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    let currentPageURL = START_URL;
    const discoveredURLs = [];
    let cataloguePages = 0;

    while ( currentPageURL && cataloguePages < MAX_CATALOGUE_PAGES ) {
        cataloguePages++;
        console.log(`\nProcessing catalogue page ${cataloguePages}`);
        console.log(currentPageURL);

        const { html, fromCache } = await getPage( currentPageURL, cataloguePages );    // Get the page, either from cache or the website.
        const bookURLs = extractBookLinks( html, currentPageURL);                       // Find all books on this catalogue page.

        console.log( `Found ${bookURLs.length} book links on page ${cataloguePages}`);  // Log amount of book links found on this page.
        discoveredURLs.push(...bookURLs);
        const nextPageURL = findNextPage( html, currentPageURL );                       // Find the site's own "next" link.

        if (!nextPageURL) { break; }                                                    // No more pages to crawl.

        currentPageURL = nextPageURL;

        // Only wait when we actually made a network request.
        if (!fromCache && cataloguePages < MAX_CATALOGUE_PAGES) {
            await sleep(REQUEST_DELAY);
        }
    }

    // Remove duplicate URLs.
    const uniqueURLs = [ ...new Set(discoveredURLs) ];

    console.log("\n--------------------------------");
    console.log(`catalogue_pages=${cataloguePages}`);
    console.log(`discovered=${discoveredURLs.length}`);
    console.log(`unique_URLs=${uniqueURLs.length}`);
    console.log("--------------------------------");
}

main().catch((error) => {
    console.error("Crawler failed:", error.message);
    process.exit(1);
});