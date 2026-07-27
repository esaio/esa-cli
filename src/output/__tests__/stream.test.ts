import { afterEach, expect, test } from "vitest";
import { isStdoutTTY, terminalWidth } from "../stream.js";

const originalIsTTY = process.stdout.isTTY;
const originalColumns = process.stdout.columns;

afterEach(() => {
  process.stdout.isTTY = originalIsTTY;
  process.stdout.columns = originalColumns;
});

test("stdout が端末かどうかを見る", () => {
  process.stdout.isTTY = true;
  expect(isStdoutTTY()).toBe(true);

  // パイプ時は undefined になるため、真偽値に正規化されることも確かめる。
  process.stdout.isTTY = undefined as unknown as boolean;
  expect(isStdoutTTY()).toBe(false);
});

test("端末幅を返す", () => {
  process.stdout.columns = 120;
  expect(terminalWidth()).toBe(120);
});

test("桁数が取れないときや 0 のときは既定幅に落とす", () => {
  // pty によっては 0 を返す。信じると列幅が全て 0 になり何も表示されなくなる。
  process.stdout.columns = 0;
  expect(terminalWidth()).toBe(80);

  process.stdout.columns = undefined as unknown as number;
  expect(terminalWidth()).toBe(80);
});
