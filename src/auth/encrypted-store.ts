import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getMachineId } from "./machine-id.js";

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
  const encData = encrypt(data, getMachineId());
  await writeFile(join(configDir, ENC_FILE), JSON.stringify(encData, null, 2), {
    mode: 0o600,
  });
}

export function encryptedLoad(configDir: string): string | null {
  try {
    const content = readFileSync(join(configDir, ENC_FILE), "utf-8");
    const encData = JSON.parse(content) as EncData;
    return decrypt(encData, getMachineId());
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
