const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { extractBookRecord } = require("../src/parser");

function loadFixture(filename) {
    return fs.readFileSync(path.join(__dirname, "fixtures", filename), "utf8");
}

test("extracts a normal book correctly", () => {
    const html = loadFixture("normal-book.html");

    const record = extractBookRecord(
        html,
        "https://books.toscrape.com/catalogue/test/index.html",
        "https://books.toscrape.com/catalogue/page-1.html",
        "2026-08-13T17:00:00.000Z"
    );

    assert.equal(record.title, "Test Book");
    assert.equal(record.price_text, "£25.99");
    assert.equal(record.availability_text, "In stock (10 available)");
    assert.equal(record.rating_text, "Three");
    assert.equal(record.description, "This is a test description.");
});

test("returns null when description is missing", () => {
    const html = loadFixture("missing-description.html");

    const record = extractBookRecord(
        html,
        "https://books.toscrape.com/catalogue/test/index.html",
        "https://books.toscrape.com/catalogue/page-1.html",
        "2026-08-13T17:00:00.000Z"
    );

    assert.equal(record.title, "Book Without Description");
    assert.equal(record.price_text, "£10.50");
    assert.equal(record.description, null);
});