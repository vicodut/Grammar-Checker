import type { ClientMessage } from "@gc/protocol";
import type { BackgroundMessage } from "../shared/port-messages";
import { type ContentPort, ContentPortHub } from "./content-port.hub";

export class FakePort implements ContentPort {
  readonly received: BackgroundMessage[] = [];
  private messageListener: (message: unknown) => void = () => {};
  private disconnectListener: () => void = () => {};
  onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.messageListener = listener;
    },
  };
  onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListener = listener;
    },
  };
  postMessage(message: BackgroundMessage): void {
    this.received.push(message);
  }
  send(message: unknown): void {
    this.messageListener(message);
  }
  disconnect(): void {
    this.disconnectListener();
  }
}

export const setup = () => {
  const toCore: ClientMessage[] = [];
  const hub = new ContentPortHub((message) => toCore.push(message) > 0);
  const a = new FakePort();
  const b = new FakePort();
  hub.attach(a);
  hub.attach(b);
  // Each port gets the current status on attach; tested on its own below.
  a.received.length = 0;
  b.received.length = 0;
  return { hub, toCore, a, b };
};

export const changed = (fieldId: string, version = 1) => ({
  type: "text.changed",
  fieldId,
  version,
  text: "Hi.",
});
