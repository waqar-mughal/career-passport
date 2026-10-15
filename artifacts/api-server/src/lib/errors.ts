import type { ErrorRequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  req.log?.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "Unhandled API error",
  );
  res.status(500).json({ error: "The request could not be completed" });
};
