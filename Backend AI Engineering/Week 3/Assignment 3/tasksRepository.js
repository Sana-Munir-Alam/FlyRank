const db = require("./db");     // Import the database connection from db.js

async function initializeDatabase() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE
    )`);

    const result = await db.query(`SELECT COUNT(*) FROM tasks`);    // Fetches the count of rows in the tasks table
    if(Number(result.rows[0].count) === 0){                         // If table is empty, seed the database with initial tasks3
        await db.query(`INSERT INTO tasks (title, done) VALUES ($1,$2)`, ["Learn Express", false]);
        await db.query(`INSERT INTO tasks (title, done) VALUES ($1,$2)`, ["Build CRUD API", false]);
        await db.query(`INSERT INTO tasks (title, done) VALUES ($1,$2)`, ["Test with curl", true]);
    }
}

module.exports = {
    initializeDatabase
};