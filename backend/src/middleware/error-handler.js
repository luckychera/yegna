// PostgreSQL rejected a value's format (for example a malformed UUID in a URL).
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  let code = typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR';
  let message = error.message;

  if (error.code === PG_INVALID_TEXT_REPRESENTATION) {
    statusCode = 400;
    code = 'INVALID_INPUT';
    message = 'One of the provided values has an invalid format';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'The request body is not valid JSON';
  } else if (statusCode === 500) {
    code = 'INTERNAL_SERVER_ERROR';
  }

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  } else {
    console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${statusCode} ${code}`);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: statusCode >= 500 ? 'An unexpected error occurred' : message,
    },
  });
}

module.exports = errorHandler;
