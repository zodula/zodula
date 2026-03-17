import { Database } from "../../database/database";
import { loader } from "../../loader";
import { genRanHex } from "../utils";
import { getFieldValueFromDoc } from "../../../client/utils";
import { ErrorWithCode } from "@/zodula/error";

export async function naming<TN extends Zodula.DoctypeName>(
  doctypeName: TN,
  data: Zodula.InsertDoctype<TN>,
  organizationAbbr: string,
  organizationName: string
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
   * {{doc_organization_abbr}} (organization abbreviation)
   * {HEX} (random 16 characters hex string)
   * {8HEX} (random 8 characters hex string)
   * {16HEX} (random 16 characters hex string)
   * {UUID} (random UUID v7 string)
   * // Field
   * {{field}} (field value)
   */
  let namingSeries = doctypeMetadata?.schema.naming_series;
  let id = genRanHex(16);
  if (doctypeMetadata?.schema.is_single) {
    id = doctypeMetadata?.name;
  }
  if (doctypeMetadata?.schema.is_organization_single) {
    id = `${doctypeMetadata?.name} - ${organizationName}`;
  }

  // If naming_series starts with "field:", use the doc's field value as the series template
  if (typeof namingSeries === "string" && namingSeries.startsWith("field:")) {
    const fieldName = namingSeries.slice(6).trim();
    namingSeries = (data as Record<string, unknown>)[fieldName] as string | undefined;
  }


  if (!!namingSeries) {
    namingSeries = namingSeries.replaceAll("{{doc_organization_abbr}}", organizationAbbr);
    namingSeries = namingSeries.replaceAll("{{doc_organization}}", organizationName);
    // Use the improved getFieldValueFromDoc function to handle both field and utility patterns
    let tempId = getFieldValueFromDoc(namingSeries, data as any);
    id = tempId;
    // replace {###} with %%
    const runingNumberSqureRegex = /\{#+\}/g;
    const db = Database("main");
    // count #
    for (const runingNumberSqure of id.match(runingNumberSqureRegex) || []) {
      const whereId = id.replaceAll(runingNumberSqure, "%");

      // Instead of counting, find the maximum number used to handle gaps from deletions
      const existingIdsQuery = `SELECT id FROM "${doctypeMetadata?.name}" WHERE id LIKE '${whereId}'`;
      const existingIds = (await db.all(existingIdsQuery)) as { id: string }[];

      let maxNumber = 0;
      const numberLength = runingNumberSqure.length - 2; // -2 for { and }
      const patternIndex = whereId.indexOf("%");

      // Extract the numeric part from each existing ID
      for (const row of existingIds) {
        if (
          patternIndex !== -1 &&
          row.id.length >= patternIndex + numberLength
        ) {
          // Extract the numeric part at the position where {#####} appears
          const numericPart = row.id.substring(
            patternIndex,
            patternIndex + numberLength
          );
          const number = parseInt(numericPart, 10);
          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
          }
        }
      }

      // Next number is max + 1, or 1 if no documents exist
      const nextNumber = maxNumber + 1;

      const squareCount = nextNumber.toString().padStart(numberLength, "0");
      id = id.replace(runingNumberSqure, squareCount);

    }
    // must suport thai and other languages and support ( and )
    if (id.match(/[^a-zA-Z0-9\s\-\_\.\:\/\'\"\`\&\s\@ก-ฮ\u0E00-\u0E7F\u0F00-\u0F03\u0F10-\u0F17\u0F19\u0F3A-\u0F3D\u0F40-\u0F47\u0F49-\u0F69\u0F71-\u0F84\u0F86-\u0F87\u0F90-\u0F97\u0F99-\u0FBC\u0FBE-\u0FD4\u0FD9-\u0FDA\(\)]/)) {
      throw new ErrorWithCode("ID cannot contain special characters. " + id, {
        status: 400,
      });
    }
    id = id.replaceAll("/", "⧸");
    id = id.replaceAll("'", "＇");
    id = id.replaceAll("`", "′");
    id = id.replaceAll(`"`, "＂");
    id = id.replaceAll("&", "＆");

    id = id.trimEnd().trimStart();
    if (id.startsWith("-")) {
      throw new ErrorWithCode("ID cannot start with '-'", {
        status: 400,
      });
    }
  }

  return id;
}
