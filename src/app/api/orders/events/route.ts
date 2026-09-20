import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { subscribeOrderChanges } from "@/lib/order-events";

// Never cache or pre-render a stream.
export const dynamic = "force-dynamic";

// Proxies and NAT drop connections that sit silent, so a comment line goes out
// well inside a typical 60s idle timeout.
const HEARTBEAT_MS = 25_000;

// GET: Server-sent events. Emits `changed` whenever any ticket changes; the
// client refetches what it shows. See lib/order-events.ts for why no data rides
// along.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(await hasPermission(session.user.id, "orders.view"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // controller already closed
        }
      };

      const unsubscribe = subscribeOrderChanges(() => send("event: changed\ndata: {}\n\n"));
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", cleanup, { once: true });

      // Tells the browser how long to wait before reconnecting, and flushes the
      // headers so the client sees the connection as open straight away.
      send("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops Next's gzip layer from buffering the stream.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Same reason, for nginx if one is ever put in front.
      "X-Accel-Buffering": "no",
    },
  });
}
