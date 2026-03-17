# Doctype Config

The **doctype config** is the second argument to `$doctype(fields, config)`. It holds metadata that applies to the doctype as a whole (label, naming, submission, layout, search, etc.), not to individual fields.

## Config properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Human-readable name (e.g. "Delivery Note"). |
| `name` | `string` | Doctype name (usually inferred from folder/file). |
| `naming_series` | `string` | Pattern for auto-generated IDs. See [Naming series](#naming-series). |
| `is_submittable` | `0 \| 1` | If `1`, doc has Draft → Submitted → Cancelled workflow. |
| `track_changes` | `0 \| 1` | Enable change tracking (audit). |
| `comments_enabled` | `0 \| 1` | Enable comments on the doc. |
| `display_field` | `string` | Field name used as primary display in list/link (e.g. `"customer_name"`, `"address_name"`). |
| `search_fields` | `string` | Newline-separated field names used for global search (e.g. `"customer\ncustomer_name"`). |
| `tabs` | `string` | JSON string of tab definitions for form layout. See [Layouting](layouting.md). |
| `is_single` | `0 \| 1` | Single-doc doctype (one record per org). |
| `is_organization_single` | `0 \| 1` | One document per organization (singleton per org). |
| `is_child_doctype` | `0 \| 1` | Doctype is only used as child table (no standalone list). |
| `is_system_generated` | `0 \| 1` | System doctype (e.g. core metadata). |
| `only_fixtures` | `0 \| 1` | Only fixture data (seeded). |
| `is_global` | `0 \| 1` | Global (not org-scoped). |
| `is_quick_entry` | `0 \| 1` | Available in quick-entry dialog. |
| `json_model` | `string` | Custom JSON model (advanced). |
| `additional_connections` | `string` | Extra DB connections (advanced). |
| `insert_tier_required` | `"0"` … `"5"` | Tier required for insert. |

## Naming series

`naming_series` defines how new document IDs are generated when not provided. Placeholders:

| Placeholder | Meaning |
|-------------|---------|
| `{{doc_organization_abbr}}` | Organization abbreviation. |
| `{YYYY}` | 4-digit year. |
| `{YY}` | 2-digit year. |
| `{MM}` | Month. |
| `{DD}` | Day. |
| `{#####}` | Zero-padded running number (e.g. 00001, 00002). |

**Examples:**

```ts
naming_series: "DO{{doc_organization_abbr}}-{YYYY}-{MM}-{DD}-{#####}",
// → DO-ACM-2025-03-06-00001

naming_series: "ADS-{{doc_organization_abbr}}-{YYYY}{MM}{DD}{#####}",
// → ADS-ACM-2025030600001
```

## Example config block

```ts
{
  label: "Delivery Note",
  naming_series: "DO{{doc_organization_abbr}}-{YYYY}-{MM}-{DD}-{#####}",
  is_submittable: 1,
  track_changes: 1,
  comments_enabled: 1,
  display_field: "customer_name",
  search_fields: "customer\ncustomer_name",
  tabs: JSON.stringify([
    {
      type: "Tab",
      label: "Main",
      layout: [
        { type: "section", value: "Basic Information", align: "left" },
        [
          { type: "field", value: "customer", align: "left" },
          { type: "field", value: "posting_date", align: "left" },
        ],
        [
          { type: "field", value: "delivery_note_items", align: "left" },
        ],
      ],
    },
  ]),
}
```

## DoctypeConfig type

In TypeScript, the config object is `Omit<Zodula.DoctypeSchema, "fields">` (i.e. `Zodula.DoctypeConfig`). The full schema is `DoctypeSchema = DoctypeConfig & { fields: Record<string, Field> }`.

## Related

- [What is a Doctype?](what-is-doctype.md)
- [Docfield](docfield.md) — field-level options.
- [Layouting](layouting.md) — structure of `tabs` and `layout`.
