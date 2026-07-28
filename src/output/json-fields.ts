import { t } from "../i18n/index.js";

/** 候補一覧。そのままコピーして指定できるよう1行1フィールドで並べる。 */
function fieldList(fields: readonly string[]): string {
  return fields.map((field) => `  ${field}`).join("\n");
}

/**
 * `--json` で指定されたフィールドだけを、指定順に取り出す。
 *
 * 候補は応答そのものから取る。生成型とは別に候補一覧を持つと二重管理になり、
 * API にフィールドが増えたときに片方だけ古くなるため。この都合でフィールド名の
 * 検証は通信の後になり、作成・更新では変更が済んだ後に落ちることになる。
 */
export function projectItems(
  items: readonly object[],
  raw: string | true,
): Record<string, unknown>[] {
  // 絞り込むフィールド名は実行時に決まるため、生成型のままでは索けない。
  const records = items as readonly Record<string, unknown>[];
  const available = [...new Set(records.flatMap((item) => Object.keys(item)))];
  // 値なしの `--json` は指定漏れとみなし、候補を並べて促す。
  const fields =
    raw === true
      ? []
      : raw
          .split(",")
          .map((field) => field.trim())
          .filter((field) => field.length > 0);

  // 指定漏れは候補が無くても判断できるので、応答の件数に関わらず弾く。
  // 該当0件のときだけ黙って通ると、指定漏れに気づけない。
  if (fields.length === 0) {
    throw new Error(
      available.length > 0
        ? t("output.jsonFieldsRequired", { fields: fieldList(available) })
        : t("output.jsonFieldsRequiredUnknown"),
    );
  }

  // フィールド名の正誤は候補が無いと判断できないので、ここで打ち切る。
  if (items.length === 0) return [];

  const unknown = fields.filter((field) => !available.includes(field));
  if (unknown.length > 0) {
    throw new Error(
      t("output.jsonUnknownField", {
        unknown: unknown.join(", "),
        fields: fieldList(available),
      }),
    );
  }

  return records.map((item) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) projected[field] = item[field];
    return projected;
  });
}

/**
 * 単一のリソースを `--json` の指定で絞って出す。
 * 絞り込みと整形が呼び出し側に散らないよう、出力までをここに閉じる。
 */
export function printJson(item: object, raw: string | true): void {
  console.log(JSON.stringify(projectItems([item], raw)[0], null, 2));
}
