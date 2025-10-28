import { FieldHelper } from "@/zodula/server/field";
import { loader } from "../loader";
import prettier from "prettier";
import type { AppMetadata } from "../loader/plugins/app";
import type { DoctypeMetadata } from "../loader/plugins/doctype";
import path from "path";
import { ClientFieldHelper } from "../../client/field";

const standardFields = ClientFieldHelper.standardFields();


export class TypeGenerator {
    private generateAppTypesContent(apps: AppMetadata[]): string {
        if (!apps?.length) {
            return 'type AppName = never;';
        }

        const appNames = apps.map(app => `"${app.packageName}"`).join(" | ");
        return `type AppName = ${appNames};`;
    }

    private generateFieldType(fieldName: string, config: Zodula.Field): string | null {
        try {
            const typescriptType = FieldHelper.getTypescriptType(config);

            // Skip fields that return 'never' type
            if (typescriptType === 'never') {
                return null;
            }

            let required = config.required ? "" : "?";
            if (fieldName === "id") {
                required = "";
            }

            return `"${fieldName}"${required}: ${typescriptType} ${required && "| null"}; // ${config.type},`;
        } catch (error) {
            // If field type is not found, skip it
            console.warn(`Field type "${config.type}" not found for field "${fieldName}"`);
            return null;
        }
    }

    private generateStandardFields(): string {
        const standardFields = ClientFieldHelper.standardFields();

        const fieldEntries = Object.entries(standardFields)
            .map(([key, config]) => this.generateFieldType(key, config))
            .filter(Boolean)
            .join('\n        ');

        return fieldEntries || '[k: string]: unknown;';
    }

    private generateDoctypeFields(fields: Record<string, Zodula.Field> | undefined): string {
        if (!fields) {
            return '[k: string]: unknown;';
        }

        const fieldEntries = Object.entries(fields)
            .map(([key, config]) => {
                if (Object.keys(standardFields).includes(key)) {
                    return null;
                }
                return this.generateFieldType(key, config)
            })
            .filter(Boolean) // Remove null entries (never types or invalid types)
            .join('\n            ');

        return fieldEntries || '[k: string]: unknown;';
    }

    private generateDoctypeTypesContent(doctypes: DoctypeMetadata[]): string {
        if (!doctypes?.length) {
            return `
            type DoctypeName = never;
            interface BaseDoctype {};`;
        }

        const doctypeEntries = doctypes.map(doctype => {
            const fieldsContent = this.generateDoctypeFields(doctype.schema.fields);
            return `"${doctype.name}": {
            ${fieldsContent}
        }`;
        }).join(',\n        ');

        return `
        type DoctypeName = keyof BaseDoctype;
        interface BaseDoctype {
        ${doctypeEntries}
    }`;
    }

    private generateUtilityTypes(): string {
        return `
// Standard fields that are common to all doctypes
interface StandardFields {
        ${this.generateStandardFields()}
    }

// Utility type to select a doctype with standard fields merged
type SelectDoctype<T extends keyof BaseDoctype> = BaseDoctype[T] & StandardFields;

// Utility type to insert a doctype with standard fields merged (all fields optional)
type InsertDoctype<T extends keyof BaseDoctype> = BaseDoctype[T] & Partial<StandardFields>;

type UpdateDoctype<T extends keyof BaseDoctype> = Partial<BaseDoctype[T]> & Partial<StandardFields>;
`;
    }

    private async generateGlobalNamespace(namespaceContent: string[], globalContent: string[]): Promise<string> {
        const content = `declare global {
            ${globalContent.join('\n        ')}
    namespace Zodula {
        ${namespaceContent.join('\n        ')}
    }
}

export {}`;

        return await prettier.format(content, { parser: "typescript" });
    }

    static async generate(): Promise<string> {
        const typeGenerator = new TypeGenerator();

        // Get data from loader
        const apps = loader.from("app").list();
        const doctypes = loader.from("doctype").list();

        // Generate type content
        const appTypesContent = typeGenerator.generateAppTypesContent(apps);
        const doctypeTypesContent = typeGenerator.generateDoctypeTypesContent(doctypes);
        const utilityTypesContent = typeGenerator.generateUtilityTypes();
        // Generate and format final content
        const formattedContent = await typeGenerator.generateGlobalNamespace([
            appTypesContent,
            doctypeTypesContent,
            utilityTypesContent,
        ], [

        ]);

        await Bun.write(path.join(process.cwd(), ".zodula", "zodula.d.ts"), formattedContent);

        return formattedContent;
    }
}