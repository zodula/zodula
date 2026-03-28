# ZUI UI Script API

This document describes the ZUI (Zodula UI) script API for customizing form and list behavior via client-side scripts. Scripts run in doctype UI files (e.g. `Delivery Note.ui.tsx`) and use `useZui` to register handlers.

## Setup

```tsx
import { useZui } from "@/zodula/ui";

export default function MyDoctypeScripts() {
  useZui((zui) => {
    zui.form.on("My Doctype", { /* events */ });
    zui.list.on("My Doctype", { /* events */ });
  }, []);

  return <></>;
}
```

---

## Form Scripts

### Form Events

| Event | When it runs |
|-------|--------------|
| `on_render` | When the form is rendered or refreshed |
| `before_submit` | Before saving the document |
| `after_submit` | After a successful save |
| `before_cancel` | Before cancelling the document |
| `after_cancel` | After cancellation |
| `before_delete` | Before deleting |
| `after_delete` | After deletion |
| `before_insert` | Before inserting a new document |
| `after_insert` | After insert |
| `before_update` | Before updating an existing document |
| `after_update` | After update |
| `field_name` | When a top-level field changes (e.g. `customer`) |
| `table_name.child_field` | When a table child field changes (e.g. `delivery_note_items.item`) |

### Form Context (`frm`)

The handler receives a context object (often called `frm`):

```ts
interface FormScriptContext {
  doctype: string;
  doc: Record<string, any> | null;
  id?: string | null;
  get_value: (field: string) => any;
  set_value: (field: string, value: any) => Promise<void>;
  set_df_property: (fieldPath: string, property: string, value: any) => Promise<void>;
  get_df_property: (fieldPath: string, property: string) => any;
  idx: number;
  set_badge_config?: (fieldKey: string, config: BadgeConfig) => void;
  reload?: () => Promise<void>;
}
```

---

## Field Paths

### Top-level fields

Use the field name directly:

```ts
frm.get_value("customer");
await frm.set_value("customer_name", "Acme Corp");
```

### Table row fields: `table.index.field`

For reference tables (child doctypes), use the pattern `tableName.rowIndex.fieldName`:

| Path | Meaning |
|------|---------|
| `delivery_note_items.0.item` | Row at index 0, field `item` |
| `delivery_note_items.1.item_name` | Row at index 1, field `item_name` |

In **table field change handlers** (e.g. `"delivery_note_items.item"`), `frm.idx` is the row index:

```ts
zui.form.on("Delivery Note", {
  "delivery_note_items.item": async function (frm) {
    const idx = frm.idx;  // 0, 1, 2, ...
    const itemId = frm.get_value(`delivery_note_items.${idx}.item`);
    const item = await zodula.doc.get_doc("Item", itemId);
    if (item) {
      await frm.set_value(`delivery_note_items.${idx}.item_name`, item.item_name ?? "");
      await frm.set_value(`delivery_note_items.${idx}.uom`, item.default_uom ?? "");
    }
  },
});
```

### Table default: `table.-1.field`

Use index `-1` to target the **default configuration** for new rows (applies to all new rows added to the table):

```ts
// Set filters on the item field for all new rows
frm.set_df_property("delivery_note_items.-1.item", "filters", 
  JSON.stringify([["item_customer.customer", "=", frm.get_value("customer")]])
);

// Clear filters
frm.set_df_property("delivery_note_items.-1.item", "filters", null);
```

| Path | Meaning |
|------|---------|
| `delivery_note_items.-1.item` | Default config for `item` in new rows |
| `delivery_note_items.0.item` | Config for `item` in row at index 0 only |

### Extend fields: `extend_field.child_field`

For extend (nested object) fields, use `parent.child`:

```ts
frm.get_value("billing_address.street");
await frm.set_value("billing_address.city", "Hanoi");
```

> **Note:** `set_df_property` and `get_df_property` are not implemented for extend fields.

---

## get_value / set_value

### get_value(field)

Reads a value by field path. Works for top-level, table, and extend paths.

```ts
// Top-level
const customer = frm.get_value("customer");

// Table row
const itemName = frm.get_value(`delivery_note_items.${frm.idx}.item_name`);

// Extend
const street = frm.get_value("billing_address.street");
```

### set_value(field, value)

Sets a value. Returns a `Promise`. Use `await` when you need the UI to update before continuing.

```ts
await frm.set_value("customer_name", "Acme Corp");
await frm.set_value(`delivery_note_items.${idx}.uom`, "Unit");
```

---

## set_df_property / get_df_property

These functions control **field metadata** (df = docfield), such as visibility, filters, and options.

### Field path rules

| Context | Path format | Example |
|---------|-------------|---------|
| Top-level field | `field_name` | `"customer"` |
| Table default (new rows) | `table.-1.field` | `"delivery_note_items.-1.item"` |
| Table row at index | `table.index.field` | `"delivery_note_items.0.item"` |

### set_df_property(fieldPath, property, value)

```ts
// Hide a top-level field
await frm.set_df_property("internal_notes", "hidden", 1);

// Make a field read-only
await frm.set_df_property("doc_status", "read_only", 1);

// Set filters on a reference field (for new rows)
await frm.set_df_property("delivery_note_items.-1.item", "filters", 
  JSON.stringify([["item_customer.customer", "=", frm.get_value("customer")]])
);

// Clear filters
await frm.set_df_property("delivery_note_items.-1.item", "filters", null);
```

### get_df_property(fieldPath, property)

```ts
const filters = frm.get_df_property("delivery_note_items.-1.item", "filters");
const isHidden = frm.get_df_property("internal_notes", "hidden");
```

### Common properties

| Property | Type | Description |
|----------|------|--------------|
| `hidden` | `0 \| 1` | Hide the field |
| `read_only` | `0 \| 1` | Make the field read-only |
| `filters` | `string \| null` | JSON string of filter array for reference fields |
| `options` | `string` | Options for select/enum fields |

---

## Table field handlers: context scope

When a **table child field** changes, scripts run in two scopes:

1. **Parent doctype** with event `table_name.child_field` (e.g. `delivery_note_items.item`)
   - `frm.doc` = full document
   - `frm.get_value("table.0.field")` = full path
   - `frm.idx` = row index

2. **Child doctype** with event `child_field` (e.g. `item`)
   - `frm.doctype` = child doctype name
   - `frm.doc` = current row only
   - `frm.get_value("field")` = field name only (no table prefix)
   - `frm.set_value("field", value)` = writes to `table.idx.field`
   - `frm.set_df_property("field", prop, val)` = applies to `table.idx.field`

Example in child scope:

```ts
zui.form.on("Delivery Note Item", {
  item: async function (frm) {
    // frm.doc = current row
    // frm.set_value("item_name", x) updates delivery_note_items.{idx}.item_name
    const itemId = frm.get_value("item");
    const item = await zodula.doc.get_doc("Item", itemId);
    if (item) {
      await frm.set_value("item_name", item.item_name ?? "");
    }
  },
});
```

---

## List scripts

### List events

| Event | When it runs |
|-------|--------------|
| `on_format` | When formatting list rows (for badges, custom renderers) |

### List context

```ts
interface ListScriptContext {
  doctype: string;
  list_data: any[];
  selected_rows: Set<string>;
  set_selected_rows: (selected: Set<string>) => void;
  set_badge_config?: (fieldKey: string, config: BadgeConfig) => void;
  set_custom_renderer?: (fieldKey: string, render: (doc: any) => any) => void;
  reload?: () => Promise<void>;
}
```

### Badge config

```ts
zui.list.on("Delivery Note", {
  on_format(ctx) {
    ctx.set_badge_config?.("doc_status", {
      getValue: (doc, t) => {
        const status = doc?.doc_status ?? "";
        const variant = status === "Submitted" ? "success" : "default";
        return { status: t(status), variant };
      },
    });
  },
});
```

---

## Secondary buttons

Add custom buttons to the form or list toolbar:

```ts
zui.form.set_secondary_button("Delivery Note", "Create Sales Invoice", async (frm) => {
  zui.router?.push(`/desk/${zui.org}/doctypes/Sales Invoice/form`, {
    state: { prefill: { delivery_note: frm.get_value("id") } },
  });
}, {
  icon: "FileText",
  condition: (ctx) => ctx?.doc?.doc_status === "Submitted",
});
```

---

## ZUI utilities

Available on the `zui` object:

| Property | Description |
|----------|-------------|
| `zui.org` | Current organization ID |
| `zui.router` | Router for navigation |
| `zui.params` | Route params |
| `zui.search` | URL search params as object |
| `zui.t(key)` | Translation function |
| `zui.toast` | Toast notifications |
| `zui.open_dialog` | Open a dialog |
| `zui.open_multiselect_dialog` | Multi-select doctype dialog |
| `zui.confirm` | Confirm dialog |
| `zui.alert` | Alert dialog |

---

## Complete example

```tsx
import { zodula } from "@/zodula/client";
import { useZui } from "@/zodula/ui";

export default function DeliveryOrderScripts() {
  useZui((zui) => {
    zui.list.on("Delivery Note", {
      on_format(ctx) {
        ctx.set_badge_config?.("doc_status", { getValue: (doc) => doc?.doc_status ?? "" });
      },
    });

    zui.form.on("Delivery Note", {
      on_render(ctx) {
        ctx.set_badge_config?.("doc_status", { getValue: (doc) => doc?.doc_status ?? "" });
      },
      customer: async (frm) => {
        const customer = await zodula.doc.get_doc("Customer", frm.get_value("customer"));
        if (customer) {
          await frm.set_value("customer_name", customer?.name ?? "");
          if (frm.get_value("filter_item_by_customer") === 1) {
            await frm.set_df_property("delivery_note_items.-1.item", "filters",
              JSON.stringify([["item_customer.customer", "=", frm.get_value("customer")]]));
          }
        } else {
          await frm.set_value("customer_name", "");
          await frm.set_df_property("delivery_note_items.-1.item", "filters", null);
        }
      },
      "delivery_note_items.item": async (frm) => {
        const idx = frm.idx;
        const itemId = frm.get_value(`delivery_note_items.${idx}.item`);
        if (itemId) {
          const item = await zodula.doc.get_doc("Item", itemId);
          if (item) {
            await frm.set_value(`delivery_note_items.${idx}.item_name`, item.item_name ?? "");
            await frm.set_value(`delivery_note_items.${idx}.uom`, item.default_uom ?? "");
          }
        }
      },
    });
  }, []);

  return <></>;
}
```
