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

async function getAllTasks(done, search) {  // Fetches all tasks from the DB, optionally filtering by done status and search term
    let query = "SELECT * FROM tasks";
    const conditions = [];
    const values = [];

    if (done !== undefined) {
        values.push(done);
        conditions.push(`done = $${values.length}`);
    }
    if (search !== undefined) {
        values.push(`%${search.toLowerCase()}%`);
        conditions.push(`LOWER(title) LIKE $${values.length}`);
    }

    if (conditions.length > 0) { query += " WHERE " + conditions.join(" AND "); }
    const result = await db.query(query, values);
    return result.rows;
}

async function getTaskById(id) {    // Fetches a specific task by its ID from the database
    const result = await db.query("SELECT * FROM tasks WHERE id = $1", [id]);
    return result.rows[0];
}

async function getTaskStats(){      // Fetches statistics about the tasks currently stored in the database
    const totalResult = await db.query(`SELECT COUNT(*) FROM tasks`);
    const doneResult = await db.query(`SELECT COUNT(*) FROM tasks WHERE done = TRUE`);
    const total = Number(totalResult.rows[0].count);
    const done = Number(doneResult.rows[0].count);
    const open = total - done;
    return { total, done, open };
}

async function resetDatabase() {  // Resets the database by truncating the tasks table and reinitializing it
    await db.query(`TRUNCATE TABLE tasks RESTART IDENTITY`);
    await initializeDatabase();
}

module.exports = {
    initializeDatabase,
    getAllTasks,
    getTaskById,
    getTaskStats,
    resetDatabase
};