const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

router.get("/public/info", (req,res) => {
    res.json({ message: "This is a public endpoint. No authentication required."});
});

router.get("/protected/profile", authenticate, (req, res) => {
    res.json({ id: req.user.id, email: req.user.email, created_at: req.user.created_at });
});

router.get("/protected/dashboard", authenticate, (req, res) => {
    res.json({ 
        message: `Welcome to your dashboard, ${req.user.email}!`,
        user: { id: req.user.id, email: req.user.email }
    });
});

router.get("/protected/admin", authenticate, requireAdmin, (req, res) => {
    res.json({ message: "Welcome, admin." });
});

module.exports = router;