const express = require("express");
const app = express();
app.use(express.json());

const PORT = 3000;

app.get("/health", (req, res) => {
  res.status(200).json({status: "ok"});
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});