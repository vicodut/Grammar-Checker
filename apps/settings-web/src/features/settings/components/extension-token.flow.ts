import { useState } from "react";

/** The token card's state: shown or copied, and the rotate confirmation and its outcome. */
export const useTokenFlow = (token: string, onRotate: () => Promise<boolean>) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rotated, setRotated] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setShown(true); // Clipboard refused: show it so it can be selected by hand.
    }
  };

  const rotate = async () => {
    setConfirming(false);
    setCopied(false);
    const done = await onRotate();
    setRotated(done);
    if (done) setShown(true);
  };

  return {
    shown,
    copied,
    confirming,
    rotated,
    toggleShown: () => setShown(!shown),
    ask: () => setConfirming(true),
    cancel: () => setConfirming(false),
    copy,
    rotate,
  };
};
