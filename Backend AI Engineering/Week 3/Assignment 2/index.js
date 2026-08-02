const express = require("express");                 // Pulls in the framework.
const app = express();                              // Creates app — the object we attach routes to.
const swaggerUi = require("swagger-ui-express");    // Pulls in the swagger-ui-express package.
const openapiSpec = require("./openapi.json");      // Pulls in the OpenAPI specification file.
const Database = require("better-sqlite3");         // Pulls in the better-sqlite3 package for SQLite database operations.
const db = new Database("tasks.db");                // Initializes a new SQLite database connection using the specified database file.

app.use(express.json());                            // Middleware that allows the app to parse JSON bodies in requests.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));    // Sets up the Swagger UI route to serve the OpenAPI documentation.

const PORT = 3000;

db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT 0
    )
`);

const tasksRows = db.prepare(`SELECT * FROM tasks`).get();  // Fetches the first row from table to check if table is empty
if (!tasksRows){                         // If the tasks table is empty, insert the initial 3 tasks into the database.
    const insert = db.prepare(`INSERT INTO tasks (title, done) VALUES (?,?)`);
    insert.run("Learn Express", 0);
    insert.run("Build CRUD API", 0);
    insert.run("Test with curl", 1);
}

// Add the path and handler (where handler always get the incoming request [req] and the tool we use to respond [res])
app.get("/", (req,res) => {
    res.json({
        name: "Task API",
        version: "1.0",
        endpoints: ["/tasks", "/stats", "/reset", "/health"]
    });
});

// Returns the complete list of tasks stored in the database, or filters them using query parameters.
app.get("/tasks", (req, res) => {
    let query = "SELECT * FROM tasks";
    const conditions = [];
    const params = [];

    if (req.query.done !== undefined) {
        if (req.query.done !== "true" && req.query.done !== "false") {
            return res.status(400).json({ error: "Invalid done query. Use true or false."});
        }
        conditions.push("done = ?");
        params.push(req.query.done === "true" ? 1 : 0);
    }

    if (req.query.search !== undefined) {
        const search = req.query.search.trim();
        if (search === "") {
            return res.status(400).json({ error: "Search query cannot be empty." });
        }
        conditions.push("LOWER(title) LIKE ?");
        params.push(`%${search.toLowerCase()}%`);
    }

    if (conditions.length > 0) { query += " WHERE " + conditions.join(" AND "); }

    const tasks = db.prepare(query).all(...params);
    const formattedTasks = tasks.map(task => ({
        ...task,
        done: Boolean(task.done)
    }));
    res.json(formattedTasks);
});

// Returns the task with the given id, or a 404 error if not found.
app.get("/tasks/:id", (req,res) => {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id); // Fetch task with specific id from DB
    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    task.done = Boolean(task.done);
    res.json(task);
});

// Returns statistics about the tasks currently stored in the database.
app.get("/stats", (req,res) => {
    const total = db.prepare(`SELECT COUNT(*) AS count FROM tasks`).get().count;
    const done = db.prepare(`SELECT COUNT(*) AS count FROM tasks WHERE done = 1`).get().count;
    const open = total - done;
    res.json({ total, done, open });
});

// Creates a new task with the given title and stores it in the SQLite database.
app.post("/tasks", (req,res) => {
    const {title} = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Request body must include a valid title" });
    }
    const insertTask = db.prepare(`INSERT INTO tasks (title, done) VALUES (?,?)`).run(title.trim(), 0); // Insert new task into DB
    const newId = insertTask.lastInsertRowid; // Get the ID of the newly inserted task. SQLite generates this automatically.
    
    const newTask = {   // Create a new task object with the assigned id, title, and default done value of false
        id: newId,
        title: title.trim(),
        done: false
    };

    res.status(201).json(newTask);
});

// Updates the task with the given id, or returns a 404 error if not found.
app.put("/tasks/:id", (req,res) => { 
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id); // Fetch task with specific id from DB
    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    const { title, done } = req.body;
    if ((title !== undefined && (typeof title !== "string" || title.trim() === "")) || (done !== undefined && typeof done !== "boolean")) {
        return res.status(400).json({ error: "Invalid request body"});
    }
    if (title !== undefined) {  
        db.prepare(`UPDATE tasks SET title = ? WHERE id = ?`).run(title.trim(), task.id); // Update the title in DB
        task.title = title.trim();
    }
    if (done !== undefined) { 
        db.prepare(`UPDATE tasks SET done = ? WHERE id = ?`).run(done ? 1 : 0, task.id); // Update the done in DB }
        task.done = done;
    }
    const UpdatedTask = {   // Create an updated task object with the assigned
        id: task.id,
        title: task.title,
        done: Boolean(task.done)
    };
    res.json(UpdatedTask);
});

// Deletes the task with the given id, or returns a 404 error if not found.
app.delete("/tasks/:id", (req,res) => {
    // Using delete and checking no. of changes to determine if task was found. This way we avoid extra query of fetch in order to delete.
    const deleteTask = db.prepare(`DELETE FROM tasks WHERE id = ?`).run(req.params.id); // Delete the task from DB
    if(deleteTask.changes === 0){  // If no rows were deleted, the task with the given id was not found
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.status(204).send();
});

// Restores the original sample tasks in the database.
app.post("/reset", (req,res) => {
    db.prepare(`DELETE FROM tasks`).run();
    const insert = db.prepare(`INSERT INTO tasks (title, done) VALUES (?, ?)`);
    insert.run("Learn Express", 0);
    insert.run("Build CRUD API", 0);
    insert.run("Test with curl", 1);

    const tasks = db.prepare(`SELECT * FROM tasks`).all();
    const formattedTasks = tasks.map(task => ({
        ...task,
        done: Boolean(task.done)
    }));
    res.json({
        message: "Tasks have been reset.",
        tasks: formattedTasks
    });
});

// Simple health check route to confirm the server is running.
app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

// Starts the server listening on that port.
app.listen(PORT,() => {
    console.log(`Server running on http://localhost:${PORT}`);
});