# What is a Doctype?

A **doctype** (document type) is the schema and configuration for a kind of document in Zodula. It defines which fields exist, how they behave, and how the form and list are laid out. Each doctype is implemented in a **`.doctype.ts`** file and registered with the global `$doctype` helper.

## File location and naming

- **Path:** `apps/<app>/doctypes/<Domain>/<Doctype Name>/<Doctype Name>.doctype.ts`
- **Example:** `apps/zerp/doctypes/tms/Delivery Note/Delivery Note.doctype.ts`
- The folder name (e.g. `Delivery Note`) becomes the **doctype name** used in code and URLs.

## Structure of a .doctype.ts file

A doctype file exports a single default value: the result of calling `$doctype(fields, config)` (and optionally chaining `.on(...)` for server-side events).

```ts
export default $doctype<"Delivery Note">(
  {
    // field name: field config (docfield)
    customer: {
      type: "Reference",
      label: "Customer",
      reference: "Customer",
      required: 1,
    },
    posting_date: {
      type: "Date",
      label: "Posting Date",
      required: 1,
      default: "TODAY()",
    },
    delivery_note_items: {
      type: "Reference Table",
      label: "Delivery Note Items",
      reference: "Delivery Note Item",
      required: 0,
    },
    // ... more fields
  },
  {
    // doctype config (label, naming, tabs, etc.)
    label: "Delivery Note",
    naming_series: "DO{{doc_organization_abbr}}-{YYYY}-{MM}-{DD}-{#####}",
    is_submittable: 1,
    display_field: "customer_name",
    search_fields: "customer\ncustomer_name",
    tabs: JSON.stringify([...]),
  }
)
  .on("before_submit", async ({ doc }) => { ... })
  .on("after_submit", async ({ doc }) => { ... });
```

- **First argument:** an object of **fields** (docfields). Each key is the field name; each value is a [Field / docfield](docfield.md) config.
- **Second argument:** [doctype config](doctype-config.md) (label, naming_series, is_submittable, tabs, etc.).
- **Optional generic:** `$doctype<"Doctype Name">(...)` gives correct TypeScript types for the doctype name.

## Doctype schema vs config

- **DoctypeSchema** = **DoctypeConfig** + **fields**. It is the full definition (config + all field definitions).
- **DoctypeConfig** = metadata that applies to the doctype as a whole (label, naming, submittable, tabs, etc.). No field definitions.
- At runtime, the loader merges your custom fields with **standard fields** (e.g. `id`, `doc_organization`, `owner`, `created_at`, `doc_status`) and builds the full schema.

## What a doctype controls

1. **Data shape** — Which columns exist and their types (via fields).
2. **Validation** — Required, unique, and type rules (from field types and options).
3. **Form layout** — Tabs, sections, and which fields appear where (via [layouting](layouting.md) in config).
4. **List behavior** — Which fields show in list/tree/sheet, display field, search fields (from config and field flags like `in_list_view`).
5. **Server hooks** — Lifecycle events (e.g. `before_submit`, `after_insert`) via `.on(event, callback)`.

## Related docs

- [Docfield (field definition)](docfield.md)
- [Doctype config](doctype-config.md)
- [Layouting (tabs and form layout)](layouting.md)
