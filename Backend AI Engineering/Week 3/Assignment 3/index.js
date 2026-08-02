require("dotenv").config();
const express = require("express");                 // Pulls in the framework.
const app = express();                              // Creates app — the object we attach routes to.
const swaggerUi = require("swagger-ui-express");    // Pulls in the swagger-ui-express package.
const openapiSpec = require("./openapi.json");      // Pulls in the OpenAPI specification file.
const repository = require("./tasksRepository");    // Pulls in the tasksRepository module.

app.use(express.json());                            // Middleware that allows the app to parse JSON bodies in requests.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));    // Sets up the Swagger UI route to serve the OpenAPI documentation.

const PORT = process.env.PORT || 3000;

// Add the path and handler (where handler always get the incoming request [req] and the tool we use to respond [res])
app.get("/", (req,res) => {
    res.json({
        name: "Task API",
        version: "1.0",
        endpoints: ["/tasks", "/stats", "/reset", "/health"]
    });
});

// Returns the complete list of tasks stored in DB or filters them using query parameters.
app.get("/tasks", async (req,res) => {
    let done, search;
    if (req.query.done !== undefined) {
        if (req.query.done !== "true" && req.query.done !== "false") {
            return res.status(400).json({ error: "Invalid done query. Use true or false." });
        }
        done = req.query.done === "true";   // COnvert to boolean
    }
    if (req.query.search !== undefined) {
        search = req.query.search.trim();
        if (search === "") { 
            return res.status(400).json({error: "Search query cannot be empty."});
        }
    }
    const tasks = await repository.getAllTasks(done, search);
    res.json(tasks);
});

// Returns the task with the given id, or a 404 error if not found.
app.get("/tasks/:id", async (req,res) => {
    const tasks = await repository.getTaskById(req.params.id);
    if (!tasks) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.json(tasks);
});

// Returns statistics about the tasks currently stored in the database.
app.get("/stats", async (req,res) => {
    const stats = await repository.getTaskStats();
    res.json(stats);
});

// Creates a new task with the given title and stores it in the SQLite database.
app.post("/tasks", (req,res) => {
    const {title} = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Invalid task data" });
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
        return res.status(400).json({ error: "Invalid task data" });
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

// Resets the database by dropping the tasks table and reinitializing it.
app.post("/reset", async (req, res) => {
    await repository.resetDatabase();
    res.status(204).send();
});

// Simple health check route to confirm the server is running.
app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

// Initialize the database first and only then start the server
repository.initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
    });