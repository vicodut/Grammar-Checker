// A minimal Chrome DevTools Protocol client over Bun's built-in WebSocket.

interface Waiter {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface CdpReply {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

export class CdpSession {
  private nextId = 1;
  private readonly waiting = new Map<number, Waiter>();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => this.receive(String(event.data)));
  }

  static connect(url: string): Promise<CdpSession> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new CdpSession(socket)), { once: true });
      socket.addEventListener("error", () => reject(new Error("cdp.connect_failed")), {
        once: true,
      });
    });
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: (value) => resolve(value as T), reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Runs a JavaScript expression in the page and returns its JSON-compatible value. */
  async evaluate<T>(expression: string): Promise<T> {
    const reply = await this.send<{ result: { value: T }; exceptionDetails?: unknown }>(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
    );
    if (reply.exceptionDetails) throw new Error("cdp.evaluate_failed");
    return reply.result.value;
  }

  close(): void {
    this.socket.close();
  }

  private receive(text: string): void {
    const reply = JSON.parse(text) as CdpReply;
    if (reply.id === undefined) return;
    const waiter = this.waiting.get(reply.id);
    if (!waiter) return;
    this.waiting.delete(reply.id);
    if (reply.error) waiter.reject(new Error(`cdp.${reply.error.message}`));
    else waiter.resolve(reply.result);
  }
}
