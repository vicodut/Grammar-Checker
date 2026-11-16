import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gc/ui";
import { Check, CircleCheck, Copy, Eye, EyeOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useTokenFlow } from "./extension-token.flow";

type Props = {
  token: string;
  busy: boolean;
  /** Rotates the token; true once the page holds the new one. */
  onRotate: () => Promise<boolean>;
};

const MASK = "•".repeat(24);

type ConfirmProps = { busy: boolean; onYes: () => void; onNo: () => void };

/** Asked inline before rotating: connected extensions disconnect until the new token is pasted. */
const ConfirmRotate = ({ busy, onYes, onNo }: ConfirmProps) => (
  <Alert variant="warning" role="alert">
    <TriangleAlert aria-hidden="true" />
    <AlertDescription className="gap-3">
      <p className="m-0 text-foreground">
        Connected extensions will disconnect until you paste the new token into their options page.
        Generate a new token?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={onYes}>
          Generate new token
        </Button>
        <Button variant="outline" size="sm" onClick={onNo}>
          Cancel
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

type RowProps = {
  token: string;
  shown: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
};

const TokenRow = ({ token, shown, copied, onToggle, onCopy }: RowProps) => (
  <div className="flex items-center gap-2">
    <code className="min-w-0 flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]">
      {shown ? token : MASK}
    </code>
    <Button variant="outline" size="sm" onClick={onToggle}>
      {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      {shown ? "Hide" : "Show"}
    </Button>
    <Button variant="outline" size="sm" onClick={onCopy}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  </div>
);

type RotateProps = {
  busy: boolean;
  rotated: boolean;
  confirming: boolean;
  onAsk: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

/** The generate-token button, its confirmation, and the notice once a new token is in place. */
const RotateSection = ({ busy, rotated, confirming, onAsk, onConfirm, onCancel }: RotateProps) => (
  <>
    {rotated && (
      <Alert variant="success" role="status">
        <CircleCheck aria-hidden="true" />
        <AlertDescription>
          New token generated. Paste it into the extension's options page to reconnect it.
        </AlertDescription>
      </Alert>
    )}
    {confirming ? (
      <ConfirmRotate busy={busy} onYes={onConfirm} onNo={onCancel} />
    ) : (
      <Button variant="outline" className="self-start" disabled={busy} onClick={onAsk}>
        <RefreshCw aria-hidden="true" /> Generate new token…
      </Button>
    )}
  </>
);

/**
 * The install token the Chrome extension needs. The user copies it here and pastes it into the
 * extension's options page; nothing sends it to the extension. Hidden until "Show".
 */
export const ExtensionToken = ({ token, busy, onRotate }: Props) => {
  const flow = useTokenFlow(token, onRotate);
  return (
    <Card aria-labelledby="extension-token">
      <CardHeader>
        <CardTitle id="extension-token" className="m-0 text-base">
          Chrome extension
        </CardTitle>
        <CardDescription className="m-0">
          Copy this token and paste it into the extension's options page to connect it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TokenRow
          token={token}
          shown={flow.shown}
          copied={flow.copied}
          onToggle={flow.toggleShown}
          onCopy={() => void flow.copy()}
        />
        <RotateSection
          busy={busy}
          rotated={flow.rotated}
          confirming={flow.confirming}
          onAsk={flow.ask}
          onConfirm={() => void flow.rotate()}
          onCancel={flow.cancel}
        />
      </CardContent>
    </Card>
  );
};
