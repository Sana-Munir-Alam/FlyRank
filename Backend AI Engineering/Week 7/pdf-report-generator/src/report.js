const db = require("./db");

function getReportData() {
    // Total number of books
    const totalBooksResult = db.prepare(`SELECT COUNT(*) AS total FROM books`).get();
    const totalBooks = totalBooksResult.total;

    // Average price
    const averagePriceResult = db.prepare(`SELECT AVG(price) AS average FROM books`).get();
    const averagePrice = Math.round(averagePriceResult.average * 100) / 100;

    // Top 5 most expensive books
    const topBooks = db.prepare(`SELECT * FROM books ORDER BY price DESC LIMIT 5`).all();

    // Number of books per star rating
    const booksPerRating = db.prepare(`SELECT rating, COUNT(*) AS count FROM books GROUP BY rating ORDER BY rating`).all();
    
    // All books for the long report table
    const allBooks = db.prepare(`SELECT * FROM books ORDER BY id`).all();

    return { totalBooks, averagePrice, topBooks, booksPerRating, allBooks};
};

module.exports = {
    getReportData
};