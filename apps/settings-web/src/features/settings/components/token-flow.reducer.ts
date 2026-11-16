/** The token card's state: shown or copied, and the rotate confirmation and its outcome. */
export type TokenFlow = {
  readonly shown: boolean;
  readonly copied: boolean;
  readonly confirming: boolean;
  readonly rotated: boolean;
};

export type TokenFlowEvent =
  | { type: "toggleShown" }
  | { type: "copied" }
  | { type: "copyRefused" }
  | { type: "ask" }
  | { type: "cancel" }
  | { type: "rotateStarted" }
  | { type: "rotateFinished"; done: boolean };

export const initialTokenFlow: TokenFlow = {
  shown: false,
  copied: false,
  confirming: false,
  rotated: false,
};

export const tokenFlowReducer = (state: TokenFlow, event: TokenFlowEvent): TokenFlow => {
  switch (event.type) {
    case "toggleShown":
      return { ...state, shown: !state.shown };
    case "copied":
      return { ...state, copied: true };
    // Clipboard refused: show it so it can be selected by hand.
    case "copyRefused":
      return { ...state, shown: true };
    case "ask":
      return { ...state, confirming: true };
    case "cancel":
      return { ...state, confirming: false };
    case "rotateStarted":
      return { ...state, confirming: false, copied: false };
    case "rotateFinished":
      // A new token is shown once it exists; a failed rotation changes nothing else.
      return { ...state, rotated: event.done, shown: event.done ? true : state.shown };
  }
};
