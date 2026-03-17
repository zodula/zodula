# Docfield (Field Definition)

A **docfield** (or just **field**) is the definition of a single column/control in a doctype. Each entry in the first argument of `$doctype(fields, config)` is a field: the key is the **field name**, the value is the **field config** object.

## Field config shape

Field configs implement `Zodula.Field`. Common properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | `Zodula.FieldType` | **Required.** One of: `Text`, `Long Text`, `Password`, `Data`, `Email`, `Integer`, `Float`, `Currency`, `Check`, `JSON`, `Code`, `Select`, `File`, `Image Preview`, `Reference`, `Virtual Reference`, `Date`, `DateTime`, `Time`, `Reference Table`, `Extend`, `Vector`. |
| `label` | `string` | Label shown in UI. |
| `description` | `string` | Helper/description text. |
| `required` | `0 \| 1` | Whether the field is required. |
| `default` | `string` | Default value (e.g. `"TODAY()"`, `"0"`, `"Draft"`). |
| `options` | `string` | For `Select`: newline-separated options (e.g. `"\nDraft\nSubmitted\nCancelled"`). |
| `reference` | `string` | For `Reference` / `Reference Table`: target doctype name (e.g. `"Customer"`, `"Delivery Note Item"`). |
| `fetch_from` | `string` | Dot path to copy value from (e.g. `"billing_address.inline_address"`). |
| `readonly` | `0 \| 1` | Read-only in form. |
| `hidden` | `0 \| 1` | Hidden from UI. |
| `no_print` | `0 \| 1` | Omit from print. |
| `no_copy` | `0 \| 1` | Do not copy when duplicating doc. |
| `in_list_view` | `0 \| 1` | Show in list view. |
| `in_tree_view` | `0 \| 1` | Show in tree view. |
| `unique` | `0 \| 1` | Value must be unique. |
| `filters` | `string` | JSON string of filters for Reference (e.g. list filter). |
| `depends_on` | `string` | Expression to control visibility (e.g. `"doc.price_project && doc.customer"`). |
| `allow_on_submit` | `0 \| 1` | Editable when document is Submitted. |
| `only_create` | `0 \| 1` | Editable only on create. |
| `group` | `string` | Group name for organization. |
| `min` / `max` | `number` | Bounds for numeric types. |
| `min_length` / `length` | `number` | For text. |
| `accept` | `string` | For File (e.g. MIME or extension). |
| `width` | `number` | Display width hint. |
| `in_quick_entry` | `0 \| 1` | Show in quick-entry dialog. |
| `perm_level` | `"0"` … `"5"` | Permission level. |
| `is_auto_generated` | `0 \| 1` | Value is system-generated. |
| `required_on` / `readonly_on` | `string` | Code expression for conditional required/readonly. |

## Field types (summary)

- **Text / Long Text / Data / Email / Password** — String-like; `options` not used for validation on Text.
- **Integer / Float / Currency** — Numbers; `min`/`max` supported.
- **Check** — Boolean; store as `0`/`1`; `default` often `"0"` or `"1"`.
- **Select** — Single choice; **`options` required** (newline-separated list).
- **Date / DateTime / Time** — Date/time; `default` e.g. `"TODAY()"` or `"NOW()"`.
- **Reference** — Link to another doctype; **`reference` required** (doctype name).
- **Reference Table** — Child table; **`reference` required** (child doctype name).
- **Extend** — Nested object stored as JSON; **`reference`** = doctype that defines the nested fields.
- **File / Image Preview** — File upload / image.
- **JSON / Code** — Raw JSON or code; `options` for Code can specify language.

## Example: minimal and common fields

```ts
// Minimal
posting_date: {
  type: "Date",
  label: "Posting Date",
  required: 1,
  default: "TODAY()",
},

// Reference + fetch
customer: {
  type: "Reference",
  label: "Customer",
  reference: "Customer",
  required: 1,
},
customer_name: {
  type: "Text",
  label: "Customer Name",
  readonly: 1,
  fetch_from: "customer.name",
},

// Select
doc_status: {
  type: "Select",
  label: "Status",
  options: "\nDraft\nSubmitted\nCancelled",
  default: "Draft",
  required: 1,
},

// Reference Table (child table)
delivery_note_items: {
  type: "Reference Table",
  label: "Items",
  reference: "Delivery Note Item",
  required: 0,
},

// Conditional visibility
save_price_for: {
  type: "Select",
  label: "Save Price For (Days)",
  options: "\n30\n60\n365",
  depends_on: "doc.price_project && doc.customer",
},
```

## Related

- [What is a Doctype?](what-is-doctype.md)
- [Doctype config](doctype-config.md) — config that applies to the whole doctype (not per field).
- [Layouting](layouting.md) — how fields are arranged in tabs and sections.
