function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required',});
    }

    req.user = {
        id: req.session.userId,
        tenantId: req.session.tenantId,
    };
    next();
}

module.exports = {
    requireAuth,
};