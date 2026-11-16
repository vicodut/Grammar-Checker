// Test fixture: a ConnectionHandler with recording fakes for the socket, session and rephraser.
import type { CheckRequest, CoreMessage } from "@gc/protocol";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { ConnectionHandler } from "./connection.handler";
import { coreProofFor, proofFor } from "./handshake-client.fixture";
import type { ServerDeps } from "./server-deps.types";

export const TOKEN = "t".repeat(43);

/** What the fake session and rephraser were asked to do, and the publishers they were given. */
interface Recording {
  updates: CheckRequest[];
  closedFields: string[];
  rephraseCalls: string[];
  disposed: number;
  publish?: (message: CoreMessage) => void;
  publishRephrase?: (message: CoreMessage) => void;
}

const fakeDeps = (rec: Recording, overrides: Partial<ServerDeps>): ServerDeps => ({
  settingsView: () => {
    throw new Error("the WebSocket handler never reads settings");
  },
  createSession: (publish) => {
    rec.publish = publish;
    return {
      update: (request) => rec.updates.push(request),
      close: (fieldId) => rec.closedFields.push(fieldId),
      dispose: () => rec.disposed++,
    };
  },
  addDictionaryTerm: async () => ok(undefined),
  createRephraser: (publish) => {
    rec.publishRephrase = publish;
    return {
      request: async (m) => {
        rec.rephraseCalls.push(`request ${m.fieldId} ${m.requestId}`);
      },
      edited: (fieldId) => rec.rephraseCalls.push(`edited ${fieldId}`),
      cancel: (fieldId) => rec.rephraseCalls.push(`cancel ${fieldId}`),
      dispose: () => rec.rephraseCalls.push("dispose"),
    };
  },
  ...overrides,
});

export const setup = (overrides: Partial<ServerDeps> = {}, helloTimeoutMs = 5000) => {
  const sent: CoreMessage[] = [];
  const closes: number[] = [];
  const logs: string[] = [];
  const rec: Recording = { updates: [], closedFields: [], rephraseCalls: [], disposed: 0 };
  const socket = {
    send: (m: CoreMessage) => sent.push(m),
    close: (code: number) => closes.push(code),
  };
  const logger = new Logger((line) => logs.push(line));
  const deps = fakeDeps(rec, overrides);
  const handler = new ConnectionHandler({ token: TOKEN, helloTimeoutMs }, deps, socket, logger);
  // The challenge is set aside, so `sent` holds what follows it.
  const challenge = sent.shift();
  if (challenge?.type !== "challenge") throw new Error("expected a challenge first");
  return {
    handler,
    challenge,
    /** The valid proof for this connection's challenge. */
    proof: proofFor(TOKEN, challenge.nonce),
    /** The `ready` a valid proof gets back (without models). */
    ready: { type: "ready", proof: coreProofFor(TOKEN, challenge.nonce) } as const,
    sent,
    closes,
    updates: rec.updates,
    closedFields: rec.closedFields,
    logs,
    disposed: () => rec.disposed,
    publish: (m: CoreMessage) => rec.publish?.(m),
    rephraseCalls: rec.rephraseCalls,
    publishRephrase: (m: CoreMessage) => rec.publishRephrase?.(m),
  };
};
