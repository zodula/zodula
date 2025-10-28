import { TextInputPlugin } from "./text-input";
import { TextareaPlugin } from "./textarea";
import { SelectPlugin } from "./select";
import { ReferencePlugin } from "./reference";
import { DatetimePlugin } from "./datetime";
import { CheckboxPlugin } from "./checkbox";
import { EditorPlugin } from "./editor";
import { FileUploadPlugin } from "./file-upload";
import { ReferenceTablePlugin } from "./reference-table";
import { ExtendPlugin } from "./extend";
import { CurrencyPlugin } from "./currency";

export const plugins = [
    TextInputPlugin,
    TextareaPlugin,
    SelectPlugin,
    ReferencePlugin,
    DatetimePlugin,
    CheckboxPlugin,
    EditorPlugin,
    FileUploadPlugin,
    ReferenceTablePlugin,
    ExtendPlugin,
    CurrencyPlugin
] as const;

export { TextInputPlugin, TextareaPlugin, SelectPlugin, ReferencePlugin, DatetimePlugin, CheckboxPlugin, EditorPlugin, FileUploadPlugin, ReferenceTablePlugin, CurrencyPlugin };