type Level = "info" | "warn" | "error";

function emit(level: Level, payload: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (payload: Record<string, unknown>) => emit("info", payload),
  warn: (payload: Record<string, unknown>) => emit("warn", payload),
  error: (payload: Record<string, unknown>) => emit("error", payload),
};

/** Wrap an async Route Handler so unexpected errors return 500 + a logged correlation id. */
export function safeHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      const id = Math.random().toString(36).slice(2, 10);
      logger.error({ event: "handler.error", id, message: (err as Error).message, stack: (err as Error).stack });
      return Response.json({ error: "Internal server error", id }, { status: 500 });
    }
  };
}
