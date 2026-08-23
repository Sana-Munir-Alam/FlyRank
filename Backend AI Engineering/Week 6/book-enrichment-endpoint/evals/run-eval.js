require("dotenv").config();
const fs = require("fs");
const path = require("path");

const ENDPOINT = process.env.EVAL_ENDPOINT || "http://localhost:3000/llm/enrich";
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function runCase(c) {
    try {
        const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            title: c.title, description: c.description }),
        });
        const body = await res.json();
        const pass = res.status === 200 && body.category === c.expected_category;
        return { id: c.id, title: c.title, expected: c.expected_category, actual: body.category ?? null, status: res.status, pass };
    } catch(error){
        return { id: c.id, title: c.title, expected: c.expected_category, actual: null, status: "ERROR", pass: false, errorMessage: error.message, };
    }
}

(async () => {
    const results = [];
    for (const c of cases) {
        results.push(await runCase(c)); // sequential — don't parallelize, you'll trip rate limits
        await sleep(13000);
    }
    const passed = results.filter(r => r.pass).length;
    console.log(`\nEval result: ${passed}/${results.length} matched on category (${((passed/results.length)*100).toFixed(0)}%)\n`);
    results.forEach(r =>
        console.log(
            `${r.pass ? "PASS" : "FAIL"} #${r.id} "${r.title}" — expected ${r.expected}, got ${r.actual} (HTTP ${r.status})${r.errorMessage ? ` — ${r.errorMessage}` : ""}`
        )
    );
})();