import { useEffect, useReducer, useState } from "react";
import { useOllamaRuntime } from "../../models";
import { useProfileProbe } from "../../profiles";
import {
  loadAll,
  rotateTokenFor,
  startOllamaFor,
  useProfileActions,
} from "../settings-page.actions";
import { initialState, settingsPageReducer } from "../settings-page.reducer";
import {
  ModelSection,
  type PageActions,
  PageStatus,
  ProfileSection,
} from "../settings-page.sections";

/** The model connection: the saved profiles, the one in use, and where each value comes from. */
type Props = {
  /** From the page link, held in memory only; a rotation replaces it for this tab. */
  token: string | null;
};

export const SettingsPage = ({ token: initialToken }: Props) => {
  const [state, dispatch] = useReducer(settingsPageReducer, initialState);
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    if (state.phase !== "loading") return;
    if (!token) return dispatch({ type: "failed", error: "no_token" });
    void loadAll(token).then(dispatch);
  }, [state.phase, token]);

  const runtime = state.phase === "ready" ? state.runtime : null;
  const ollama = useOllamaRuntime(runtime, token, dispatch);
  const probe = useProfileProbe(token, state.phase === "ready" ? state.form : null, dispatch);
  const profiles = useProfileActions(token, state, dispatch);
  const actions: PageActions = {
    ...profiles,
    ...ollama,
    onStartOllama: () => void startOllamaFor(token, dispatch),
    onRotateToken: () => rotateTokenFor(token, dispatch, setToken),
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 text-sm">
      <PageStatus state={state} dispatch={dispatch} />
      {state.phase === "ready" && (
        <>
          <ProfileSection ready={state} dispatch={dispatch} actions={actions} />
          <ModelSection
            ready={state}
            token={token}
            dispatch={dispatch}
            actions={actions}
            probe={probe}
          />
        </>
      )}
    </main>
  );
};
