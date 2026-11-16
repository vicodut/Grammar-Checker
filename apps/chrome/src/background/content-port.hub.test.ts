import { describe, expect, test } from "bun:test";
import { changed, setup } from "./content-port.hub.fixture";

describe("ContentPortHub", () => {
  test("prefixes field ids with the port id", () => {
    const { toCore, a, b } = setup();
    a.send(changed("f1"));
    b.send(changed("f1"));
    b.send({ type: "field.closed", fieldId: "f1" });
    expect(toCore.map((m) => ("fieldId" in m ? m.fieldId : ""))).toEqual([
      "p1/f1",
      "p2/f1",
      "p2/f1",
    ]);
  });

  test("forwards text.edit with the prefix and routes resync_needed back", () => {
    const { hub, toCore, a } = setup();
    const edit = { fieldId: "f1", version: 2, baseVersion: 1, start: 0, deleteCount: 0 };
    a.send({ type: "text.edit", ...edit, insert: "x" });
    expect(toCore).toEqual([{ type: "text.edit", ...edit, fieldId: "p1/f1", insert: "x" }]);
    hub.fromCore({ type: "error", code: "resync_needed", fieldId: "p1/f1" });
    expect(a.received).toEqual([{ type: "error", code: "resync_needed", fieldId: "f1" }]);
  });

  test("routes issues and errors to the owning port with the prefix stripped", () => {
    const { hub, a, b } = setup();
    a.send(changed("f1"));
    b.send(changed("f1"));
    hub.fromCore({ type: "issues", fieldId: "p2/f1", version: 1, issues: [] });
    hub.fromCore({ type: "error", code: "provider_timeout", fieldId: "p1/f1" });
    expect(a.received).toEqual([{ type: "error", code: "provider_timeout", fieldId: "f1" }]);
    expect(b.received).toEqual([{ type: "issues", fieldId: "f1", version: 1, issues: [] }]);
  });

  test("drops replies for closed or unknown fields", () => {
    const { hub, a } = setup();
    a.send(changed("f1"));
    a.send({ type: "field.closed", fieldId: "f1" });
    hub.fromCore({ type: "issues", fieldId: "p1/f1", version: 1, issues: [] });
    hub.fromCore({ type: "issues", fieldId: "p7/f1", version: 1, issues: [] });
    hub.fromCore({ type: "error", code: "message_invalid" });
    expect(a.received).toEqual([]);
  });

  test("closes a port's open fields when it disconnects", () => {
    const { toCore, a } = setup();
    a.send(changed("f1"));
    a.send(changed("f2"));
    toCore.length = 0;
    a.disconnect();
    expect(toCore).toEqual([
      { type: "field.closed", fieldId: "p1/f1" },
      { type: "field.closed", fieldId: "p1/f2" },
    ]);
  });

  test("ignores invalid content messages and forbids handshake messages from content", () => {
    const { toCore, a } = setup();
    a.send({ type: "hello", token: "stolen" });
    a.send({ type: "proof", nonce: "a".repeat(64), proof: "b".repeat(64) });
    a.send({ type: "text.changed", fieldId: "f1", version: -1, text: "" });
    a.send("garbage");
    expect(toCore).toEqual([]);
  });
});
