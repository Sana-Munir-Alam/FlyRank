const bcrypt = require('bcrypt');
const authRepository = require('./authRepository');
const SALT_ROUNDS = 12;

async function signup({ tenantName, email, password }) {
  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    const error = new Error('Email is already registered');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return authRepository.createTenantAndUser({
    tenantName,
    email,
    passwordHash,
  });
}

async function login({ email, password }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    const passwordMatches = await bcrypt.compare( password, user.password_hash );
    if (!passwordMatches) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    return {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        tenantName: user.tenant_name,
    };
}

async function getCurrentUser(userId) {
    return authRepository.findUserById(userId);
}

module.exports = {
    signup,
    login,
    getCurrentUser,
};