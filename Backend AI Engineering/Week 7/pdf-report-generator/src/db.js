// This file creates one database handle:
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const databasePath = path.join(__dirname, "..", "report.db");
const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT,
    created_at TEXT
  );
`);

module.exports = db;