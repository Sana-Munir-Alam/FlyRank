const express = require("express");
const router = express.Router();

const repository = require("../../database/tasksRepository");

// Returns the complete list of tasks stored in DB or filters them using query parameters.
router.get("/tasks", async (req,res) => {
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
router.get("/tasks/:id", async (req,res) => {
    const tasks = await repository.getTaskById(req.params.id);
    if (!tasks) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.json(tasks);
});

// Returns statistics about the tasks currently stored in the database.
router.get("/stats", async (req,res) => {
    const stats = await repository.getTaskStats();
    res.json(stats);
});

// Creates a new task with the given title and stores it in the SQLite database.
router.post("/tasks", async (req,res) => {
    const {title} = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Invalid task data" });
    }
    const insertTask = await repository.createTasks(title.trim()); // Insert new task into DB
    res.status(201).json(insertTask);
});

// Updates the task with the given id, or returns a 404 error if not found.
router.put("/tasks/:id", async (req, res) => {
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
router.delete("/tasks/:id", async (req,res) => {
    const deleteTask = await repository.deleteTask(req.params.id);
    if(!deleteTask){  // If no rows were deleted, the task with the given id was not found
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.status(204).send();
});

// Resets the database by dropping the tasks table and reinitializing it.
router.post("/reset", async (req, res) => {
    const tasks = await repository.resetDatabase();
    res.json({ message: "Tasks have been reset.", tasks });
});

// Simple health check route to confirm the server is running.
router.get("/health", async (req, res) => {
    try {
        await repository.checkDatabaseHealth();
        res.json({ status: "ok", db: "ok" });
    } catch (err) {
        res.status(503).json({ status: "ok", db: "unreachable" });
    }
});

module.exports = router;