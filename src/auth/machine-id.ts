import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";

// systemd が生成するランダムな 128bit の ID。dbus 側は古い環境向けの控え。
const LINUX_MACHINE_ID_PATHS = ["/etc/machine-id", "/var/lib/dbus/machine-id"];

function fromDarwin(): string | null {
  try {
    const output = execFileSync(
      "ioreg",
      ["-rd1", "-c", "IOPlatformExpertDevice"],
      {
        encoding: "utf-8",
      },
    );
    return output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function fromWindows(): string | null {
  try {
    const output = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf-8" },
    );
    return output.match(/MachineGuid\s+REG_SZ\s+(\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function fromLinux(): string | null {
  for (const path of LINUX_MACHINE_ID_PATHS) {
    try {
      const id = readFileSync(path, "utf-8").trim();
      if (id) return id;
    } catch {
      // 次の候補を試す
    }
  }
  return null;
}

function detect(): string {
  const id =
    process.platform === "darwin"
      ? fromDarwin()
      : process.platform === "win32"
        ? fromWindows()
        : process.platform === "linux"
          ? fromLinux()
          : null;

  // 最後の手段。ユーザー名もホスト名も推測可能なので、これに落ちた環境では
  // 「ファイルを持ち出されても復号できない」という保証は成り立たない。
  return (
    id ??
    `${process.env.USER ?? process.env.USERNAME ?? "unknown"}@${hostname()}`
  );
}

let cached: string | undefined;

/**
 * マシン固有の識別子。暗号化ファイルの鍵の素として使い、別マシンへ
 * ファイルをコピーしても復号できないようにする。
 * OS が提供する推測不能な ID を優先する。
 */
export function getMachineId(): string {
  if (cached === undefined) cached = detect();
  return cached;
}
