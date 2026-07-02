import { vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";

export function createTestLogger(): FastifyBaseLogger {
  const child = vi.fn();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    level: "silent",
    child,
  };
  child.mockReturnValue(logger);
  return logger as unknown as FastifyBaseLogger;
}
