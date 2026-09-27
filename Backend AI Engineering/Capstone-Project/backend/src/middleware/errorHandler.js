function errorHandler(err, req, res, next) {
  console.error(err);
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : (err.message || 'Request failed'),
  });
}

module.exports = errorHandler;