const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function statusColor(code) {
  if (code >= 500) return COLORS.red;
  if (code >= 400) return COLORS.yellow;
  if (code >= 300) return COLORS.cyan;
  return COLORS.green;
}

function methodColor(method) {
  const map = { GET: COLORS.cyan, POST: COLORS.green, PATCH: COLORS.yellow, PUT: COLORS.yellow, DELETE: COLORS.red };
  return map[method] || COLORS.white;
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const time = `${ms}ms`;

    const methodStr = `${methodColor(method)}${method.padEnd(6)}${COLORS.reset}`;
    const statusStr = `${statusColor(status)}${status}${COLORS.reset}`;
    const timeStr = `${COLORS.dim}${time}${COLORS.reset}`;
    const urlStr = `${COLORS.white}${originalUrl}${COLORS.reset}`;

    console.log(`${methodStr} ${urlStr} → ${statusStr} ${timeStr}`);
  });

  next();
}

export function errorLogger(err, req, res, next) {
  const { method, originalUrl } = req;
  console.error(
    `${COLORS.red}ERROR${COLORS.reset} ${method} ${originalUrl}\n` +
    `  ${COLORS.dim}${err.stack || err.message}${COLORS.reset}`
  );
  next(err);
}
