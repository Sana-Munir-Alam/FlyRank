const express = require("express");     // Pulls in the framework.
const app = express();                  // Creates app — the object we attach routes to.

const PORT = 3000;

// Add the path and handler (where handler always get the incoming request [req] and the tool we use to respond [res])
app.get("/", (req,res) => {
    res.json({ message: "Hello from Express!" });
});

// Starts the server listening on that port.
app.listen(PORT,() => {
    console.log(`Server running on http://localhost:${PORT}`);
});