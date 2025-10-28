import { Database } from "../../database/database";
import { loader } from "../../loader";
import { genRanHex } from "../utils";
import { getFieldValueFromDoc } from "../../../client/utils";

export async function naming<TN extends Zodula.DoctypeName>(
  doctypeName: TN,
  data: Zodula.InsertDoctype<TN>
) {
  const doctypeMetadata = loader.from("doctype").get(doctypeName);
  /**
   * dynamic naming series format are
   * // Utils
   * {#####} n digits from # to ######## (default 5)
   * {YYYY} (year)
   * {MM} (month)
   * {DD} (day)
   * {HH} (hour)
   * {MM} (minute)
   * {SS} (second)
   * {SSS} (millisecond)
   * {T} (timestamp)
   * {HEX} (random 16 characters hex string)
   * {8HEX} (random 8 characters hex string)
   * {16HEX} (random 16 characters hex string)
   * {UUID} (random UUID v7 string)
   * // Field
   * {{field}} (field value)
   */
  let namingSeries = doctypeMetadata?.schema.naming_series;
  if (doctypeMetadata?.schema.is_single) {
    return doctypeMetadata?.name;
  }
  let id = genRanHex(16);
  if (!!namingSeries) {
    // Use the improved getFieldValueFromDoc function to handle both field and utility patterns
    let tempId = getFieldValueFromDoc(namingSeries, data as any);

    id = tempId;
    // replace {###} with %%
    const runingNumberSqureRegex = /\{#+\}/g;
    const db = Database("main");
    // count #
    for (const runingNumberSqure of id.match(runingNumberSqureRegex) || []) {
      const whereId = id.replaceAll(runingNumberSqure, "%");
      const countQuery = `SELECT COUNT(*) as count FROM "${doctypeMetadata?.name}" WHERE id LIKE '${whereId}'`;
      const countResult = (await db.get(countQuery)) as { count: number };
      const count = countResult.count + 1;

      const squareCount = count
        .toString()
        .padStart(runingNumberSqure.length, "0");
      id = id.replace(runingNumberSqure, squareCount);
    }
    return id;
  }
  return id;
}
