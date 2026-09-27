const authService = require('./authService');
const { issueCsrfToken } = require('../../middleware/csrf');

async function signup(req, res, next) {
    try {
        const { tenantName, email, password } = req.body;
        if ( typeof tenantName !== 'string' || typeof email !== 'string' || typeof password !== 'string' ) {
            return res.status(400).json({ error: 'tenantName, email and password are required', });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || password.length < 8) {
            return res.status(400).json({ error: 'Invalid signup data', });
        }

        const result = await authService.signup({
            tenantName: tenantName.trim(),
            email: normalizedEmail,
            password,
        });

       req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.userId = result.user.id;
            req.session.tenantId = result.user.tenant_id;
            issueCsrfToken(req, res);
            return res.status(201).json({
                user: { id: result.user.id, email: result.user.email, },
                tenant: { id: result.tenant.id, name: result.tenant.name, },
            });
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email is already registered', });
        }
        next(error);
    }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if ( typeof email !== 'string' || typeof password !== 'string' ) {
      return res.status(400).json({ error: 'Email and password are required', });
    }

    const user = await authService.login({ email: email.trim().toLowerCase(), password, });

    req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.userId = user.id;
        req.session.tenantId = user.tenantId;
        issueCsrfToken(req, res); 
        return res.status(200).json({
            user: { id: user.id, email: user.email, },
            tenant: { id: user.tenantId, name: user.tenantName,
            },
        });
    });
  } catch (error) {
    next(error);
  }
}

function logout(req, res, next) {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie('connect.sid');
        res.clearCookie('csrf_token');    
        return res.status(200).json({ message: 'Logged out successfully', });
    });
}

async function me(req, res, next) {
    try {
        const user = await authService.getCurrentUser(req.user.id);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required', });
        }

        return res.status(200).json({
            user: { id: user.id, email: user.email,},
            tenant: { id: user.tenant_id, name: user.tenant_name,},
        });
    } catch (error) {
        next(error);
  }
}

module.exports = {
    signup,
    login,
    logout,
    me,
};