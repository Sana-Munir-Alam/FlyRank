const express = require("express");     // Pulls in the framework.
const app = express();                  // Creates app — the object we attach routes to.
app.use(express.json());                // Middleware that allows the app to parse JSON bodies in requests.

const PORT = 3000;

const tasks = [
    { id: 1, title: "Learn Express", done: false },
    { id: 2, title: "Build CRUD API", done: false },
    { id: 3, title: "Test with curl", done: true }
];

// Add the path and handler (where handler always get the incoming request [req] and the tool we use to respond [res])
app.get("/", (req,res) => {
    res.json({
        name: "Task API",
        version: "1.0",
        endpoints: ["/tasks"]
    });
});

// Returns the complete list of tasks stored in memory.
app.get("/tasks", (req,res) => {
    res.json(tasks);
});

// returns the task with the given id, or a 404 error if not found.
app.get("/tasks/:id", (req,res) => {
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }
    res.json(task);
});

app.post("/tasks", (req,res) => {
    const {title} = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Invalid task data" });
    }
    const newId = tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    const newTask = {
        id: newId,
        title,
        done: false
    };
    tasks.push(newTask);
    res.status(201).json(newTask);
});

// Simple health check route to confirm the server is running.
app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

// Starts the server listening on that port.
app.listen(PORT,() => {
    console.log(`Server running on http://localhost:${PORT}`);
});