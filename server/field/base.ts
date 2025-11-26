import { z } from "bxo"
import type { SQLType } from "./type"

interface BaseFieldPluginOptions {
    fieldType: Zodula.FieldType
    sqlType: SQLType
    // typescript type example: string, number, boolean, "0 | 1", "0 | 1 | 2"
    typescriptType: (fieldConfig: Zodula.Field) => string
    // Function to generate Zod schema for this field type
    zodSchema: (fieldConfig: Zodula.Field) => z.ZodTypeAny
    textZodSchema: (fieldConfig: Zodula.Field) => string | null
}

export class BaseFieldPlugin<O extends BaseFieldPluginOptions = BaseFieldPluginOptions> {
    options: O

    constructor(options: O) {
        this.options = options
    }

    /**
     * Generate Zod schema for this field type
     * @param fieldConfig - The field configuration
     * @returns A Zod schema for the field
     */
    generateZodSchema(fieldConfig: any): z.ZodTypeAny {
        let schema = this.options.zodSchema(fieldConfig);

        if (fieldConfig.description) {
            schema = schema.describe(fieldConfig.description);
        }

        if (!fieldConfig.required) {
            schema = schema.optional().nullish();
            // if (fieldConfig.default === undefined) {
            //     schema = schema.optional().nullish();
            // }
        }


        return schema;
    }
}