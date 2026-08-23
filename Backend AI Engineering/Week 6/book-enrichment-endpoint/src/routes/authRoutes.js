const express = require("express");
const router = express.Router();

const supabase = require("../../services/supabase");
const authenticate = require("../middleware/authMiddleware");

router.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            return res.status(error.status || 400).json({ error: error.message });
        }
        res.status(201).json(data.user);
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            return res.status(401).json({ error: "Invalid login credentials" });
        }
        res.status(200).json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/refresh", async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            return res.status(400).json({ error: "Refresh token required" });
        }
        const { data, error } = await supabase.auth.refreshSession({ refresh_token });
        if (error) {
            return res.status(401).json({ error: "Invalid or expired refresh token" });
        }
        res.status(200).json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });
    } catch (err) {
        console.error("Refresh error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/logout", authenticate, async (req, res) => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.status(204).send();
});

module.exports = router;