// Middleware to validate query parameters using Zod
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    req.validatedQuery = result.data;
    next();
  };
}

module.exports = validateQuery;