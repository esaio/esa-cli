import { expect, test } from "vitest";
import { projectItems } from "../json-fields.js";

const posts = [
  { number: 1, name: "a", wip: true },
  { number: 2, name: "b", wip: false },
];

test("指定したフィールドだけを、指定した順で取り出す", () => {
  expect(projectItems(posts, "name,number")).toEqual([
    { name: "a", number: 1 },
    { name: "b", number: 2 },
  ]);
});

test("フィールド名の前後の空白と空要素は無視する", () => {
  expect(projectItems(posts, " name , , number ")).toEqual([
    { name: "a", number: 1 },
    { name: "b", number: 2 },
  ]);
});

test("候補は応答から集めるので、一部の要素にしか無いフィールドも選べる", () => {
  const items = [{ number: 1 }, { number: 2, sharing_urls: null }];

  expect(projectItems(items, "sharing_urls")).toEqual([
    { sharing_urls: undefined },
    { sharing_urls: null },
  ]);
});

test("値なしの --json は候補を並べて指定を促す", () => {
  expect(() => projectItems(posts, true)).toThrow(
    /Specify one or more comma-separated fields[\s\S]*number[\s\S]*name[\s\S]*wip/,
  );
});

test("空文字だけの指定も、値なしと同じく候補提示にする", () => {
  expect(() => projectItems(posts, " , ")).toThrow(
    /Specify one or more comma-separated fields/,
  );
});

test("応答に無いフィールドは、候補を添えて拒否する", () => {
  expect(() => projectItems(posts, "number,title")).toThrow(
    /Unknown JSON field: title[\s\S]*number[\s\S]*name/,
  );
});

test("応答が空なら、フィールド名の正誤は判断できないので通す", () => {
  // 候補が集まらないため、綴りの誤りは検出しようがない。
  expect(projectItems([], "whatever")).toEqual([]);
});

test("応答が空でも、指定漏れは弾く", () => {
  // 候補は出せないが「指定が無い」ことは分かる。ここで黙って通すと、
  // 該当0件のときだけ --json が何もしないという分かりにくい罠になる。
  expect(() => projectItems([], true)).toThrow(
    /Specify one or more comma-separated fields/,
  );
});
