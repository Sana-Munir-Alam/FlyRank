function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    req[target] = result.data;
    next();
  };
}

module.exports = validate;