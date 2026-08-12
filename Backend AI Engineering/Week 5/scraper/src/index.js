const fs = require("fs/promises");
const path = require("path");

const URL = "https://books.toscrape.com/catalogue/page-1.html";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

const USER_AGENT = "FlyRankInternship-A9/1.0 (+https://github.com/sana-munir-alam/flyrank)";

async function main() {
    // Check whether the page is already cached
    try {
        const html = await fs.readFile(CACHE_FILE, "utf8");
        console.log("CACHE HIT");
        console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);
        return;
    } catch (error) {
        if (error.code !== "ENOENT") {      // File does not exist, so we continue to fetch it.
            throw error;
        }
    }

    // The page is not cached, so fetch it
    console.log("FETCH");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, 5000);

    try {
        const response = await fetch(URL, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
        clearTimeout(timeoutId);                            // Clear the timeout if the fetch completes in time
        if (response.status !== 200) {                      // Check the HTTP status before reading the body
            console.error(`Request failed with status: ${response.status}`);
            return;
        }

        const html = await response.text();                 // Read the raw HTML
        await fs.mkdir(CACHE_DIR, { recursive: true });     // Make sure the cache directory exists
        await fs.writeFile(CACHE_FILE, html, "utf8");       // Save the HTML
        console.log(`Response size: ${Buffer.byteLength(html, "utf8")} bytes`);
        console.log(`Saved to: ${CACHE_FILE}`);
    } catch (error) {
        if (error.name === "AbortError") { 
            console.error("Request timed out after 5 seconds."); 
        } else { 
            console.error("Fetch failed:", error.message); 
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

main();