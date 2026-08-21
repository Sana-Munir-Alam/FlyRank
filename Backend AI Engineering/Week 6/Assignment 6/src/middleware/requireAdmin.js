function requireAdmin(req, res, next) {
    if (req.user.user_metadata?.role !== "admin") {
        return res.status(403).json({ error: "Admins only" });
    }
    next();
}
module.exports = requireAdmin;