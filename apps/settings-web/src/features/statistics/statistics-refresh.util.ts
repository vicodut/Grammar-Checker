/** A page event that may mean the numbers have moved on: the window gained focus, or the page is shown again. */
export type RefreshEvent =
  | { type: "focus" }
  | { type: "visibility"; state: DocumentVisibilityState };

/** The statistics change while the page is closed or in the background, so coming back refetches them. */
export const shouldRefetchStatistics = (event: RefreshEvent): boolean =>
  event.type === "focus" || event.state === "visible";
