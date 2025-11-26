import type { FieldType, REFERENCE_HOOK } from "./type"


export class BaseField<FT extends FieldType = FieldType, R extends 0 | 1 = 0 | 1> {
    type: FT

    config: Zodula.Field<FT, R>

    constructor(type: FT, config: Zodula.Field<FT, R>) {
        this.type = type
        this.config = {
            ...config,
            type: type
        }
    }

}
type FieldConfig<C extends Zodula.Field> = Omit<C, "type">

export class Fields {
    static Text<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Text"
        } as Zodula.Field<"Text", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Text", _config).config
    }

    static LongText<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Long Text"
        } as Zodula.Field<"Long Text", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Long Text", _config).config
    }

    static Email<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Email"
        } as Zodula.Field<"Email", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Email", _config).config
    }

    static Password<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Password"
        } as Zodula.Field<"Password", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Password", _config).config
    }

    static Check<C extends FieldConfig<Zodula.Field>>(config: C & {
        default?: "0" | "1"
    }) {
        const _config = {
            ...config,
            type: "Check"
        } as Zodula.Field<"Check", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Check", _config).config
    }

    static Reference<C extends FieldConfig<Zodula.Field>>(config: C & { reference: Zodula.DoctypeName, on_delete: REFERENCE_HOOK }) {
        const _config = {
            ...config,
            type: "Reference"
        } as Zodula.Field<"Reference", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Reference", _config).config
    }

    static VirtualReference<C extends FieldConfig<Zodula.Field>>(config: C & { reference: string }) {
        const _config = {
            ...config,
            type: "Virtual Reference"
        } as Zodula.Field<"Virtual Reference", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Virtual Reference", _config).config
    }


    static Integer<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Integer"
        } as Zodula.Field<"Integer", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Integer", _config).config
    }

    static Float<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Float"
        } as Zodula.Field<"Float", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Float", _config).config
    }


    static Currency<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Currency"
        } as Zodula.Field<"Currency", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Currency", _config).config
    }

    static Data<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Data"
        } as Zodula.Field<"Data", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Data", _config).config
    }

    static JSON<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "JSON"
        } as Zodula.Field<"JSON", C["required"] extends 1 ? 1 : 0>
        return new BaseField("JSON", _config).config
    }

    static Select<C extends FieldConfig<Zodula.Field>>(config: { options: string } & C) {
        const _config = {
            ...config,
            type: "Select"
        } as Zodula.Field<"Select", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Select", _config).config
    }

    static Datetime<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Datetime"
        } as Zodula.Field<"Datetime", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Datetime", _config).config
    }

    static Date<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Date"
        } as Zodula.Field<"Date", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Date", _config).config
    }

    static Time<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "Time"
        } as Zodula.Field<"Time", C["required"] extends 1 ? 1 : 0>
        return new BaseField("Time", _config).config
    }

    static File<C extends FieldConfig<Zodula.Field>>(config: C) {
        const _config = {
            ...config,
            type: "File"
        } as Zodula.Field<"File", C["required"] extends 1 ? 1 : 0>
        return new BaseField("File", _config).config
    }
}