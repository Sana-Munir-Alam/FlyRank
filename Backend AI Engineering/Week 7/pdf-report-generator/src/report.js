const db = require("./db");

function getReportData(minRating = null) {
    const hasFilter = minRating !== null;

    // Total number of books
    const totalBooksResult = hasFilter
        ? db.prepare(`SELECT COUNT(*) AS total FROM books WHERE rating >= ?`).get(minRating)
        : db.prepare(`SELECT COUNT(*) AS total FROM books`).get();
    const totalBooks = totalBooksResult.total;

    // Average price
    const averagePriceResult = hasFilter
        ? db.prepare(`SELECT AVG(price) AS average FROM books WHERE rating >= ?`).get(minRating)
        : db.prepare(`SELECT AVG(price) AS average FROM books`).get();
    const averagePrice = Math.round(averagePriceResult.average * 100) / 100;

    // Top 5 most expensive books
    const topBooks = hasFilter
        ? db.prepare(`SELECT *FROM books WHERE rating >= ? ORDER BY price DESC LIMIT 5`).all(minRating)
        : db.prepare(`SELECT * FROM books ORDER BY price DESC LIMIT 5`).all();

    // Number of books per star rating
    const booksPerRating = hasFilter
        ? db.prepare(`SELECT rating, COUNT(*) AS count FROM books WHERE rating >= ? GROUP BY rating ORDER BY rating`).all(minRating)
        : db.prepare(`SELECT rating, COUNT(*) AS count FROM books GROUP BY rating ORDER BY rating`).all();
        
    // All books for the long report table
    const allBooks = hasFilter 
        ? db.prepare(`SELECT * FROM books WHERE rating >= ? ORDER BY id`).all(minRating)
        : db.prepare(`SELECT * FROM books ORDER BY id`).all();

    return { totalBooks, averagePrice, topBooks, booksPerRating, allBooks};
};

module.exports = {
    getReportData
};