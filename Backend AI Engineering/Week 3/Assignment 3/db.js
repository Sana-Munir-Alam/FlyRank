require("dotenv").config();     // Load environment variables from .env file
const {Pool} = require("pg");   // Pulls in the pg package for PostgreSQL database operations.

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,  // Use the DATABASE_URL from the .env file for the connection string
})

module.exports = pool;