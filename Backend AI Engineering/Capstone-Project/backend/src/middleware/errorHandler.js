function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const candidate = err.statusCode || err.status;
  const statusCode =
    Number.isInteger(candidate) && candidate >= 400 && candidate < 600 ? candidate : 500;

  // Expected client errors (4xx) aren't logged as failures; only real server errors are.
  if (statusCode >= 500) console.error(err);

  let message;
  if (statusCode === 503) message = 'Service unavailable';
  else if (statusCode >= 500) message = 'Internal server error';
  else if (err.type === 'entity.parse.failed') message = 'Malformed JSON in request body';
  else if (err.type === 'entity.too.large') message = 'Request body is too large';
  else message = err.message || 'Request failed';

  const body = { error: message };
  if (err.details) body.details = err.details;

  return res.status(statusCode).json(body);
}

module.exports = errorHandler;