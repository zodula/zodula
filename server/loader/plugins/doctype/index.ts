import { Glob } from "bun";
import path from "path";
import { LoaderHelper } from "../../helper";
import { loader } from "../..";
import { ZodulaDoctypeHelper } from "../../../zodula/doc/helper";
import prettier, { doc } from "prettier";

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
    /** List of relative relationships (one-way: child references parent) */
    relatives: DoctypeRelative[];
    /** List of child relationships (parent has Reference Table or Extend fields) */
    children: DoctypeChild[];
}

/**
 * Represents a relationship between two doctypes (one-way: child references parent)
 */
export interface DoctypeRelative {
    /** The parent doctype that will contain the relative field */
    parentDoctype: Zodula.DoctypeName;
    /** The child doctype being referenced */
    childDoctype: Zodula.DoctypeName;
    /** The field name in the child doctype */
    childFieldName: string;
}

/**
 * Represents a child relationship from parent to child (via Reference Table or Extend fields)
 */
export interface DoctypeChild {
    /** The parent doctype that contains the Reference Table or Extend field */
    parentDoctype: Zodula.DoctypeName;
    /** The child doctype being referenced */
    childDoctype: Zodula.DoctypeName;
    /** The field name in the parent doctype (Reference Table or Extend field) */
    parentFieldName: string;
    /** The type of relationship: "Reference Table" or "Extend" */
    type: "Reference Table" | "Extend";
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
     * Processes doctype fields, sorts them, and detects relatives and children
     */
    private processDoctypeFields(
        doctypeWithConfig: DoctypeHandler | undefined,
        standardFields: Record<string, Zodula.Field>,
        doctypeName: Zodula.DoctypeName,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>,
        children: Map<Zodula.DoctypeName, DoctypeChild[]>
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
        return this.buildSortedFields(fields, sortedFields, doctypeName, relatives, children);
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
     * Builds sorted fields object and detects relatives and children
     */
    private buildSortedFields(
        fields: Record<string, Zodula.Field>,
        sortedFields: string[],
        doctypeName: Zodula.DoctypeName,
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>,
        children: Map<Zodula.DoctypeName, DoctypeChild[]>
    ): Record<string, Zodula.Field> {
        // Process children first (Reference Table and Extend fields)
        this.processChildren(fields, doctypeName, children);

        return sortedFields.reduce((acc, field) => {
            acc[field] = {
                ...fields[field as keyof typeof fields],
                name: field
            } as Zodula.Field;

            // Detect relatives from field references (excluding Reference Table and Extend)
            this.processFieldReference(fields, field, doctypeName, relatives);
            return acc;
        }, {} as Record<string, Zodula.Field>);
    }

    /**
     * Processes field references and builds relatives for storage in Doctype Relative records
     * Stores: parent_doctype, child_doctype, child_field_name
     * This is one-way: tracks when a child doctype references a parent doctype
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

        // Don't create self-references
        if (reference === doctypeName) {
            return;
        }

        // Skip Reference Table and Extend fields - they are handled by processChildren
        if (fieldConfig.type === "Reference Table" || fieldConfig.type === "Extend") {
            return;
        }

        const relativesList = relatives.get(reference as Zodula.DoctypeName) || [];

        // Create relative (one-way: child references parent)
        const relative: DoctypeRelative = {
            parentDoctype: reference as Zodula.DoctypeName,
            childDoctype: doctypeName,
            childFieldName: fieldName
        };

        relativesList.push(relative);
        relatives.set(reference as Zodula.DoctypeName, relativesList);
    }

    /**
     * Processes Reference Table and Extend fields to build children relationships
     * Stores: parent_doctype, child_doctype, parent_field_name, child_field_name, type
     * Validates that reference_field is provided for Reference Table and Extend fields
     */
    private processChildren(
        fields: Record<string, Zodula.Field>,
        doctypeName: Zodula.DoctypeName,
        children: Map<Zodula.DoctypeName, DoctypeChild[]>
    ): void {
        for (const [fieldName, fieldConfig] of Object.entries(fields)) {
            // Only process Reference Table and Extend fields
            if (fieldConfig.type !== "Reference Table" && fieldConfig.type !== "Extend") {
                continue;
            }

            const reference = fieldConfig?.reference;
            if (!reference || ClientFieldHelper.isStandardField(fieldName)) {
                continue;
            }

            // Don't create self-references
            if (reference === doctypeName) {
                continue;
            }
            const childrenList = children.get(doctypeName) || [];

            // Create child relationship
            const child: DoctypeChild = {
                parentDoctype: doctypeName,
                childDoctype: reference as Zodula.DoctypeName,
                parentFieldName: fieldName,
                type: fieldConfig.type as "Reference Table" | "Extend"
            };

            childrenList.push(child);
            children.set(doctypeName, childrenList);
        }
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
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>,
        children: Map<Zodula.DoctypeName, DoctypeChild[]>
    ): Promise<DoctypeMetadata | null> {
        const comparePath = doctypePath.replace(".doctype.ts", "");
        const app = loader.from("app").getAppByPath(comparePath);
        const appName = app?.packageName as Zodula.AppName || "";
        // Extract doctype folder name from path: apps/<app>/doctypes/<domain>/<doctype>/<doctype>.doctype.ts
        const pathParts = comparePath.split("/");
        const doctypeFolderName = pathParts[pathParts.length - 1] || "";
        const doctypeName = `${appName}__${doctypeFolderName}` as Zodula.DoctypeName;
        const domain = LoaderHelper.getDomainByPath(comparePath);
        const domainName = domain?.name || "";
        if (doctypeFolderName.startsWith("_")) {
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
        const fields = this.processDoctypeFields(doctypeWithConfig, standardFields, doctypeName, relatives, children);

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
            relatives: [],
            children: []
        };

        this.validateDoctypeMetadata(doctypeMetadata);
        return doctypeMetadata;
    }

    /**
     * Assigns relatives and children to their respective doctypes
     */
    private assignRelativesAndChildrenToDoctypes(
        relatives: Map<Zodula.DoctypeName, DoctypeRelative[]>,
        children: Map<Zodula.DoctypeName, DoctypeChild[]>
    ): void {
        this.doctypes.forEach(doctype => {
            const doctypeRelatives = relatives.get(doctype.name) || [];
            doctype.relatives = doctypeRelatives;

            const doctypeChildren = children.get(doctype.name) || [];
            doctype.children = doctypeChildren;
        });
    }


    /**
     * Loads all doctype definitions from the filesystem
     * 
     * Scans for .doctype.ts files in apps/{app}/doctypes/{domain}/{doctype}/{doctype}.doctype.ts directories and processes them.
     * Handles field relationships, event registration, and metadata extraction.
     * 
     * @returns Promise resolving to array of loaded doctype metadata
     */
    async load(): Promise<DoctypeMetadata[]> {
        const doctypesGlob = new Glob("apps/*/doctypes/*/*/*.doctype.ts");
        events.clear()
        this.doctypes = []
        const _relatives = new Map<Zodula.DoctypeName, DoctypeRelative[]>()
        const _children = new Map<Zodula.DoctypeName, DoctypeChild[]>()

        for await (const doctypePath of doctypesGlob.scan(".")) {
            const doctypeMetadata = await this.loadSingleDoctype(doctypePath, _relatives, _children);
            if (doctypeMetadata) {
                this.doctypes.push(doctypeMetadata);
            }
        }
        this.assignRelativesAndChildrenToDoctypes(_relatives, _children);
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

    setProperty<DN extends Zodula.DoctypeName, FN extends keyof Zodula.SelectDoctype<DN>, PN extends keyof Zodula.Field<Zodula.FieldType, 0 | 1>>(doctypeName: DN, fieldname: FN, propertyName: PN, value: Zodula.Field[PN]) {
        for (const doctype of this.doctypes) {
            if (doctype.name === doctypeName) {
                if(!doctype.schema.fields[fieldname as keyof typeof doctype.schema.fields]) {
                    doctype.schema.fields[fieldname as keyof typeof doctype.schema.fields] = {} as any;
                }
                (doctype.schema.fields[fieldname as keyof typeof doctype.schema.fields] as any)[propertyName] = value as never;
            }
        }
    }

    getAllChildren(): DoctypeChild[] {
        return this.doctypes.flatMap((doctype) => doctype.children || []);
    }

    /**
     * Validates all loaded doctypes and generates type definitions
     * 
     * Performs the following operations:
     * 1. Validates doctype names for duplicates
     * 2. Validates that Reference Table and Extend fields have reference_field
     * 3. Processes relative fields and adds them to parent doctypes
     * 4. Reorders fields based on below_field attributes
     * 5. Generates TypeScript type definitions
     * 
     * @throws Error if validation fails
     */
    async validate(): Promise<void> {
        this.validateDoctypeNames();
        this.validateChildrenFields();
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
     * Validates that all Reference Table and Extend fields have reference_field specified
     * This validation is performed after all doctypes are loaded to ensure proper error reporting
     */
    private validateChildrenFields(): void {
        for (const doctype of this.doctypes) {
            for (const [fieldName, fieldConfig] of Object.entries(doctype.schema.fields)) {
                // Only check Reference Table and Extend fields
                if (fieldConfig.type !== "Reference Table" && fieldConfig.type !== "Extend") {
                    continue;
                }

                // Skip standard fields
                if (ClientFieldHelper.isStandardField(fieldName)) {
                    continue;
                }

                const reference = fieldConfig?.reference;
                if (!reference) {
                    continue;
                }

                // Don't validate self-references
                if (reference === doctype.name) {
                    continue;
                }
            }
        }
    }

    /**
     * Processes relative fields
     * NOTE: No longer auto-adds or reorders fields - fields must be explicitly defined in doctypes
     */
    private processRelativeFields(): void {
        // Relatives are tracked for metadata purposes only (via Doctype Relative records)
        // Reference Table and Extend fields must be explicitly defined in doctypes
        return;
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
