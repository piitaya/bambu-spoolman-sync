import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ErrorCode, errorBody, errorMessage } from "./routes/schemas.js";

/**
 * Global error handler: normalizes every thrown error to the same
 * `{ error, code? }` envelope route handlers already return, and makes
 * sure unexpected errors never leak internals to the client.
 */
export function appErrorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err.validation || err.code === "FST_ERR_VALIDATION") {
    req.log.info({ err }, "Request validation failed");
    reply.code(400).send(errorBody(err.message, ErrorCode.Validation));
    return;
  }

  const statusCode = err.statusCode;
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    req.log.info({ err }, "Request failed");
    reply.code(statusCode).send(errorBody(errorMessage(err)));
    return;
  }

  req.log.error({ err }, "Unhandled error");
  reply.code(500).send(errorBody("Internal server error.", ErrorCode.Internal));
}
