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

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      controller = null;
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
