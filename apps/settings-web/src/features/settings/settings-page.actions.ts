// The settings page's actions. Each runs one change, then reloads the views it affects.
import type { FeatureProfiles, ProfileSave, ProfilesView } from "@gc/protocol";
import { useCallback } from "react";
import {
  type ApiResult,
  activateProfile,
  deleteMovingToLocal,
  deleteProfile,
  fetchProfiles,
  fetchRuntime,
  fetchSettings,
  rotateToken,
  saveProfile,
  setFeatureProfiles,
  startOllama,
} from "../../lib/settings-api.client";
import type { SettingsPageEvent } from "../../lib/settings-page.model";
import { moveToLocal, profileUses } from "../profiles";
import type { SettingsPageState } from "./settings-page.reducer";

export type PageDispatch = (event: SettingsPageEvent) => void;

/** The settings in effect and the saved profiles, read together. */
export const loadAll = async (token: string): Promise<SettingsPageEvent> => {
  const [view, profiles, runtime] = await Promise.all([
    fetchSettings(token),
    fetchProfiles(token),
    fetchRuntime(token),
  ]);
  if (!view.ok) return { type: "failed", error: view.error };
  if (!profiles.ok) return { type: "failed", error: profiles.error };
  const known = runtime.ok ? runtime.value : null;
  return { type: "loaded", view: view.value, profiles: profiles.value, runtime: known };
};

/** Starts Ollama, then reloads the page. */
export const startOllamaFor = async (token: string | null, dispatch: PageDispatch) => {
  if (!token) return;
  dispatch({ type: "working" });
  const runtime = await startOllama(token);
  dispatch(runtime.ok ? await loadAll(token) : { type: "actionFailed", error: runtime.error });
};

/** The old token stops working as soon as the core answers, so the page switches at once. */
export const rotateTokenFor = async (
  token: string | null,
  dispatch: PageDispatch,
  setToken: (token: string) => void,
): Promise<boolean> => {
  if (!token) return false;
  dispatch({ type: "working" });
  const rotated = await rotateToken(token);
  if (!rotated.ok) {
    dispatch({ type: "actionFailed", error: rotated.error });
    return false;
  }
  setToken(rotated.value.token);
  dispatch(await loadAll(rotated.value.token));
  return true;
};

/** Profile changes. Activating also changes the settings in effect, so both views reload. */
export const useProfileActions = (
  token: string | null,
  state: SettingsPageState,
  dispatch: PageDispatch,
) => {
  /** Runs a profile change, then reloads both views (activating changes the settings in effect). */
  const act = useCallback(
    async (change: (token: string) => Promise<ApiResult<ProfilesView>>) => {
      if (!token) return;
      dispatch({ type: "working" });
      const result = await change(token);
      dispatch(result.ok ? await loadAll(token) : { type: "actionFailed", error: result.error });
    },
    [token, dispatch],
  );
  const onSave = (id: string | null, input: ProfileSave) =>
    void act((t) => saveProfile(t, id, input));
  const onActivate = (id: string) => void act((t) => activateProfile(t, id));
  /** A profile in use is moved off to Local first; the list asked the user before calling this. */
  const onDelete = (id: string) => {
    if (state.phase !== "ready") return;
    const plan = profileUses(state.profiles, id).length > 0 && moveToLocal(state.profiles, id);
    void act((t) => (plan ? deleteMovingToLocal(t, id, plan) : deleteProfile(t, id)));
  };
  const onFeatures = (features: FeatureProfiles) =>
    void act((t) => setFeatureProfiles(t, features));
  return { onSave, onActivate, onDelete, onFeatures };
};
