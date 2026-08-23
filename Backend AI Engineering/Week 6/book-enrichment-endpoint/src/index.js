require("dotenv").config();
const express = require("express");                             // Pulls in the framework.
const app = express();                                          // Creates app, the object we attach routes to.
const swaggerUi = require("swagger-ui-express");                // Pulls in the swagger-ui-express package.
const openapiSpec = require("../openapi.json");                 // Pulls in the OpenAPI specification file.
const repository = require("../database/tasksRepository");      // Pulls in the tasksRepository module.

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const llmRoutes = require("./routes/llmRoutes");

const { createClient } = require("redis");
const PORT = process.env.PORT || 3000;


app.use(express.json());                            // Middleware that allows the app to parse JSON bodies in requests.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));    // Swagger UI route to serve the OpenAPI documentation.

// Routes
app.use("/auth", authRoutes);
app.use("/", userRoutes);
app.use("/", taskRoutes);
app.use("/llm", llmRoutes);

// Add the path and handler (where handler always get the incoming request [req] and the tool we use to respond [res])
// Root endpoint
app.get("/", (req,res) => {
    res.json({
        name: "Task API",
        version: "1.0",
        endpoints: ["/tasks", "/stats", "/reset", "/health"]
    });
});

// Redis
const redisClient = createClient({
    url: "redis://redis:6379",
    socket: { reconnectStrategy: () => false } // Disable automatic reconnection
});

redisClient.on("error", (err) => {
    console.error("Redis connection error:", err.message);
});

// Initialise the db first, then connect to Redis, then start the server.
repository.initializeDatabase()
    .then(() => redisClient.connect())
    .then(() => redisClient.ping())
    .then((pong) => {
        console.log("Redis says:", pong); // should log "PONG"
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log("Server running and connected to Supabase");
        });
    })
    .catch((err) => {
        console.error("Startup failed:", err);
    });