import { join } from "node:path";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { ModelConfig, ServeSettings, Settings, TransportSettings } from "./settings.schema";

export type Env = Readonly<Record<string, string | undefined>>;
export type Platform = NodeJS.Platform;

/** macOS keeps app data in Application Support; other systems use ~/.local/share. */
const appSupportDir = (homeDir: string, platform: Platform): string =>
  platform === "darwin"
    ? join(homeDir, "Library", "Application Support", "GrammarChecker")
    : join(homeDir, ".local", "share", "GrammarChecker");

export const defaultDictionaryPath = (homeDir: string, platform: Platform = process.platform) =>
  join(appSupportDir(homeDir, platform), "dictionary.json");

export const defaultSettingsPath = (homeDir: string, platform: Platform = process.platform) =>
  join(appSupportDir(homeDir, platform), "settings.json");

export const defaultTokenPath = (homeDir: string, platform: Platform = process.platform) =>
  join(appSupportDir(homeDir, platform), "token");

/** Where downloaded local models live: next to the settings, in the app's folder. */
export const defaultModelsDir = (homeDir: string, platform: Platform = process.platform) =>
  join(appSupportDir(homeDir, platform), "models");

const blankToUndefined = (value: string | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined;

const transportInput = (env: Env, homeDir: string, platform: Platform) => ({
  port: blankToUndefined(env.GC_PORT),
  tokenPath: blankToUndefined(env.GC_TOKEN_PATH) ?? defaultTokenPath(homeDir, platform),
});

/** Reads GC_PORT and GC_TOKEN_PATH only, so `core token` works without model settings. */
export const loadTransportSettings = (
  env: Env,
  homeDir: string,
  platform: Platform = process.platform,
): Result<TransportSettings, AppError> => {
  const parsed = TransportSettings.safeParse(transportInput(env, homeDir, platform));
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};

/** Reads GC_* variables. Pure: the caller passes the environment and home directory. */
export const loadSettings = (
  env: Env,
  homeDir: string,
  platform: Platform = process.platform,
): Result<Settings, AppError> => {
  const parsed = Settings.safeParse({
    ...transportInput(env, homeDir, platform),
    baseUrl: blankToUndefined(env.GC_BASE_URL),
    model: blankToUndefined(env.GC_MODEL),
    apiKey: blankToUndefined(env.GC_API_KEY),
    dictionaryPath:
      blankToUndefined(env.GC_DICTIONARY_PATH) ?? defaultDictionaryPath(homeDir, platform),
    reasoningEffort: blankToUndefined(env.GC_REASONING_EFFORT),
  });
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};

/** The env vars that set a model; any of them set means the env gives the whole model. */
const MODEL_VARS = ["GC_BASE_URL", "GC_MODEL", "GC_API_KEY", "GC_REASONING_EFFORT"] as const;

/**
 * The model the `GC_*` env vars give, or null when none is set (the saved profiles are used).
 * A partial one (e.g. only GC_MODEL) is invalid, never mixed with a saved profile.
 */
export const loadEnvModel = (env: Env): Result<ModelConfig | null, AppError> => {
  if (!MODEL_VARS.some((name) => blankToUndefined(env[name]))) return ok(null);
  const parsed = ModelConfig.safeParse({
    baseUrl: blankToUndefined(env.GC_BASE_URL),
    model: blankToUndefined(env.GC_MODEL),
    apiKey: blankToUndefined(env.GC_API_KEY),
    reasoningEffort: blankToUndefined(env.GC_REASONING_EFFORT),
  });
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};

/** What `core serve` needs: transport, files, and the env model if any. */
export const loadServeSettings = (
  env: Env,
  homeDir: string,
  platform: Platform = process.platform,
): Result<ServeSettings, AppError> => {
  const envModel = loadEnvModel(env);
  if (!envModel.ok) return envModel;
  const parsed = ServeSettings.safeParse({
    ...transportInput(env, homeDir, platform),
    dictionaryPath:
      blankToUndefined(env.GC_DICTIONARY_PATH) ?? defaultDictionaryPath(homeDir, platform),
    settingsPath: blankToUndefined(env.GC_SETTINGS_PATH) ?? defaultSettingsPath(homeDir, platform),
    envModel: envModel.value,
  });
  return parsed.success ? ok(parsed.data) : err(appError("settings_invalid"));
};
