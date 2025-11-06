import { Glob } from "bun";
import path from "path";
import { LoaderHelper } from "../../helper";
import { loader } from "../..";
import { ZodulaDoctypeHelper } from "../../../zodula/doc/helper";
import prettier, { doc } from "prettier";

import { z } from "bxo";
import type { FieldTypes } from "@/zodula/server/field/type";
import { ClientFieldHelper } from "@/zodula/client/field";
import { FieldHelper } from "../../../field";
import { logger } from "../../../logger";
import { getConnection, subscriptions } from "@/zodula/server/zodula/realtime";
import { zodula } from "@/zodula/server";


function capitalize(str: string) {
    // this must also replace _ with space and capitalize the first letter of the word
    return str.replace(/_/g, " ").split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
/**
 * Suffix used for generating default relative field aliases
 */
export const SUFFIX_REF_TABLE = "_items"
export const SUFFIX_EXTEND = "_extend"

/**
 * Available doctype events that can be hooked into
 */
export type DoctypeEvent =
    | "before_insert"
    | "after_insert"
    | "before_save"
    | "after_save"
    | "before_delete"
    | "after_delete"
    | "before_change"
    | "after_change"
    | "before_submit"
    | "after_submit"
    | "before_cancel"
    | "after_cancel"
    | "before_save_after_submit"
    | "after_save_after_submit"


/**
 * Event context containing old and new document data
 */
export interface EventContext<FIELDS extends Record<string, Zodula.Field> = Record<string, Zodula.Field>> {
    old: FieldTypes<FIELDS>
    doc: FieldTypes<FIELDS>
    input: FieldTypes<FIELDS> | undefined
}

/**
 * Event context with typed doctype names
 */
export interface EventContextByName<DN extends Zodula.DoctypeName> {
    old: Zodula.SelectDoctype<DN>
    doc: Zodula.SelectDoctype<DN>
    input: Zodula.InsertDoctype<DN> | Zodula.UpdateDoctype<DN> | undefined
}

/**
 * Callback function for doctype events
 */
export type DoctypeEventCallback<FIELDS extends Record<string, Zodula.Field> = Record<string, Zodula.Field>> = (data: EventContext<FIELDS>) => void

/**
 * Callback function for doctype events with typed doctype names
 */
export type DoctypeEventCallbackByName<DN extends Zodula.DoctypeName> = (data: EventContextByName<DN>) => void

/**
 * Metadata for a loaded doctype
 */
export interface DoctypeMetadata {
    /** The full doctype name (e.g., "zodula__User") */
    name: Zodula.DoctypeName;
    /** Absolute path to the doctype file */
    dir: string;
    /** Name of the app this doctype belongs to */
    appName: string;
    /** Domain name for the doctype */
    domainName: string;
    /** Complete doctype schema including fields */
    schema: Zodula.DoctypeSchema;
    /** Doctype configuration without fields */
    config: Omit<Zodula.DoctypeSchema, "fields">;
    /** List of relative relationships */
    relatives: DoctypeRelative[];
}

/**
 * Represents a relationship between two doctypes
 */
export interface DoctypeRelative {
    /** The parent doctype that will contain the relative field */
    parentDoctype: Zodula.DoctypeName;
    /** The child doctype being referenced */
    childDoctype: Zodula.DoctypeName;
    /** The field name in the child doctype */
    childFieldName: string;
    /** The alias for the relative field in the parent */
    alias: string;
    /** Type of relationship */
    type: "Reference" | "One to One" | "One to Many";
    /** Label for the relative field */
    reference_label: string;
    /** Field name to place the relative field after */
    below_field?: string;
}

/**
 * Plugin interface for doctype loading functionality
 */
export interface DoctypePlugin {
    load(): Promise<DoctypeMetadata[]>;
    list(): DoctypeMetadata[];
    get(name: string): DoctypeMetadata;
    validate(): Promise<void>;
}

/**
 * Global event registry for doctype events
 */
export const events = new Map<Zodula.DoctypeName, Map<DoctypeEvent, DoctypeEventCallback[]>>()

/**
 * Handler for defining doctype schemas and event callbacks
 * 
 * @template FIELDS - The field definitions for this doctype
 */
export class DoctypeHandler<DOCTYPENAME extends Zodula.DoctypeName = Zodula.DoctypeName, FIELDS extends Record<string, Zodula.Field> = Record<string, Zodula.Field>> {
    /** The processed fields for this doctype */
    fields: FIELDS
    /** The doctype configuration */
    config: Zodula.DoctypeConfig
    /** Registered event callbacks */
    doctypeEvents: Map<DoctypeEvent, DoctypeEventCallbackByName<DOCTYPENAME>> = new Map<DoctypeEvent, DoctypeEventCallbackByName<DOCTYPENAME>>()

    /**
     * Creates a new doctype handler
     * 
     * @param fields - The field definitions
     * @param schema - The doctype schema configuration
     */
    constructor(fields: FIELDS, schema: Omit<Zodula.DoctypeSchema, "fields"> = {}) {
        const _fields = {
            ...fields,
            ...ClientFieldHelper.standardFields()
        }

        // Sort fields to have id first and other standard fields at last
        const sortedFields = Object.keys(fields).sort((a, b) => {
            if (a === "id") return -1
            if (b === "id") return 1
            return 0
        })
        const sortedFieldsObject = sortedFields.reduce((acc, field) => {
            acc[field] = _fields[field as keyof typeof _fields]
            return acc
        }, {} as Record<string, Zodula.Field>)

        this.fields = sortedFieldsObject as FIELDS
        this.config = schema
    }

    /**
     * Registers an event callback for the current doctype
     * 
     * @param event - The event name
     * @param callback - The callback function
     * @returns This handler for method chaining
     */
    on(event: DoctypeEvent, callback: DoctypeEventCallbackByName<DOCTYPENAME>) {
        this.doctypeEvents.set(event, callback)
        return this
    }
}

/**
 * Main loader class for doctypes
 * 
 * Handles loading, processing, and validation of doctype definitions.
 * Supports field ordering with below_field attribute and generates TypeScript types.
 */
export class DoctypeLoader implements DoctypePlugin {
    /** Internal storage for loaded doctypes */
    private doctypes: DoctypeMetadata[] = []

    /**
     * Creates a new doctype handler
     * 
     * @param fields - The field definitions
     * @param schema - The doctype schema configuration
     * @returns A new DoctypeHandler instance
     */
    $doctype<DOCTYPENAME extends Zodula.DoctypeName = Zodula.DoctypeName, FIELDS extends Record<string, Zodula.Field> = Record<string, Zodula.Field>>(fields: FIELDS, schema: Omit<Zodula.DoctypeSchema, "fields"> = {}) {
        return new DoctypeHandler<DOCTYPENAME, FIELDS>(fields, schema)
    }

    /**
     * Triggers an event for a specific doctype
     * 
     * @param doctypeName - The name of the doctype
     * @param event - The event to trigger
     * @param data - The event context data
     * @returns Promise that resolves when all callbacks complete
     */
    async trigger<TN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctypeName: TN, event: DoctypeEvent, data: EventContextByName<TN>) {
        const _events = events.get(doctypeName) || new Map<DoctypeEvent, DoctypeEventCallback[]>()
        const doctypeEvents = _events.get(event) || []
        // find subscriptions for this doctype and event
        const subscriptionsForDoctype = Object.entries(subscriptions).filter(([_, subscription]) => subscription.paths.includes(`/doctypes/${doctypeName}/${event}`)).map(([_, subscription]) => _)
        for (const subscription of subscriptionsForDoctype) {
            const connection = getConnection(subscription)
            if (connection) {
                connection.send(JSON.stringify({
                    type: "event",
                    event: event,
                    data: {
                        old: zodula.utils.safe(doctypeName, data.old),
                        doc: zodula.utils.safe(doctypeName, data.doc),
                        input: zodula.utils.safe(doctypeName, data.input as any)
                    }
                }))
            }
        }
        // Wait for all callbacks to complete
        await Promise.all(doctypeEvents.map(async callback => {
            if (callback) {
                await callback(data as any)
            }
        }))

        return true
    }

    /**
     * Gets utility helpers for doctype operations
     */
    get utils() {
        return ZodulaDoctypeHelper
    }

    /**
     * Reorders fields based on the below_field attribute of relatives
     */
    private reorderFieldsWithBelowField(fields: Record<string, Zodula.Field>, relatives: DoctypeRelative[]): void {
        const relativesWithBelowField = this.getRelativesWithBelowField(relatives);
        if (relativesWithBelowField.length === 0) return;

        const orderedFields = this.buildOrderedFields(fields, relativesWithBelowField);
        this.replaceFields(fields, orderedFields);
    }

    /**
     * Gets relatives that have below_field specified and are relationship types
     */
    private getRelativesWithBelowField(relatives: DoctypeRelative[]): DoctypeRelative[] {
        return relatives.filter(rel =>
            rel.below_field && ["One to One", "One to Many"].includes(rel.type)
        );
    }

    /**
     * Builds an ordered fields object with relatives placed after their below_field
     */
    private buildOrderedFields(fields: Record<string, Zodula.Field>, relativesWithBelowField: DoctypeRelative[]): Record<string, Zodula.Field> {
        const orderedFields: Record<string, Zodula.Field> = {};
        const fieldKeys = Object.keys(fields);

        for (const fieldKey of fieldKeys) {
            if (!fieldKey) continue;

            const field = fields[fieldKey];
            if (!field) continue;

            // Add the current field
            orderedFields[fieldKey] = field;

            // Insert relative fields that should be placed after this field
            this.insertRelativeFieldsAfter(orderedFields, fields, fieldKey, relativesWithBelowField);
        }

        return orderedFields;
    }

    /**
     * Inserts relative fields that should be placed after the specified field
     */
    private insertRelativeFieldsAfter(
        orderedFields: Record<string, Zodula.Field>,
        originalFields: Record<string, Zodula.Field>,
        fieldKey: string,
        relativesWithBelowField: DoctypeRelative[]
    ): void {
        const relativesToInsert = relativesWithBelowField.filter(rel =>
            rel.below_field === fieldKey && originalFields[rel.alias]
        );

        for (const relative of relativesToInsert) {
            const relativeField = originalFields[relative.alias];
            if (relativeField) {
                orderedFields[relative.alias] = relativeField;
            }
        }
    }

    /**
     * Replaces the original fields with the ordered fields
     */
    private replaceFields(originalFields: Record<string, Zodula.Field>, orderedFields: Record<string, Zodula.Field>): void {
        Object.keys(originalFields).forEach(key => delete originalFields[key]);
        Object.assign(originalFields, orderedFields);
    }

    /**
     * Processes doctype fields, sorts them, and builds relatives
     */
    private processDoctypeFields(
        doctypeWithConfig: DoctypeHandler | undefined,
        standardFields: Record<string, Zodula.Field>,
        doctypeName: Zodula.DoctypeName,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>
    ): Record<string, Zodula.Field> {
        let fields = {
            ...doctypeWithConfig?.fields || {},
            ...standardFields
        } as Record<string, Zodula.Field>;

        for (const [key, value] of Object.entries(fields)) {
            fields[key] = {
                ...value,
                label: value?.label || capitalize(key)
            } as Zodula.Field;
        }

        const sortedFields = this.sortFields(fields);
        return this.buildSortedFieldsWithRelatives(fields, sortedFields, doctypeName, relatives);
    }

    /**
     * Sorts fields with id first
     */
    private sortFields(fields: Record<string, Zodula.Field>): string[] {
        return Object.keys(fields).sort((a, b) => {
            if (a === "id") return -1;
            if (b === "id") return 1;
            return 0;
        });
    }

    /**
     * Builds sorted fields object and processes relatives
     */
    private buildSortedFieldsWithRelatives(
        fields: Record<string, Zodula.Field>,
        sortedFields: string[],
        doctypeName: Zodula.DoctypeName,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>
    ): Record<string, Zodula.Field> {
        return sortedFields.reduce((acc, field) => {
            acc[field] = {
                ...fields[field as keyof typeof fields],
                name: field
            } as Zodula.Field;

            this.processFieldReference(fields, field, doctypeName, relatives);
            return acc;
        }, {} as Record<string, Zodula.Field>);
    }

    /**
     * Processes field references and builds relatives
     */
    private processFieldReference(
        fields: Record<string, Zodula.Field>,
        fieldName: string,
        doctypeName: Zodula.DoctypeName,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>
    ): void {
        const fieldConfig = fields[fieldName as keyof typeof fields];
        const reference = fieldConfig?.reference;

        if (!reference || ClientFieldHelper.isStandardField(fieldName)) {
            return;
        }

        const relativesList = relatives.get(reference as Zodula.DoctypeName) || [];

        if (reference !== doctypeName) {
            const relative = this.createDoctypeRelative(fieldConfig, fieldName, doctypeName, reference);
            relativesList.push(relative);
            relatives.set(reference as Zodula.DoctypeName, relativesList);
        }
    }

    /**
     * Creates a DoctypeRelative object from field configuration
     */
    private createDoctypeRelative(
        fieldConfig: Zodula.Field,
        fieldName: string,
        doctypeName: Zodula.DoctypeName,
        reference: string
    ): DoctypeRelative {
        return {
            parentDoctype: reference as Zodula.DoctypeName,
            childDoctype: doctypeName,
            childFieldName: fieldName,
            alias: fieldConfig?.reference_alias || `${doctypeName}${fieldConfig?.reference_type === "One to Many" ? SUFFIX_REF_TABLE : SUFFIX_EXTEND}`,
            type: fieldConfig?.reference_type || "Reference",
            reference_label: fieldConfig?.reference_label || "",
            below_field: fieldConfig?.below_field || undefined
        };
    }

    /**
     * Processes doctype events and registers them
     */
    private processDoctypeEvents(doctypeWithConfig: DoctypeHandler | undefined, doctypeName: Zodula.DoctypeName): void {
        const doctypeEvents = doctypeWithConfig?.doctypeEvents || [];

        for (const [eventName, callback] of doctypeEvents) {
            this.registerDoctypeEvent(doctypeName, eventName, callback);
        }
    }

    /**
     * Registers a single doctype event
     */
    private registerDoctypeEvent(doctypeName: Zodula.DoctypeName, eventName: DoctypeEvent, callback: DoctypeEventCallback): void {
        const doctypeEvents = events.get(doctypeName) || new Map<DoctypeEvent, DoctypeEventCallback[]>();
        const eventCallbacks = doctypeEvents.get(eventName) || [];

        eventCallbacks.push(callback);
        doctypeEvents.set(eventName, eventCallbacks);
        events.set(doctypeName, doctypeEvents);
    }

    /**
     * Imports a doctype handler with proper error handling
     */
    private async importDoctypeHandler(doctypePath: string): Promise<{ default: DoctypeHandler } | null> {
        try {
            return await import(doctypePath) as { default: DoctypeHandler };
        } catch (error) {
            console.error(`[Error] Failed to import doctype from ${doctypePath}:`, error);
            return null;
        }
    }

    /**
     * Validates doctype metadata before adding to collection
     */
    private validateDoctypeMetadata(doctype: DoctypeMetadata): void {
        if (!doctype.name) {
            throw new Error(`Doctype name is required for doctype at ${doctype.dir}`);
        }

        if (!doctype.appName) {
            logger.warn(`No app name found for doctype ${doctype.name} at ${doctype.dir}`);
        }
    }

    /**
     * Safely gets doctype with error handling
     */
    private safeGetDoctype(name: Zodula.DoctypeName): DoctypeMetadata | null {
        try {
            return this.get(name);
        } catch (error) {
            console.error(`[Error] Failed to get doctype ${name}:`, error);
            return null;
        }
    }

    /**
     * Loads a single doctype from file path
     */
    private async loadSingleDoctype(
        doctypePath: string,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>
    ): Promise<DoctypeMetadata | null> {
        const comparePath = doctypePath.replace(".doctype.ts", "");
        const app = loader.from("app").getAppByPath(comparePath);
        const appName = app?.packageName as Zodula.AppName || "";
        const filename = path.basename(comparePath).split("/").pop() || "";
        const doctypeName = `${appName}__${filename}` as Zodula.DoctypeName;
        const domain = LoaderHelper.getDomainByPath(comparePath);
        const domainName = domain?.name || "";
        if (filename.startsWith("_")) {
            logger.warn(`Skipping doctype ${doctypeName} because it starts with _`);
            return null;
        }

        const handlerImport = await this.importDoctypeHandler(doctypePath);
        if (!handlerImport) return null;

        const doctypeWithConfig = handlerImport.default;
        const standardFields = ClientFieldHelper.standardFields();
        let config = Object.assign({}, doctypeWithConfig?.config || {}) as any;

        config.label = doctypeWithConfig?.config?.label || doctypeName;

        this.processDoctypeEvents(doctypeWithConfig, doctypeName);
        const fields = this.processDoctypeFields(doctypeWithConfig, standardFields, doctypeName, relatives);

        // Check if any field has reference_type of "One to One" or "One to Many"
        const hasChildDoctypeField = Object.values(fields).some(field => {
            const referenceType = (field as any)?.reference_type;
            return referenceType === "One to One" || referenceType === "One to Many";
        });

        if (hasChildDoctypeField) {
            config.is_child_doctype = 1;
        }

        const doctypeMetadata: DoctypeMetadata = {
            name: doctypeName,
            dir: path.resolve(doctypePath),
            appName: appName,
            domainName: domainName,
            schema: {
                fields: fields,
                ...config
            },
            config: config || {},
            relatives: []
        };

        this.validateDoctypeMetadata(doctypeMetadata);
        return doctypeMetadata;
    }

    /**
     * Assigns relatives to their respective doctypes
     */
    private assignRelativesToDoctypes(relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>): void {
        this.doctypes.forEach(doctype => {
            const doctypeRelatives = relatives.get(doctype.name) || [];
            doctype.relatives = doctypeRelatives;
        });
    }


    /**
     * Loads all doctype definitions from the filesystem
     * 
     * Scans for .doctype.ts files in apps/zodula/doctype/core/ directories and processes them.
     * Handles field relationships, event registration, and metadata extraction.
     * 
     * @returns Promise resolving to array of loaded doctype metadata
     */
    async load(): Promise<DoctypeMetadata[]> {
        const doctypesGlob = new Glob("apps/*/doctypes/*/*.doctype.ts");
        events.clear()
        this.doctypes = []
        const _relatives = new Map<Zodula.DoctypeName, DoctypeRelative[]>()

        for await (const doctypePath of doctypesGlob.scan(".")) {
            const doctypeMetadata = await this.loadSingleDoctype(doctypePath, _relatives);
            if (doctypeMetadata) {
                this.doctypes.push(doctypeMetadata);
            }
        }
        this.assignRelativesToDoctypes(_relatives);
        return this.doctypes;
    }

    /**
     * Gets all loaded doctypes
     * 
     * @returns Array of doctype metadata
     */
    list(): DoctypeMetadata[] {
        return this.doctypes;
    }

    /**
     * Gets a specific doctype by name
     * 
     * @param name - The doctype name to retrieve
     * @returns The doctype metadata
     * @throws Error if doctype not found
     */
    get(name: Zodula.DoctypeName) {
        const doctype = this.doctypes.find((doctype) => doctype.name === name);
        if (!doctype) {
            throw new Error(`Doctype ${name} not found`);
        }
        return doctype;
    }

    /**
     * Validates all loaded doctypes and generates type definitions
     * 
     * Performs the following operations:
     * 1. Validates doctype names for duplicates
     * 2. Processes relative fields and adds them to parent doctypes
     * 3. Reorders fields based on below_field attributes
     * 4. Generates TypeScript type definitions
     * 
     * @throws Error if validation fails
     */
    async validate(): Promise<void> {
        this.validateDoctypeNames();
        this.processRelativeFields();
        await this.generateTypeDefinitions();
    }

    /**
     * Validates that there are no duplicate doctype names
     */
    private validateDoctypeNames(): void {
        if (this.doctypes.length !== new Set(this.doctypes.map((doctype) => doctype.name)).size) {
            throw new Error("Duplicate doctype names");
        }
    }

    /**
     * Processes relative fields and reorders them
     */
    private processRelativeFields(): void {
        for (const doctype of this.doctypes) {
            this.processDoctypeRelatives(doctype);
            this.reorderFieldsWithBelowField(doctype.schema.fields, doctype.relatives);
        }
    }

    /**
     * Processes relatives for a single doctype
     */
    private processDoctypeRelatives(doctype: DoctypeMetadata): void {
        for (const relative of doctype.relatives) {
            if (["One to One", "One to Many"].includes(relative.type)) {
                this.addRelativeField(doctype, relative);
            }
        }
    }

    /**
     * Adds a relative field to a doctype
     */
    private addRelativeField(doctype: DoctypeMetadata, relative: DoctypeRelative): void {
        const doctypeFields = doctype.schema.fields;

        if (doctypeFields[relative.alias]) {
            throw new Error(`Duplicate fieldname ${relative.alias} in ${doctype.name}`);
        }

        const relativeConfig = this.safeGetDoctype(relative.childDoctype)?.schema.fields[relative.childFieldName]

        doctypeFields[relative.alias] = {
            name: relative.alias,
            label: relative.reference_label,
            type: relative.type === "One to One" ? "Extend" : "Reference Table",
            reference: relative.childDoctype,
            reference_alias: relativeConfig?.name,
            no_copy: 1,
        };
    }

    /**
     * Generates TypeScript type definitions
     */
    private async generateTypeDefinitions(): Promise<void> {
        await this.generateCoreDoctypeTypes();
        await this.generateDoctypeZodTypes();
    }

    /**
     * Generates core-doctype.d.ts file
     */
    private async generateCoreDoctypeTypes(): Promise<void> {
        const doctypeMetadata = this.safeGetDoctype("zodula__Doctype");
        const fieldMetadata = this.safeGetDoctype("zodula__Field");

        if (!doctypeMetadata || !fieldMetadata) {
            logger.warn("Core doctypes not found, skipping type generation");
            return;
        }

        const doctypeFields = doctypeMetadata.schema.fields;
        const fieldFields = fieldMetadata.schema.fields;

        const withoutStandardFields = this.filterStandardFields(doctypeFields);
        const withoutStandardFieldsFields = this.filterStandardFields(fieldFields);

        const coreDoctypeContent = this.buildCoreDoctypeContent(withoutStandardFields, withoutStandardFieldsFields);

        try {
            await Bun.write(
                path.join(".zodula", "core-doctype.d.ts"),
                await prettier.format(coreDoctypeContent, { parser: "typescript" })
            );
        } catch (error) {
            logger.error("Failed to generate core-doctype.d.ts:", error);
        }
    }

    /**
     * Generates doctype-zod.ts file
     */
    private async generateDoctypeZodTypes(): Promise<void> {
        try {
            const doctypeZodContent = this.buildDoctypeZodContent();

            await Bun.write(
                path.join(".zodula", "doctype-zod.ts"),
                await prettier.format(doctypeZodContent, { parser: "typescript" })
            );
        } catch (error) {
            logger.error("Failed to generate doctype-zod.ts:", error);
        }
    }

    /**
     * Filters out standard fields from field definitions
     */
    private filterStandardFields(fields: Record<string, Zodula.Field>): Record<string, Zodula.Field> {
        return Object.fromEntries(
            Object.entries(fields).filter(([fieldName]) =>
                !Object.keys(ClientFieldHelper.standardFields()).includes(fieldName)
            )
        );
    }

    /**
     * Builds the core doctype TypeScript content
     */
    private buildCoreDoctypeContent(
        withoutStandardFields: Record<string, Zodula.Field>,
        withoutStandardFieldsFields: Record<string, Zodula.Field>
    ): string {
        return `
            declare global {
                namespace Zodula {
                type FieldType = ${FieldHelper.getFieldTypes().map(fieldType => `"${fieldType}"`).join(" | ")}
                interface DoctypeConfig {
                    ${this.buildDoctypeConfigInterface(withoutStandardFields)}
                }
                    interface DoctypeSchema extends DoctypeConfig {
                        fields: Record<string, Field>
                    }

                    interface Field<T extends Zodula.FieldType = Zodula.FieldType, R extends 0 | 1 = 0 | 1 > {
                        type: T
                        required?: R
                        ${this.buildFieldInterface(withoutStandardFieldsFields)}
                    }
                }
            }
            export { };
        `;
    }

    /**
     * Builds the doctype config interface content
     */
    private buildDoctypeConfigInterface(fields: Record<string, Zodula.Field>): string {
        return Object.entries(fields).map(([key, value]) => {
            const isRequired = (value as any)?.required === true;
            const type = FieldHelper.getTypescriptType(value);

            if (type === "never") return "";
            if (["app"].includes(key)) return "";
            if (["Reference Table", "Extend"].includes(value.type)) return "";

            return `"${key}"${isRequired ? "" : "?"}: ${FieldHelper.getTypescriptType(value)}`;
        }).join("\n");
    }

    /**
     * Builds the field interface content
     */
    private buildFieldInterface(fields: Record<string, Zodula.Field>): string {
        return Object.entries(fields).map(([key, value]) => {
            const isRequired = (value as any)?.required === true;
            const type = FieldHelper.getTypescriptType(value);

            if (key === "type") return "";
            if (type === "never") return "";
            if (key === "required") return "";
            if (["Reference Table", "Extend"].includes(value.type)) return "";

            return `"${key}"${isRequired ? "" : "?"}: ${type} ${isRequired ? "" : "| null"}`;
        }).join("\n");
    }

    /**
     * Builds the doctype zod content
     */
    private buildDoctypeZodContent(): string {
        return `
        import { z } from "bxo"

        export const standardFieldsZod = {
            ${this.buildStandardFieldsZod()}
        }

        export class baseDoctypeZods {
            ${this.buildBaseDoctypeZods()}
        }

        export class doctypeZods {
            ${this.buildDoctypeZods()}
        }
        `;
    }

    /**
     * Builds standard fields zod schema
     */
    private buildStandardFieldsZod(): string {
        return Object.entries(ClientFieldHelper.standardFields()).map(([key, value]) => {
            const isRequired = (value as any)?.required === 1;
            const textZodSchema = FieldHelper.getTextZodSchema(value);

            if (textZodSchema === null) return "";

            return `"${key}": ${FieldHelper.getTextZodSchema(value)}${isRequired ? "" : ".nullish().optional()"},`;
        }).join("\n");
    }

    /**
     * Builds base doctype zod schemas
     */
    private buildBaseDoctypeZods(): string {
        return this.doctypes.map(d => {
            const fieldsZod = this.buildDoctypeFieldsZod(d.schema.fields);
            return "static \"" + d.name + "\" = z.object({\n" +
                "                    " + fieldsZod + "\n" +
                "            ...standardFieldsZod,\n" +
                "                }).partial()\n" +
                "            ";
        }).join("\n");
    }

    /**
     * Builds doctype zod schemas
     */
    private buildDoctypeZods(): string {
        return this.doctypes.map(d => {
            const relativeFieldsZod = this.buildRelativeFieldsZod(d.schema.fields);
            return "static \"" + d.name + "\" = baseDoctypeZods[\"" + d.name + "\"]\n" +
                "            .extend({\n" +
                "            " + relativeFieldsZod + "\n" +
                "            })\n" +
                "            .partial()\n" +
                "            ";
        }).join("\n");
    }

    /**
     * Builds doctype fields zod schema
     */
    private buildDoctypeFieldsZod(fields: Record<string, Zodula.Field>): string {
        return Object.entries(fields).map(([key, value]) => {
            if (["Reference Table", "Extend"].includes(value.type)) return "";

            const isOptional = value.required !== 1;
            const isStandardField = Object.keys(ClientFieldHelper.standardFields()).includes(key);

            if (isStandardField) return "";

            const textZodSchema = FieldHelper.getTextZodSchema(value);
            if (textZodSchema === null) return "";

            const type = FieldHelper.getTypescriptType(value);
            if (type === "never") return "";

            return "\"" + key + "\": " + FieldHelper.getTextZodSchema(value) + ((isOptional || isStandardField) ? ".nullish()" : "") + ",";
        }).filter(Boolean).join("\n");
    }

    /**
     * Builds relative fields zod schema
     */
    private buildRelativeFieldsZod(fields: Record<string, Zodula.Field>): string {
        return Object.entries(fields).map(([key, value]) => {
            if (!["Reference Table", "Extend"].includes(value.type)) return "";

            return "\"" + key + "\": " + FieldHelper.getTextZodSchema(value) + ((value.required !== 1) ? ".nullish()" : "") + ",";
        }).filter(Boolean).join("\n");
    }
}
