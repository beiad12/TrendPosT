import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express 4 route handler so a rejected promise is passed to
 * `next()` (and handled by the app's error middleware) instead of becoming
 * an unhandled promise rejection that crashes the whole process — Express 4
 * does not do this automatically for async handlers (unlike Express 5).
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
