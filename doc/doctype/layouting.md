# Layouting

Form layout is defined in the doctype **config** under the `tabs` property. `tabs` is a **JSON string** of an array of tab objects. Each tab has a `label` and a `layout` array that describes sections and fields.

## Where to set layout

In your `.doctype.ts` file, pass `tabs` in the second argument to `$doctype`:

```ts
export default $doctype(
  { /* fields */ },
  {
    label: "Address",
    tabs: JSON.stringify([
      {
        type: "Tab",
        label: "Main",
        layout: [
          { type: "section", value: "Address Information", align: "left" },
          [
            { type: "field", value: "address_name", align: "left" },
            { type: "field", value: "address_type", align: "left" },
          ],
          [
            { type: "field", value: "address_line1", align: "left" },
            { type: "field", value: "address_line2", align: "left" },
          ],
          [
            { type: "field", value: "city", align: "left" },
            { type: "field", value: "province", align: "left" },
            { type: "field", value: "postal_code", align: "left" },
          ],
          { type: "section", value: "Links", align: "left" },
          [
            { type: "field", value: "links", align: "left" },
          ],
        ],
      },
    ]),
  }
);
```

## Layout item types

### 1. Section

A section is a heading that groups the following fields until the next section or end of tab.

```ts
{ type: "section", value: "Section Title", align: "left" }
```

- `value`: section heading text.
- `align`: typically `"left"` (optional).

### 2. Field (single row)

A single field on its own row:

```ts
{ type: "field", value: "field_name", align: "left" }
```

- `value`: field name (must exist in the doctype’s fields).
- `align`: optional (e.g. `"left"`).

### 3. Row of fields (array)

An **array** of field items places multiple fields on one row:

```ts
[
  { type: "field", value: "customer", align: "left" },
  { type: "field", value: "posting_date", align: "left" },
  { type: "field", value: "due_date", align: "left" },
]
```

Each element in the array is a layout item with `type: "field"` and `value: "<field_name>"`. The form renderer lays them out in one row (e.g. in a grid).

### 4. Empty cell

To leave a gap in a row, use:

```ts
{ type: "empty" }
```

## Full layout array structure

The `layout` array is a **flat list** of:

1. **Section items** — `{ type: "section", value: "Title", align: "left" }`.
2. **Single-field items** — `{ type: "field", value: "field_name", align: "left" }`.
3. **Row arrays** — `[ { type: "field", value: "a", align: "left" }, { type: "field", value: "b", align: "left" } ]`.

Sections and rows can be mixed in any order. Fields that appear in `layout` must be keys in the doctype’s `fields` object; otherwise they are skipped.

## Example: tab with sections and rows

```ts
layout: [
  { type: "section", value: "Basic Information", align: "left" },
  [
    { type: "field", value: "customer", align: "left" },
    { type: "field", value: "customer_name", align: "left" },
    { type: "field", value: "posting_date", align: "left" },
    { type: "field", value: "due_date", align: "left" },
  ],
  { type: "section", value: "Items", align: "left" },
  [
    { type: "field", value: "delivery_note_items", align: "left" },
  ],
  { type: "section", value: "Totals", align: "left" },
  [
    { type: "field", value: "net_total", align: "left" },
    { type: "field", value: "total_amount", align: "left" },
  ],
],
```

## Multiple tabs

Add more objects to the `tabs` array; each needs `type: "Tab"`, `label`, and `layout`:

```ts
tabs: JSON.stringify([
  { type: "Tab", label: "Main", layout: [ /* ... */ ] },
  { type: "Tab", label: "Addresses", layout: [ /* ... */ ] },
  { type: "Tab", label: "Notes", layout: [ /* ... */ ] },
]),
```

## TypeScript shape (reference)

- **Tab:** `{ type: "Tab"; label: string; layout: LayoutItem[] | LayoutItem[][] }`.
- **LayoutItem:** `{ type: "section" | "field" | "empty"; value?: string | string[]; align?: string }`.
- A **row** is `LayoutItem[]` (array of field/empty items).

## Related

- [Doctype config](doctype-config.md) — where `tabs` lives.
- [Docfield](docfield.md) — field definitions referenced by `value` in layout.
