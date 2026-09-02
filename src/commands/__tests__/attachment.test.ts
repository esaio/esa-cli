import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { captureStdout } from "../../test-utils/stdout.js";

const get = vi.fn();
const post = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get, POST: post }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));

const { registerAttachmentCommand } = await import("../attachment.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerAttachmentCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

const ok201 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 201 }),
});

const fetchMock = vi.fn();

let tmpDir: string;

const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "esa-att-"));
  get
    .mockReset()
    .mockResolvedValue(
      ok200({ signed_urls: [["/uploads/x.png", "https://s3/signed"]] }),
    );
  post.mockReset().mockResolvedValue(
    ok201({
      attachment: {
        url: "https://img.esa.io/uploads/x.png",
        name: "x.png",
        size: 3,
      },
    }),
  );
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
  // 各呼び出しで本文（ストリーム）が未消費の新しい Response を返す。
  fetchMock
    .mockReset()
    .mockImplementation(() => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  process.stdout.isTTY = originalStdoutIsTTY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("`attachment sign` gets signed URLs with v2 (comma-joined) and prints them", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = false;

  await run([
    "attachment",
    "sign",
    "/uploads/x.png",
    "https://files.esa.io/uploads/y.png",
    "--team",
    "docs",
  ]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  // 署名は read 操作なので GET を使う（POST は write:attachment を要求する）。
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: {
      path: { team_name: "resolved-team" },
      query: {
        urls: "/uploads/x.png,https://files.esa.io/uploads/y.png",
        v: 2,
      },
    },
  });
  // API はペアの配列を返すので、扱いやすい2列に均して出す。
  expect(output()).toBe("/uploads/x.png\thttps://s3/signed\n");
});

test("`attachment sign --json` narrows the flattened pairs", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["attachment", "sign", "/uploads/x.png", "--json", "signed_url"]);

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual([
    { signed_url: "https://s3/signed" },
  ]);
});

test("`attachment sign` passes --expires-in through", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["attachment", "sign", "/uploads/x.png", "--expires-in", "3600"]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: {
      path: { team_name: "resolved-team" },
      query: { urls: "/uploads/x.png", v: 2, expires_in: 3600 },
    },
  });
});

test("`attachment sign` rejects an out-of-range --expires-in before any network call", async () => {
  await expect(
    run(["attachment", "sign", "/uploads/x.png", "--expires-in", "604801"]),
  ).rejects.toThrow(/604800/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`attachment sign` rejects more than 10 URLs before any network call", async () => {
  const urls = Array.from({ length: 11 }, (_, i) => `/uploads/${i}.png`);

  await expect(run(["attachment", "sign", ...urls])).rejects.toThrow(/10/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`attachment download` signs a files.esa.io URL, fetches it, and writes the file", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const out = join(tmpDir, "x.png");

  await run([
    "attachment",
    "download",
    "https://files.esa.io/uploads/x.png",
    "-o",
    out,
  ]);

  // フルURLはパスに正規化して署名APIへ渡す。
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: {
      path: { team_name: "resolved-team" },
      query: { urls: "/uploads/x.png", v: 2 },
    },
  });
  expect(fetchMock).toHaveBeenCalledWith("https://s3/signed");
  expect([...readFileSync(out)]).toEqual([1, 2, 3]);
  expect(err).toHaveBeenCalled();
});

test("`attachment download` fetches img.esa.io directly without signing", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const out = join(tmpDir, "x.png");

  await run([
    "attachment",
    "download",
    "https://img.esa.io/uploads/x.png",
    "-o",
    out,
  ]);

  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith("https://img.esa.io/uploads/x.png");
  expect([...readFileSync(out)]).toEqual([1, 2, 3]);
});

test("`attachment download` ignores --expires-in for a public URL that needs no signing", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const out = join(tmpDir, "x.png");

  // 署名が不要な公開URLでは --expires-in は使われないので、範囲外でも失敗しない。
  await run([
    "attachment",
    "download",
    "https://img.esa.io/uploads/x.png",
    "--expires-in",
    "0",
    "-o",
    out,
  ]);

  expect(get).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith("https://img.esa.io/uploads/x.png");
});

test("`attachment download` streams to stdout when no --output is given", async () => {
  // 添付はバイト列なので captureStdout（文字列）ではなくこちらで受ける。
  // pipeline が完了通知を待つ場合に備えて callback は呼び返す。
  const chunks: number[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      chunks.push(...(chunk as Buffer));
      const done = typeof encoding === "function" ? encoding : callback;
      done?.();
      return true;
    },
  );

  await run(["attachment", "download", "/uploads/x.png"]);

  expect(fetchMock).toHaveBeenCalledWith("https://s3/signed");
  expect(chunks).toEqual([1, 2, 3]);
});

test("`attachment download` errors when the file has no signed URL", async () => {
  get.mockResolvedValue(ok200({ signed_urls: [["/uploads/x.png", null]] }));

  await expect(
    run(["attachment", "download", "/uploads/x.png"]),
  ).rejects.toThrow(/not found/i);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("`attachment download` throws when the fetch fails", async () => {
  fetchMock.mockResolvedValue(
    new Response(null, { status: 404, statusText: "Not Found" }),
  );

  await expect(
    run(["attachment", "download", "/uploads/x.png"]),
  ).rejects.toThrow(/404/);
});

test("`attachment download` rejects an out-of-range --expires-in before any network call", async () => {
  await expect(
    run(["attachment", "download", "/uploads/x.png", "--expires-in", "0"]),
  ).rejects.toThrow(/604800/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("`attachment upload` posts the file as multipart and prints the URL", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const file = join(tmpDir, "diagram.png");
  writeFileSync(file, new Uint8Array([1, 2, 3]));

  await run(["attachment", "upload", file, "--team", "docs"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  const [path, init] = post.mock.calls[0];
  expect(path).toBe("/v1/teams/{team_name}/attachments");
  expect(init.params).toEqual({ path: { team_name: "resolved-team" } });
  // multipart 本文は FormData として送る（Content-Type は fetch が付ける）。
  const body = init.body as FormData;
  expect(body).toBeInstanceOf(FormData);
  const filePart = body.get("file") as File;
  expect(filePart).toBeInstanceOf(Blob);
  expect(filePart.name).toBe("diagram.png");
  expect(body.has("name")).toBe(false);
  // 記事に貼れる URL を stdout に、確認行は stderr に出す。
  expect(log.mock.calls).toEqual([["https://img.esa.io/uploads/x.png"]]);
  expect(stripVTControlCharacters(err.mock.calls[0][0] as string)).toBe(
    "✓ Uploaded x.png (3 bytes).",
  );
});

test("`attachment upload --json` narrows the attachment fields", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const file = join(tmpDir, "diagram.png");
  writeFileSync(file, new Uint8Array([1, 2, 3]));

  await run(["attachment", "upload", file, "--json", "url,size"]);

  // 包みではなく attachment 自体が絞り込む対象になる。
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    url: "https://img.esa.io/uploads/x.png",
    size: 3,
  });
});

test("`attachment upload` sends --name as the name field", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const file = join(tmpDir, "diagram.png");
  writeFileSync(file, new Uint8Array([1, 2, 3]));

  await run(["attachment", "upload", file, "--name", "renamed.png"]);

  const body = post.mock.calls[0][1].body as FormData;
  expect(body.get("name")).toBe("renamed.png");
});

test("`attachment upload` rejects a missing file before any network call", async () => {
  await expect(
    run(["attachment", "upload", join(tmpDir, "missing.png")]),
  ).rejects.toThrow(/Not a file/i);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("`attachment upload` rejects a directory before any network call", async () => {
  await expect(run(["attachment", "upload", tmpDir])).rejects.toThrow(
    /Not a file/i,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("`attachment upload` rejects an empty --name before any network call", async () => {
  const file = join(tmpDir, "diagram.png");
  writeFileSync(file, new Uint8Array([1, 2, 3]));

  await expect(
    run(["attachment", "upload", file, "--name", ""]),
  ).rejects.toThrow(/--name must not be empty/i);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("`attachment upload` rejects a whitespace-only --name", async () => {
  const file = join(tmpDir, "diagram.png");
  writeFileSync(file, new Uint8Array([1, 2, 3]));

  await expect(
    run(["attachment", "upload", file, "--name", "  "]),
  ).rejects.toThrow(/--name must not be empty/i);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

// root は権限を無視して読めてしまうため（CI コンテナ等）、その環境ではスキップ。
const cannotDenyRead = process.platform === "win32" || process.getuid?.() === 0;

test.skipIf(cannotDenyRead)(
  "`attachment upload` rejects an unreadable file before any network call",
  async () => {
    const file = join(tmpDir, "secret.png");
    writeFileSync(file, new Uint8Array([1, 2, 3]));
    chmodSync(file, 0o000);

    await expect(run(["attachment", "upload", file])).rejects.toThrow(
      /Cannot read file/i,
    );
    expect(resolveTeam).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  },
);
