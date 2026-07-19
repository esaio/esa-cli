import { CONFIG_DIR as DEFAULT_CONFIG_DIR } from "../config/paths.js";
import { t } from "../i18n/index.js";
import {
  credentialManagerDelete,
  credentialManagerLoad,
  credentialManagerSave,
  isCredentialManagerAvailable,
} from "./credential-manager.js";
import {
  encryptedDelete,
  encryptedLoad,
  encryptedSave,
} from "./encrypted-store.js";
import {
  isKeychainAvailable,
  keychainDelete,
  keychainLoad,
  keychainSave,
} from "./keychain.js";
import {
  isSecretServiceAvailable,
  secretServiceDelete,
  secretServiceLoad,
  secretServiceSave,
} from "./secret-service.js";
import type { TokenSet } from "./types.js";

export type Backend =
  | "keychain"
  | "credential-manager"
  | "secret-service"
  | "encrypted-file";

let cachedBackend: Backend | undefined;

function detectBackend(): Backend {
  if (isKeychainAvailable()) return "keychain";
  if (isCredentialManagerAvailable()) return "credential-manager";
  if (isSecretServiceAvailable()) return "secret-service";
  return "encrypted-file";
}

export function getBackend(): Backend {
  if (cachedBackend === undefined) cachedBackend = detectBackend();
  return cachedBackend;
}

/** 資格情報の保存先backendの人間向けラベル。 */
export function backendLabel(backend: Backend): string {
  switch (backend) {
    case "keychain":
      return "macOS Keychain";
    case "credential-manager":
      return "Windows Credential Manager";
    case "secret-service":
      return "Linux Secret Service";
    case "encrypted-file":
      return t("tokenStore.encryptedFileLabel");
  }
}

export async function saveTokens(
  tokens: TokenSet,
  configDir: string = DEFAULT_CONFIG_DIR,
): Promise<void> {
  const backend = getBackend();
  const json = JSON.stringify(tokens);
  try {
    switch (backend) {
      case "keychain":
        keychainSave(json);
        break;
      case "credential-manager":
        credentialManagerSave(json);
        break;
      case "secret-service":
        secretServiceSave(json);
        break;
      case "encrypted-file":
        await encryptedSave(json, configDir);
        break;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      t("tokenStore.saveFailed", {
        backend: backendLabel(backend),
        error: msg,
      }),
    );
  }
}

export function loadTokens(
  configDir: string = DEFAULT_CONFIG_DIR,
): TokenSet | null {
  const backend = getBackend();
  let json: string | null = null;
  switch (backend) {
    case "keychain":
      json = keychainLoad();
      break;
    case "credential-manager":
      json = credentialManagerLoad();
      break;
    case "secret-service":
      json = secretServiceLoad();
      break;
    case "encrypted-file":
      json = encryptedLoad(configDir);
      break;
  }

  if (json == null) return null;

  try {
    return JSON.parse(json) as TokenSet;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      t("tokenStore.parseWarning", {
        backend: backendLabel(backend),
        error: msg,
      }),
    );
    return null;
  }
}

export async function deleteTokens(
  configDir: string = DEFAULT_CONFIG_DIR,
): Promise<void> {
  switch (getBackend()) {
    case "keychain":
      keychainDelete();
      break;
    case "credential-manager":
      credentialManagerDelete();
      break;
    case "secret-service":
      secretServiceDelete();
      break;
    case "encrypted-file":
      await encryptedDelete(configDir);
      break;
  }
}
