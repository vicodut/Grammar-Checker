// The sections of the settings page: its header and status, then the profile and model panels.
import type { FeatureProfiles, ProfileSave, SettingsView } from "@gc/protocol";
import { Alert, AlertDescription, Button } from "@gc/ui";
import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { errorText } from "../../lib/error-text.util";
import type { useOllamaRuntime } from "../models";
import { LocalModelsPanel, OllamaPanel } from "../models";
import type { useProfileProbe } from "../profiles";
import { FeatureProfilesPanel, ProfileForm, ProfileList } from "../profiles";
import { StatisticsPanel } from "../statistics";
import { ExtensionToken } from "./components/extension-token";
import { FeatureSettings } from "./components/feature-settings";
import type { PageDispatch } from "./settings-page.actions";
import type { SettingsPageState } from "./settings-page.reducer";

type ReadyState = Extract<SettingsPageState, { phase: "ready" }>;

export interface PageActions
  extends Pick<ReturnType<typeof useOllamaRuntime>, "onPull" | "onCancelPull"> {
  onSave: (id: string | null, input: ProfileSave) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onFeatures: (features: FeatureProfiles) => void;
  onStartOllama: () => void;
  onRotateToken: () => Promise<boolean>;
}

/** The model the Ollama panel is about: the first feature's model served by Ollama. */
const ollamaModel = (view: SettingsView): string | null => {
  const onOllama = [view.check, view.rephrase].find((f) => f.baseUrl.value?.includes(":11434"));
  return (onOllama ?? view.check).model.value;
};

/** The page title, and the loading and error notices above the panels. */
export const PageStatus = ({
  state,
  dispatch,
}: {
  state: SettingsPageState;
  dispatch: PageDispatch;
}) => (
  <>
    <header className="flex flex-col gap-1">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">Grammar Checker settings</h1>
      <p className="m-0 text-muted-foreground">
        The model each feature uses, and where each value comes from.
      </p>
    </header>
    {state.phase === "loading" && (
      <p className="m-0 flex items-center gap-2 text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Loading…
      </p>
    )}
    {state.phase === "error" && (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertDescription>
          <p className="m-0">{errorText(state.error)}</p>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: "reload" })}>
            <RotateCw aria-hidden="true" /> Try again
          </Button>
        </AlertDescription>
      </Alert>
    )}
  </>
);

/** The saved profiles, the feature assignments and the Ollama runtime. */
export const ProfileSection = ({
  ready,
  dispatch,
  actions,
}: {
  ready: ReadyState;
  dispatch: PageDispatch;
  actions: PageActions;
}) => (
  <>
    <ProfileList
      profiles={ready.profiles}
      busy={ready.busy}
      dispatch={dispatch}
      onActivate={actions.onActivate}
      onDelete={actions.onDelete}
    />
    <FeatureProfilesPanel
      profiles={ready.profiles}
      busy={ready.busy}
      onChange={actions.onFeatures}
    />
    {ready.notice && (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertDescription>{errorText(ready.notice)}</AlertDescription>
      </Alert>
    )}
    {ready.runtime?.ollama.inUse && (
      <OllamaPanel
        ollama={ready.runtime.ollama}
        model={ollamaModel(ready.view)}
        busy={ready.busy}
        onStart={actions.onStartOllama}
        onPull={actions.onPull}
        onCancelPull={actions.onCancelPull}
      />
    )}
  </>
);

/** The local models, the profile form, the settings in effect, statistics and the extension token. */
export const ModelSection = ({
  ready,
  token,
  dispatch,
  actions,
  probe,
}: {
  ready: ReadyState;
  token: string | null;
  dispatch: PageDispatch;
  actions: PageActions;
  probe: ReturnType<typeof useProfileProbe>;
}) => (
  <>
    <LocalModelsPanel token={token} />
    {ready.form && (
      <ProfileForm
        form={ready.form}
        busy={ready.busy}
        dispatch={dispatch}
        onSave={actions.onSave}
        {...probe}
      />
    )}
    <FeatureSettings title="Check" view={ready.view.check} />
    <FeatureSettings title="Rephrase" view={ready.view.rephrase} />
    {token && <StatisticsPanel token={token} />}
    {token && <ExtensionToken token={token} busy={ready.busy} onRotate={actions.onRotateToken} />}
  </>
);
