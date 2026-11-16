import { type badgePosition, panelPlacement } from "./badge-position.util";

/** Puts the open panel beside the badge, inside the viewport. */
export const placePanelSpot = (
  el: HTMLElement,
  position: ReturnType<typeof badgePosition>,
): void => {
  const viewport = { width: innerWidth, height: innerHeight };
  const spot = panelPlacement(position, viewport, el.offsetHeight);
  const style = el.style;
  style.right = `${spot.right}px`;
  style.top = spot.top === undefined ? "" : `${spot.top}px`;
  style.bottom = spot.bottom === undefined ? "" : `${spot.bottom}px`;
};
