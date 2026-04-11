import type { Context } from "hono";

/**
 * SSE helper for Hono.
 *
 * Returns a Response whose body is a ReadableStream. The caller gets
 * back a `send` function to push named events and a `close` function
 * to end the stream.
 */
export function sseResponse(c: Context): {
  response: Response;
  send: (event: string, data: unknown) => void;
  close: () => void;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      // Send an SSE comment every 15s to keep the connection alive
      // while Claude is thinking (no stdout). SSE comments (lines
      // starting with `:`) are ignored by EventSource clients and
      // by our manual parser, but they prevent idle-timeout kills
      // at every layer (Bun fetch, OS TCP keepalive, proxies).
      heartbeatTimer = setInterval(() => {
        if (!controller) return;
        try {
          controller.enqueue(encoder.encode(":keepalive\n\n"));
        } catch {
          // Stream already closed — timer will be cleared in close().
        }
      }, 15_000);
    },
    cancel() {
      controller = null;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });

  function send(event: string, data: unknown): void {
    if (!controller) return;
    const payload =
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(payload));
  }

  function close(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (!controller) return;
    try {
      controller.close();
    } catch {
      // Already closed — ignore.
    }
    controller = null;
  }

  return { response, send, close };
}
