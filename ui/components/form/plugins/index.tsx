import { TextInputPlugin } from "./text-input";
import { TextareaPlugin } from "./textarea";
import { SelectPlugin } from "./select";
import { ReferencePlugin } from "./reference";
import { DateTimePlugin } from "./datetime";
import { CheckboxPlugin } from "./checkbox";
import { EditorPlugin } from "./editor";
import { FileUploadPlugin } from "./file-upload";
import { ImagePreviewPlugin } from "./image-preview";
import { ReferenceTablePlugin } from "./reference-table";
import { ExtendPlugin } from "./extend";
import { CurrencyPlugin } from "./currency";
import { SignaturePlugin } from "./signature";

export const plugins = [
    TextInputPlugin,
    TextareaPlugin,
    SelectPlugin,
    ReferencePlugin,
    DateTimePlugin,
    CheckboxPlugin,
    EditorPlugin,
    FileUploadPlugin,
    ImagePreviewPlugin,
    ReferenceTablePlugin,
    ExtendPlugin,
    CurrencyPlugin,
    SignaturePlugin
] as const;

export { TextInputPlugin, TextareaPlugin, SelectPlugin, ReferencePlugin, DateTimePlugin, CheckboxPlugin, EditorPlugin, FileUploadPlugin, ImagePreviewPlugin, ReferenceTablePlugin, CurrencyPlugin, SignaturePlugin };