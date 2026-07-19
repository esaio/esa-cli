import { execFileSync } from "node:child_process";
import { t } from "../i18n/index.js";

const TARGET = "esa-cli";
const USERNAME = "oauth-tokens";

// CRED_MAX_CREDENTIAL_BLOB_SIZE (512 * 5)
const CRED_MAX_BLOB_SIZE = 2560;

/**
 * Windows Credential Manager の P/Invoke 定義。
 * PowerShell の Add-Type で C# としてコンパイルし、
 * advapi32.dll の CredWriteW / CredReadW / CredDeleteW を呼び出す。
 */
const CRED_MANAGER_CS = `using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CredManager {
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CredWriteW(ref CREDENTIAL cred, uint flags);
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CredReadW(string target, uint type, uint flags, out IntPtr cred);
  [DllImport("advapi32.dll")]
  static extern void CredFree(IntPtr buf);
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool CredDeleteW(string target, uint type, uint flags);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName;
    public string Comment; public long LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob;
    public uint Persist; public uint AttributeCount;
    public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  public static void Write(string target, string user, string secret) {
    byte[] b = Encoding.UTF8.GetBytes(secret);
    IntPtr blob = Marshal.AllocHGlobal(b.Length);
    Marshal.Copy(b, 0, blob, b.Length);
    var c = new CREDENTIAL { Type=1, TargetName=target,
      CredentialBlobSize=(uint)b.Length, CredentialBlob=blob, Persist=2, UserName=user };
    try { if(!CredWriteW(ref c, 0))
      throw new Exception("CredWrite failed: " + Marshal.GetLastWin32Error());
    } finally { Marshal.FreeHGlobal(blob); }
  }
  public static string Read(string target) {
    IntPtr p; if(!CredReadW(target, 1, 0, out p)) return null;
    try {
      var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      if(c.CredentialBlobSize == 0) return "";
      byte[] b = new byte[c.CredentialBlobSize];
      Marshal.Copy(c.CredentialBlob, b, 0, b.Length);
      return Encoding.UTF8.GetString(b);
    } finally { CredFree(p); }
  }
  public static bool Delete(string target) {
    return CredDeleteW(target, 1, 0);
  }
}`;

function runPowerShell(script: string): string {
  const fullScript = `$ErrorActionPreference = 'Stop'\n${script}`;
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "-"],
    { encoding: "utf-8", input: fullScript, stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

function addTypePrefix(): string {
  const b64 = Buffer.from(CRED_MANAGER_CS, "utf-8").toString("base64");
  return `$csCode = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}'))\nAdd-Type -TypeDefinition $csCode`;
}

/**
 * PowerShell が壊れている環境で「利用可能」と誤判定すると保存時に落ちて
 * login ごと失敗するため、probe に失敗したら理由を問わず利用不可とみなす。
 */
export function isCredentialManagerAvailable(): boolean {
  if (process.platform !== "win32") return false;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "exit 0"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function credentialManagerSave(data: string): void {
  const bytes = Buffer.from(data, "utf-8");
  if (bytes.length > CRED_MAX_BLOB_SIZE) {
    throw new Error(
      t("credentialManager.tooLarge", {
        size: bytes.length,
        max: CRED_MAX_BLOB_SIZE,
      }),
    );
  }
  const b64 = bytes.toString("base64");
  runPowerShell(`${addTypePrefix()}
$bytes = [System.Convert]::FromBase64String('${b64}')
$data = [System.Text.Encoding]::UTF8.GetString($bytes)
[CredManager]::Write('${TARGET}', '${USERNAME}', $data)`);
}

/** エントリが無い場合・値が空の場合はいずれも null を返す。 */
export function credentialManagerLoad(): string | null {
  try {
    const result = runPowerShell(`${addTypePrefix()}
$result = [CredManager]::Read('${TARGET}')
if ($null -ne $result) { Write-Output $result }`);
    return result || null;
  } catch {
    return null;
  }
}

export function credentialManagerDelete(): void {
  try {
    runPowerShell(`${addTypePrefix()}
[void][CredManager]::Delete('${TARGET}')`);
  } catch {
    // エントリが存在しない場合は無視
  }
}
