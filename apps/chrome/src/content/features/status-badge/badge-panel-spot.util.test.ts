import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { placePanelSpot } from "./badge-panel-spot.util";

// Only the panel's height and inline style are read, so a plain object stands in for the element.
const panel = (offsetHeight: number, style: Record<string, string> = {}) =>
  ({ offsetHeight, style: { right: "", top: "", bottom: "", ...style } }) as unknown as HTMLElement;

const viewport = { width: 800, height: 600 };

describe("placePanelSpot", () => {
  const saved = { innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight };

  beforeEach(() => {
    Object.assign(globalThis, { innerWidth: viewport.width, innerHeight: viewport.height });
  });

  afterEach(() => {
    Object.assign(globalThis, saved);
  });

  test("opens above the badge, right-aligned with it, when the panel fits above", () => {
    const el = panel(100);
    placePanelSpot(el, { left: 500, top: 300 });
    // Right edge: 800 - (500 + 16) = 284. Bottom: 600 - 300 + 6 = 306.
    expect(el.style.right).toBe("284px");
    expect(el.style.bottom).toBe("306px");
    expect(el.style.top).toBe("");
  });

  test("opens below the badge when there is no room above, clearing the stale bottom", () => {
    const el = panel(100, { bottom: "10px" });
    placePanelSpot(el, { left: 500, top: 50 });
    // 50 - 6 = 44 is short of the 100px panel, so it goes below: top = 50 + 16 + 6 = 72.
    expect(el.style.top).toBe("72px");
    expect(el.style.bottom).toBe("");
    expect(el.style.right).toBe("284px");
  });

  test("a badge at the far right keeps the right edge at zero, never negative", () => {
    const el = panel(10);
    placePanelSpot(el, { left: 790, top: 300 });
    expect(el.style.right).toBe("0px");
  });
});
