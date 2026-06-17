/* Minimal Server-Sent Events helper for Netlify Functions (v2, Web Response).

   Returns a streaming Response whose body is driven by `producer`. The producer
   receives a `send(obj)` callback that serializes one JSON event per SSE frame.
   Any thrown error is surfaced as a final `{ type: "error" }` event so the
   client always sees a terminal frame. */
export function sseResponse(
  producer: (send: (event: unknown) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await producer(send);
      } catch (e) {
        send({ type: "error", message: String((e as Error).message || e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering so frames flush immediately.
      "x-accel-buffering": "no",
    },
  });
}
