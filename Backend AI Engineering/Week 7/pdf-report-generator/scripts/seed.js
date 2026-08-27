const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

// Build absolute paths from this project's directory.
const projectRoot = path.join(__dirname, "..");
const databasePath = path.join(projectRoot, "report.db");
const booksPath = path.join(projectRoot, "books.json");

// Read books.json.
const books = JSON.parse(
  fs.readFileSync(booksPath, "utf8")
);

console.log(`Loaded ${books.length} books from books.json`);

// Open/create the SQLite database.
const db = new DatabaseSync(databasePath);

// Create the books table if it does not already exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,
    title TEXT,
    price REAL,
    rating INTEGER,
    url TEXT
  );
`);

// Remove existing records. This makes the seed script safe to run repeatedly.
db.exec(`
  DELETE FROM books;
`);

// Prepare the INSERT statement once.
const insertBook = db.prepare(`
  INSERT INTO books (id, title, price, rating, url) VALUES (?, ?, ?, ?, ?);
`);

// Convert rating words into integers.
const ratingMap = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5
};

// Insert every book.
for (let i = 0; i < books.length; i++) {
  const book = books[i];

  const id = i + 1;
  const title = book.title;
  const price = Number(book.price_gbp);
  const rating = ratingMap[book.rating_text];
  const url = book.product_url;

  if (!title) {
    throw new Error(`Book ${id} is missing a title.`);
  }

  if (!Number.isFinite(price)) {
    throw new Error(`Book ${id} has an invalid price: ${book.price_gbp}`);
  }

  if (!Number.isInteger(rating)) {
    throw new Error(`Book ${id} has an invalid rating: ${book.rating_text}`);
  }

  if (!url) {
    throw new Error(`Book ${id} is missing a product URL.`);
  }

  insertBook.run(id, title, price, rating, url);
}

// Verify the final row count.
const result = db.prepare("SELECT COUNT(*) AS count FROM books").get();
console.log(`Books in database: ${result.count}`);
db.close();