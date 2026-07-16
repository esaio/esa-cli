import { execFileSync } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";

const ENC_FILE = "tokens.enc.json";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

type EncData = {
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

/**
 * マシン固有の識別子を取得する。暗号化鍵の素として使う。
 * これにより別マシンへファイルをコピーしても復号できない。
 */
function getMachineId(): string {
  if (process.platform === "darwin") {
    try {
      const output = execFileSync(
        "ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        { encoding: "utf-8" },
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    } catch {
      // ioreg が使えない場合はフォールバック
    }
  }

  if (process.platform === "win32") {
    try {
      const output = execFileSync(
        "reg",
        [
          "query",
          "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
          "/v",
          "MachineGuid",
        ],
        { encoding: "utf-8" },
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (match) return match[1];
    } catch {
      // reg が使えない場合はフォールバック
    }
  }

  return `${process.env.USER ?? process.env.USERNAME ?? "unknown"}@${hostname()}`;
}

let cachedMachineId: string | undefined;
function getMachineIdCached(): string {
  if (cachedMachineId === undefined) cachedMachineId = getMachineId();
  return cachedMachineId;
}

function deriveKey(machineId: string, salt: Buffer): Buffer {
  return scryptSync(machineId, salt, KEY_LENGTH);
}

function encrypt(data: string, machineId: string): EncData {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(machineId, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

function decrypt(encData: EncData, machineId: string): string {
  const salt = Buffer.from(encData.salt, "hex");
  const iv = Buffer.from(encData.iv, "hex");
  const authTag = Buffer.from(encData.authTag, "hex");
  const ciphertext = Buffer.from(encData.ciphertext, "hex");
  const key = deriveKey(machineId, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf-8");
}

export async function encryptedSave(
  data: string,
  configDir: string,
): Promise<void> {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const encData = encrypt(data, getMachineIdCached());
  await writeFile(join(configDir, ENC_FILE), JSON.stringify(encData, null, 2), {
    mode: 0o600,
  });
}

export function encryptedLoad(configDir: string): string | null {
  try {
    const content = readFileSync(join(configDir, ENC_FILE), "utf-8");
    const encData = JSON.parse(content) as EncData;
    return decrypt(encData, getMachineIdCached());
  } catch {
    return null;
  }
}

export async function encryptedDelete(configDir: string): Promise<void> {
  try {
    await unlink(join(configDir, ENC_FILE));
  } catch {
    // ファイルが存在しない場合は無視
  }
}
