// middlewares/requestLogger.js
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log(
      `[API HIT] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Time: ${duration}ms`
    );
  });

  next();
};