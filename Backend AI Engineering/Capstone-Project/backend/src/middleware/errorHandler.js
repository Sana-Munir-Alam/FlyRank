function errorHandler(err, req, res, next) {
  console.error(err);

  res.status(503).json({
    error: 'Service Unavailable',
  });
}

module.exports = errorHandler;