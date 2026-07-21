import { readFileSync } from "node:fs";
import { t } from "../i18n/index.js";

export type BodyOptions = {
  body?: string;
  bodyFile?: string;
};

/** ファイルから UTF-8 で読む。"-" は標準入力（fd 0）。 */
export function readFileOrStdin(path: string): string {
  return readFileSync(path === "-" ? 0 : path, "utf-8");
}

/**
 * 本文（Markdown）を --body / --body-file から読む。--body-file が "-" の
 * 場合は標準入力（fd 0）から読む。両方指定はエラー。どちらも無ければ undefined。
 */
export function readBody(options: BodyOptions): string | undefined {
  if (options.body !== undefined && options.bodyFile !== undefined) {
    throw new Error(t("post.bodyConflict"));
  }
  if (options.body !== undefined) return options.body;
  if (options.bodyFile !== undefined) return readFileOrStdin(options.bodyFile);
  return undefined;
}

/** 本文を必須として読む（append / prepend 用）。未指定ならエラー。 */
export function requireBody(options: BodyOptions): string {
  const body = readBody(options);
  if (body === undefined) {
    throw new Error(t("post.bodyRequired"));
  }
  return body;
}
