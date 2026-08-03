require("dotenv").config();
const express = require("express");                 // Pulls in the framework.
const app = express();                              // Creates app — the object we attach routes to.
const swaggerUi = require("swagger-ui-express");    // Pulls in the swagger-ui-express package.
const openapiSpec = require("./openapi.json");      // Pulls in the OpenAPI specification file.
const repository = require("./tasksRepository");    // Pulls in the tasksRepository module.
const supabase = require("./supabase");             // Pulls in the supabase module for database operations.

// const { createClient } = require("redis");
// const redisClient = createClient({
//     url: "redis://redis:6379",
//     socket: { reconnectStrategy: () => false } // Disable automatic reconnection
// });
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
app.post("/tasks", async (req,res) => {
    const {title} = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Invalid task data" });
    }
    const insertTask = await repository.createTasks(title.trim()); // Insert new task into DB
    res.status(201).json(insertTask);
});

// Updates the task with the given id, or returns a 404 error if not found.
app.put("/tasks/:id", async (req, res) => {
    const { title, done } = req.body;
    if ((title !== undefined && (typeof title !== "string" || title.trim() === "")) || (done !== undefined && typeof done !== "boolean")) {
        return res.status(400).json({ error: "Invalid task data" });
    }

    const existingTask = await repository.getTaskById(req.params.id);
    if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
    }
    // Update the task using the repository function, passing in the existing values if title or done are not provided
    const updatedTask = await repository.updateTask(req.params.id, title ?? existingTask.title, done ?? existingTask.done);
    res.json(updatedTask);
});

// Deletes the task with the given id, or returns a 404 error if not found.
app.delete("/tasks/:id", async (req,res) => {
    const deleteTask = await repository.deleteTask(req.params.id);
    if(!deleteTask){  // If no rows were deleted, the task with the given id was not found
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.status(204).send();
});

// Resets the database by dropping the tasks table and reinitializing it.
app.post("/reset", async (req, res) => {
    const tasks = await repository.resetDatabase();
    res.json({ message: "Tasks have been reset.", tasks });
});

// Simple health check route to confirm the server is running.
app.get("/health", async (req, res) => {
    try {
        await repository.checkDatabaseHealth();
        res.json({ status: "ok", db: "ok" });
    } catch (err) {
        res.status(503).json({ status: "ok", db: "unreachable" });
    }
});

// redisClient.on("error", (err) => {
//     console.error("Redis connection error:", err.message);
// });

// Initialise the db first, then connect to Redis, then start the server.
// repository.initializeDatabase()
//     .then(() => redisClient.connect())
//     .then(() => redisClient.ping())
//     .then((pong) => {
//         console.log("Redis says:", pong); // should log "PONG"
//         app.listen(PORT, () => {
//             console.log(`Server running on http://localhost:${PORT}`);
//         });
//     })
//     .catch((err) => {
//         console.error("Startup failed:", err);
//     });

// Initialize the database first and only then start the server
repository.initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log("Server running and connected to Supabase");
        });
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
    });