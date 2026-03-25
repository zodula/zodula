import { useRouter } from "./components/router";
import { useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, type DependencyList } from "react";
import { create } from "zustand";
import { toast, type ToastAPI } from "./components/ui/toast";
import { popup, alert, confirm } from "./components/ui/popit";
import { MultiSelectDoctypeDialog } from "./components/dialogs/multi-select-doctype-dialog";
import type { MultiSelectDoctypeDialogInitialData } from "./components/dialogs/multi-select-doctype-dialog";
import type { MultiSelectDoctypeDialogResult } from "./components/dialogs/multi-select-doctype-dialog";
import { useTranslation } from "./hooks/use-translation";
import { useOrganization } from "./hooks/use-organization";
import type { IconName } from "./components/ui/dynamic-icon";
import type { BadgeVariant } from "./components/ui/badge";
import { zodula } from "@/zodula/client";
import { useLocation } from "react-router";

// ---------------------------------------------------------------------------
// Script events
// ---------------------------------------------------------------------------

export type FormScriptEvent<DN extends Zodula.DoctypeName> =
  | "on_render"
  | "before_submit"
  | "after_submit"
  | "before_cancel"
  | "after_cancel"
  | "before_delete"
  | "after_delete"
  | "before_insert"
  | "after_insert"
  | "before_update"
  | "after_update"
  | Extract<keyof Zodula.SelectDoctype<DN>, string>
  | `${Extract<keyof Zodula.SelectDoctype<DN>, string>}.${string}`

export type ListScriptEvent =
  | "on_format"

/** Top-level field names or nested paths: "table.0.child_field" (reference table) or "extend.child_field" (extend). */
export type FormFieldPath<DN extends Zodula.DoctypeName> =
  | keyof Zodula.SelectDoctype<DN>
  | `${string}.${number}.${string}` // e.g. delivery_note_items.0.product_name
  | `${string}.${string}`;          // e.g. extend_field.child_field

/** Value type for a given field path: typed for top-level keys, any for nested paths. */
export type FormFieldValue<DN extends Zodula.DoctypeName, K extends FormFieldPath<DN>> =
  K extends `${string}.${number}.${string}` ? any :
  K extends `${string}.${string}` ? any :
  K extends keyof Zodula.SelectDoctype<DN> ? Zodula.SelectDoctype<DN>[K] :
  never;

// ---------------------------------------------------------------------------
// Script contexts
// ---------------------------------------------------------------------------

export interface FormScriptContext<DN extends Zodula.DoctypeName> {
  doctype: DN;
  doc: Zodula.SelectDoctype<DN> | null;
  id?: string | null;
  /** Get by top-level field or dotted path (e.g. "delivery_note_items.0.product_name"). */
  get_value: <K extends FormFieldPath<DN>>(field: K) => FormFieldValue<DN, K>;
  /** Set by top-level field or dotted path. Value type is inferred for top-level keys. */
  set_value: {
    /** Nested table row field with child doctype + field name (e.g. delivery_note_items.0.product_name). */
    <ChildDN extends Zodula.DoctypeName, ChildField extends keyof Zodula.SelectDoctype<ChildDN> & string>(
      field: `${string}.${number}.${ChildField}`,
      value: Zodula.SelectDoctype<ChildDN>[ChildField]
    ): Promise<void>;
    /** Top-level or any dotted path. */
    <K extends FormFieldPath<DN>>(field: K, value: FormFieldValue<DN, K>): Promise<void>;
  };
  set_df_property: (fieldPath: string, property: string, value: any) => Promise<void>;
  get_df_property: (fieldPath: string, property: string) => Promise<any>;
  idx: number;
  /** Only set when running on_render/refresh. Register a badge for the form header (e.g. doc_status). */
  set_badge_config?: (fieldKey: string, config: ListFormatBadgeConfig) => void;
  /** Reload the current form/doc. Available when context is from form view. */
  reload?: () => Promise<void>;
  /** Clear a reference table (remove all rows). */
  clear_table?: (tableFieldName: string) => void;
}

export interface ListFormatBadgeConfig {
  variant?: BadgeVariant;
  size?: string;
  /** t is passed by the list/form so translation uses the current context. */
  getValue?: (doc: any, t?: (key: string) => string) => string | { status: string; variant?: string } | null;
}

export interface ListScriptContext<DN extends Zodula.DoctypeName> {
  doctype: DN;
  list_data: any[];
  selected_rows: Set<string>;
  set_selected_rows: (selected: Set<string>) => void;
  /** Only set when event is on_format. Register a badge for a list column. */
  set_badge_config?: (fieldKey: string, config: ListFormatBadgeConfig) => void;
  /** Only set when event is on_format. Register a custom cell renderer. */
  set_custom_renderer?: (fieldKey: string, render: (doc: any) => any) => void;
  /** Reload the list data. Available when context is from list view. */
  reload?: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Script handlers and script entries
// ---------------------------------------------------------------------------

export type FormScriptHandler<DN extends Zodula.DoctypeName> = (
  context: FormScriptContext<DN>
) => void | Promise<void>;

export type ListScriptHandler<DN extends Zodula.DoctypeName> = (
  context: ListScriptContext<DN>
) => void | Promise<void>;

interface RegisteredFormScript<DN extends Zodula.DoctypeName> {
  doctype: DN;
  event: FormScriptEvent<DN>;
  script: FormScriptHandler<DN>;
}

interface RegisteredListScript<DN extends Zodula.DoctypeName> {
  doctype: DN;
  event: ListScriptEvent;
  script: ListScriptHandler<DN>;
}

// ---------------------------------------------------------------------------
// Secondary buttons (form / list)
// ---------------------------------------------------------------------------

type ScriptContext<DN extends Zodula.DoctypeName, Kind extends "form" | "list"> = Kind extends "form"
  ? FormScriptContext<DN>
  : ListScriptContext<DN>;

export interface SecondaryButtonOptions<DN extends Zodula.DoctypeName, Kind extends "form" | "list"> {
  icon?: IconName;
  condition?: (context: ScriptContext<DN, Kind>) => boolean;
}

export type SecondaryButtonHandler<DN extends Zodula.DoctypeName, Kind extends "form" | "list"> = (
  doctype: DN,
  label: string,
  onClick: (context: ScriptContext<DN, Kind>) => void | Promise<void>,
  options?: SecondaryButtonOptions<DN, Kind>
) => void;

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

interface ZuiState {
  ui_form_scripts: RegisteredFormScript<Zodula.DoctypeName>[];
  ui_list_scripts: RegisteredListScript<Zodula.DoctypeName>[];
  ui_form_secondary_buttons: Array<{
    doctype: Zodula.DoctypeName;
    label: string;
    onClick: (context: FormScriptContext<Zodula.DoctypeName>) => void | Promise<void>;
    options?: SecondaryButtonOptions<Zodula.DoctypeName, "form">;
  }>;
  ui_form_field_buttons: Array<{
    doctype: Zodula.DoctypeName;
    fieldName: string;
    label: string;
    onClick: (context: FormScriptContext<Zodula.DoctypeName>) => void | Promise<void>;
    options?: SecondaryButtonOptions<Zodula.DoctypeName, "form">;
  }>;
  ui_list_secondary_buttons: Array<{
    doctype: Zodula.DoctypeName;
    label: string;
    onClick: (context: ListScriptContext<Zodula.DoctypeName>) => void | Promise<void>;
    options?: SecondaryButtonOptions<Zodula.DoctypeName, "list">;
  }>;
}

// ---------------------------------------------------------------------------
// Public ZUI interface
// ---------------------------------------------------------------------------

export interface ZUI {
  org: string | null;
  router: ReturnType<typeof useRouter> | null;
  params: ReturnType<typeof useParams>;
  search: Record<string, string>;
  t: (key: string) => string;
  toast: ToastAPI;
  open_dialog: typeof popup;
  open_multiselect_dialog: (
    initialData: MultiSelectDoctypeDialogInitialData,
    options?: { title?: string; description?: string; showCloseButton?: boolean; width?: number | string; maxWidth?: number | string }
  ) => Promise<string[] | MultiSelectDoctypeDialogResult | null>;
  open_singleselect_dialog: (
    initialData: MultiSelectDoctypeDialogInitialData,
    options?: { title?: string; description?: string; showCloseButton?: boolean; width?: number | string; maxWidth?: number | string }
  ) => Promise<string | { id: string | null; extend_values: Record<string, any> } | null>;
  confirm: typeof confirm;
  alert: typeof alert;
  form: {
    on: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      events: Partial<Record<FormScriptEvent<DN>, FormScriptHandler<DN>>>
    ) => void;
    set_secondary_button: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      label: string,
      onClick: (context: FormScriptContext<DN>) => void | Promise<void>,
      options?: SecondaryButtonOptions<DN, "form">
    ) => void;
    set_field_button: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      fieldName: string,
      label: string,
      onClick: (context: FormScriptContext<DN>) => void | Promise<void>,
      options?: SecondaryButtonOptions<DN, "form">
    ) => void;
  };
  list: {
    on: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      events: Partial<Record<ListScriptEvent, ListScriptHandler<DN>>>
    ) => void;
    set_secondary_button: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      label: string,
      onClick: (context: ListScriptContext<DN>) => void | Promise<void>,
      options?: SecondaryButtonOptions<DN, "list">
    ) => void;
  };
  _: {
    state: ZuiState;
    executeFormScripts: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      event: FormScriptEvent<DN>,
      context: FormScriptContext<DN>
    ) => Promise<void>;
    executeListScripts: <DN extends Zodula.DoctypeName>(
      doctype: DN,
      event: ListScriptEvent,
      context: ListScriptContext<DN>
    ) => Promise<void>;
  };
}

export const useZuiStore = create<ZuiState>()((set) => ({
  ui_form_scripts: [],
  ui_list_scripts: [],
  ui_form_secondary_buttons: [],
  ui_form_field_buttons: [],
  ui_list_secondary_buttons: [],
}));

export function useZui(): ZUI;
export function useZui(callback: (zui: ZUI) => void | Promise<void>, deps: DependencyList): void;
export function useZui(
  callback?: (zui: ZUI) => void | Promise<void>,
  deps?: DependencyList
): ZUI | void {
  const zuiStore = useZuiStore((state) => state);
  const { organization } = useOrganization();
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation()
  const location = useLocation();
  const search = useMemo(() => {
    return Object.fromEntries(new URLSearchParams(location.search));
  }, [location]);

  const formOn = useCallback(<DN extends Zodula.DoctypeName>(
    doctype: DN,
    events: Partial<Record<FormScriptEvent<DN>, FormScriptHandler<DN>>>
  ) => {
    for (const [event, script] of Object.entries(events)) {
      if (!script) continue;
      zuiStore.ui_form_scripts.push({
        doctype,
        event: event as FormScriptEvent<DN>,
        script,
      } as RegisteredFormScript<Zodula.DoctypeName>);
    }
  }, []);

  const listOn = useCallback(<DN extends Zodula.DoctypeName>(
    doctype: DN,
    events: Partial<Record<ListScriptEvent, ListScriptHandler<DN>>>
  ) => {
    for (const [event, script] of Object.entries(events)) {
      if (!script) continue;
      zuiStore.ui_list_scripts.push({
        doctype,
        event: event as ListScriptEvent,
        script,
      } as RegisteredListScript<Zodula.DoctypeName>);
    }
  }, []);

  const executeFormScripts = useMemo(
    () =>
      async <DN extends Zodula.DoctypeName>(
        doctype: DN,
        event: FormScriptEvent<DN>,
        context: FormScriptContext<DN>
      ): Promise<void> => {
        const scripts = zuiStore.ui_form_scripts.filter(
          (s) => s.doctype === doctype && s.event === event
        );
        for (const s of scripts) {
          await s.script(context);
        }
      },
    [zuiStore.ui_form_scripts]
  );

  const executeListScripts = useMemo(
    () =>
      async <DN extends Zodula.DoctypeName>(
        doctype: DN,
        event: ListScriptEvent,
        context: ListScriptContext<DN>
      ): Promise<void> => {
        const scripts = zuiStore.ui_list_scripts.filter(
          (s) => s.doctype === doctype && s.event === event
        );
        for (const s of scripts) {
          await s.script(context);
        }
      },
    [zuiStore.ui_list_scripts]
  );

  const ui = useMemo(
    () => ({
      form: {
        on: formOn,
        set_secondary_button: <DN extends Zodula.DoctypeName>(
          doctype: DN,
          label: string,
          onClick: (context: FormScriptContext<DN>) => void | Promise<void>,
          options?: SecondaryButtonOptions<DN, "form">
        ) => {
          const exists = zuiStore.ui_form_secondary_buttons.some(
            (b) => b.doctype === doctype && b.label === label
          );
          if (!exists) {
            zuiStore.ui_form_secondary_buttons.push({
              doctype,
              label,
              onClick: onClick as any,
              options: options as SecondaryButtonOptions<Zodula.DoctypeName, "form">,
            });
          }
        },
        set_field_button: <DN extends Zodula.DoctypeName>(
          doctype: DN,
          fieldName: string,
          label: string,
          onClick: (context: FormScriptContext<DN>) => void | Promise<void>,
          options?: SecondaryButtonOptions<DN, "form">
        ) => {
          const exists = zuiStore.ui_form_field_buttons.some(
            (b) => b.doctype === doctype && b.fieldName === fieldName && b.label === label
          );
          if (!exists) {
            zuiStore.ui_form_field_buttons.push({
              doctype,
              fieldName,
              label,
              onClick: onClick as any,
              options: options as SecondaryButtonOptions<Zodula.DoctypeName, "form">,
            });
          }
        },
      },
      list: {
        on: listOn,
        set_secondary_button: <DN extends Zodula.DoctypeName>(
          doctype: DN,
          label: string,
          onClick: (context: ListScriptContext<DN>) => void | Promise<void>,
          options?: SecondaryButtonOptions<DN, "list">
        ) => {
          const exists = zuiStore.ui_list_secondary_buttons.some(
            (b) => b.doctype === doctype && b.label === label
          );
          if (!exists) {
            zuiStore.ui_list_secondary_buttons.push({
              doctype,
              label,
              onClick: onClick as any,
              options: options as SecondaryButtonOptions<Zodula.DoctypeName, "list">,
            });
          }
        },
      },
    }),
    []
  );

  const zui = {
    org: organization?.id ?? null,
    router,
    params,
    search,
    t,
    toast,
    open_dialog: popup,
    open_multiselect_dialog: (
      initialData: MultiSelectDoctypeDialogInitialData,
      options?: { title?: string; description?: string; showCloseButton?: boolean; width?: number | string; maxWidth?: number | string }
    ) => popup(MultiSelectDoctypeDialog, options, initialData) as Promise<string[] | MultiSelectDoctypeDialogResult | null>,
    open_singleselect_dialog: (
      initialData: MultiSelectDoctypeDialogInitialData,
      options?: { title?: string; description?: string; showCloseButton?: boolean; width?: number | string; maxWidth?: number | string }
    ) => popup(MultiSelectDoctypeDialog, options, { ...initialData, single: true }) as Promise<string | { id: string | null; extend_values: Record<string, any> } | null>,
    confirm,
    alert,
    form: ui.form,
    list: ui.list,
    _: {
      state: zuiStore,
      executeFormScripts,
      executeListScripts,
    },
  } satisfies ZUI;

  const isCallbackMode = typeof callback === "function" && Array.isArray(deps);
  useEffect(() => {
    if (!isCallbackMode) return;
    void (async () => {
      await (callback as (zui: ZUI) => void | Promise<void>)(zui);
    })();
  }, isCallbackMode ? [...deps] : []);
  return isCallbackMode ? undefined : zui;
}