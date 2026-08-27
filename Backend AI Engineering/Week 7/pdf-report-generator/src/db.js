// This file creates one database handle:
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const databasePath = path.join(__dirname, "..", "report.db");
const db = new DatabaseSync(databasePath);

module.exports = db;