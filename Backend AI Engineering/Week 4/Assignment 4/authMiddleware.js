const supabase = require("./supabase");

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid Authorization header" });
        }
        const accessToken = authHeader.split(" ")[1];   // Extract the token from the header [0] = bearer [1] = token
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (error) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        req.user = data.user;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = authenticate;