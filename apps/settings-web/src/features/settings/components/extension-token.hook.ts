import { useReducer } from "react";
import { initialTokenFlow, tokenFlowReducer } from "./token-flow.reducer";

/** The token card's state, with the actions the card calls. The transitions are in the reducer. */
export const useTokenFlow = (token: string, onRotate: () => Promise<boolean>) => {
  const [flow, dispatch] = useReducer(tokenFlowReducer, initialTokenFlow);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      dispatch({ type: "copied" });
    } catch {
      dispatch({ type: "copyRefused" });
    }
  };

  const rotate = async () => {
    dispatch({ type: "rotateStarted" });
    const done = await onRotate();
    dispatch({ type: "rotateFinished", done });
  };

  return {
    ...flow,
    toggleShown: () => dispatch({ type: "toggleShown" }),
    ask: () => dispatch({ type: "ask" }),
    cancel: () => dispatch({ type: "cancel" }),
    copy,
    rotate,
  };
};
