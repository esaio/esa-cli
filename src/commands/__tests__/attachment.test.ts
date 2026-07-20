import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
const postReq = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();
const writeFile = vi.fn<(path: string, data: Buffer) => Promise<void>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get, POST: postReq }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));
vi.mock("node:fs/promises", () => ({ writeFile }));

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

const fetchMock = vi.fn();

beforeEach(() => {
  get
    .mockReset()
    .mockResolvedValue(
      ok200({ signed_urls: [["/uploads/x.png", "https://s3/signed"]] }),
    );
  postReq
    .mockReset()
    .mockResolvedValue(
      ok200({ signed_urls: [["/uploads/x.png", "https://s3/signed"]] }),
    );
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
  writeFile.mockReset().mockResolvedValue();
  fetchMock
    .mockReset()
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("`attachment sign` posts the URLs with v2 and prints the signed URLs", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "attachment",
    "sign",
    "/uploads/x.png",
    "https://files.esa.io/uploads/y.png",
    "--team",
    "docs",
  ]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(postReq).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: { path: { team_name: "resolved-team" } },
    body: {
      urls: ["/uploads/x.png", "https://files.esa.io/uploads/y.png"],
      v: 2,
      expires_in: undefined,
    },
  });
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    signed_urls: [["/uploads/x.png", "https://s3/signed"]],
  });
});

test("`attachment sign` passes --expires-in through", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["attachment", "sign", "/uploads/x.png", "--expires-in", "3600"]);

  expect(postReq).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: { path: { team_name: "resolved-team" } },
    body: { urls: ["/uploads/x.png"], v: 2, expires_in: 3600 },
  });
});

test("`attachment sign` rejects an out-of-range --expires-in before any network call", async () => {
  await expect(
    run(["attachment", "sign", "/uploads/x.png", "--expires-in", "604801"]),
  ).rejects.toThrow(/604800/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(postReq).not.toHaveBeenCalled();
});

test("`attachment download` signs a files.esa.io URL, fetches it, and writes the file", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});

  await run([
    "attachment",
    "download",
    "https://files.esa.io/uploads/x.png",
    "-o",
    "./x.png",
  ]);

  // フルURLはパスに正規化して署名APIへ渡す。
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/signed_urls", {
    params: {
      path: { team_name: "resolved-team" },
      query: { urls: "/uploads/x.png", v: 2 },
    },
  });
  expect(fetchMock).toHaveBeenCalledWith("https://s3/signed");
  const [path, buffer] = writeFile.mock.calls[0];
  expect(path).toBe("./x.png");
  expect([...(buffer as Buffer)]).toEqual([1, 2, 3]);
  expect(err).toHaveBeenCalled();
});

test("`attachment download` fetches img.esa.io directly without signing", async () => {
  await run([
    "attachment",
    "download",
    "https://img.esa.io/uploads/x.png",
    "-o",
    "./x.png",
  ]);

  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith("https://img.esa.io/uploads/x.png");
});

test("`attachment download` writes to stdout when no --output is given", async () => {
  const write = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);

  await run(["attachment", "download", "/uploads/x.png"]);

  expect(fetchMock).toHaveBeenCalledWith("https://s3/signed");
  expect(writeFile).not.toHaveBeenCalled();
  expect([...(write.mock.calls[0][0] as Buffer)]).toEqual([1, 2, 3]);
});

test("`attachment download` errors when the file has no signed URL", async () => {
  get.mockResolvedValue(ok200({ signed_urls: [["/uploads/x.png", null]] }));

  await expect(
    run(["attachment", "download", "/uploads/x.png"]),
  ).rejects.toThrow(/not found/i);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("`attachment download` rejects an out-of-range --expires-in before any network call", async () => {
  await expect(
    run(["attachment", "download", "/uploads/x.png", "--expires-in", "0"]),
  ).rejects.toThrow(/604800/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
