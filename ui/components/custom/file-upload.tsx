import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { Button } from "@/zodula/ui/components/ui/button";
import { Badge } from "@/zodula/ui/components/ui/badge";
import { Upload, X } from "lucide-react";
import { previewFile } from "./file-preview";
import { FileThumbnail, getFileTypeCategory } from "./file-thumbnail";
import { BASE_URL } from "@/zodula/client/utils";

export interface FileUploadProps {
    value?: File | string;
    onChange?: (value: File | string) => void;
    readOnly?: boolean;
    accept?: string;
    max?: number;
    min?: number;
    className?: string;
    placeholder?: string;
    urlPrefix?: string;
    /** Dense layout for reference table cells and tight layouts */
    compact?: boolean;
}



const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileUpload: React.FC<FileUploadProps> = ({
    value,
    onChange,
    readOnly = false,
    accept,
    className = "",
    placeholder = "Choose a file or drag it here",
    urlPrefix,
    compact = false,
}) => {
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Determine if value is a File or string path
    const isFile = value && typeof value === 'object' && 'name' in value && 'size' in value && 'type' in value;
    const isStringPath = typeof value === 'string' && value.length > 0;

    const fileName = useMemo(() => {
        if (isFile) {
            return value.name;
        }
        if (isStringPath) {
            // Extract filename from path
            return value.split('/').pop() || value;
        }
        return '';
    }, [value, isFile, isStringPath]);

    const fileSize = useMemo(() => {
        if (isFile) {
            return formatFileSize(value.size);
        }
        return '';
    }, [value, isFile]);

    const fileTypeCategory = useMemo(() => {
        if (fileName) {
            return getFileTypeCategory(fileName, isFile ? value.type : undefined);
        }
        return 'other' as const;
    }, [fileName, value, isFile]);

    const previewUrl = useMemo(() => {
        if (isFile) {
            return URL.createObjectURL(value);
        }
        if (isStringPath) {
            // For string paths, check if it starts with http
            if (value.startsWith('http')) {
                return value;
            }
            // If not starting with http, use BASE_URL
            return `${urlPrefix || ""}${value}`;
        }
        return null;
    }, [value, isFile, isStringPath]);

    const handleFileSelect = useCallback((file: File) => {
        if (readOnly) return;

        // Just use the File object directly as the value
        onChange?.(file);
    }, [onChange, readOnly]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setDragActive(false);

        if (readOnly) return;

        const file = event.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect, readOnly]);

    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setDragActive(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setDragActive(false);
    }, []);

    const handleRemove = useCallback(() => {
        if (readOnly) return;

        // Clean up object URL if it exists
        if (previewUrl && isFile) {
            URL.revokeObjectURL(previewUrl);
        }

        // Reset the file input value so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        onChange?.("");
    }, [onChange, readOnly, previewUrl, isFile]);

    const handleClick = useCallback(() => {
        if (!readOnly) {
            fileInputRef.current?.click();
        }
    }, [readOnly]);



    // Clean up object URL on unmount
    React.useEffect(() => {
        return () => {
            if (previewUrl && isFile) {
                URL.revokeObjectURL(previewUrl);
            }
            // Reset file input on unmount
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
    }, [previewUrl, isFile]);

    const renderUploadArea = () => {
        if (compact) {
            return (
                <div
                    className={cn(
                        "zd:flex zd:items-center zd:gap-2 zd:min-h-8 zd:px-2 zd:py-1 zd:rounded zd:border zd:border-dashed zd:cursor-pointer zd:transition-colors zd:max-w-full",
                        dragActive ? "zd:border-primary zd:bg-primary/5" : "zd:border-border zd:hover:border-primary/50",
                        readOnly ? "zd:cursor-not-allowed zd:opacity-50" : "",
                        "no-print"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleClick}
                    title={placeholder}
                >
                    <Upload className="zd:h-4 zd:w-4 zd:shrink-0 zd:text-muted-foreground" />
                    <span className="zd:text-xs zd:text-muted-foreground zd:truncate zd:flex-1 zd:text-left">
                        {readOnly ? "—" : "Upload"}
                    </span>
                    {!readOnly && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="zd:h-7 zd:px-2 zd:text-xs zd:shrink-0"
                            disabled={readOnly}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClick();
                            }}
                        >
                            File
                        </Button>
                    )}
                </div>
            );
        }
        return (
            <div
                className={cn(
                    "zd:border-2 zd:border-dashed zd:rounded zd:p-6 zd:text-center zd:cursor-pointer zd:transition-colors",
                    dragActive ? "zd:border-primary zd:bg-primary/5" : "zd:border-border zd:hover:border-primary/50",
                    readOnly ? "zd:cursor-not-allowed zd:opacity-50" : "",
                    "no-print"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
            >
                <Upload className="zd:h-8 zd:w-8 zd:mx-auto zd:mb-2 zd:text-muted-foreground" />
                <p className="zd:text-sm zd:text-muted-foreground zd:mb-2">
                    {placeholder}
                </p>
                {!readOnly && (
                    <Button variant="outline" disabled={readOnly}>
                        Choose File
                    </Button>
                )}
            </div>
        );
    };

    return (
        <div className={cn(compact ? "zd:space-y-1" : "zd:space-y-2", className)}>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                className="zd:hidden"
                disabled={readOnly}
            />

            {(!value || value === "") ? renderUploadArea() : null}

            {value && (
                <div
                    className={cn(
                        "zd:rounded zd:print:p-0 zd:print:border-none",
                        compact ? "zd:border-0 zd:p-0" : "zd:border zd:p-2"
                    )}
                >
                    <div className={cn("zd:flex zd:items-center", compact ? "zd:gap-1.5" : "zd:space-x-3")}>
                        <FileThumbnail
                            fileName={fileName}
                            mimeType={isFile ? value.type : undefined}
                            previewUrl={previewUrl}
                            size={compact ? "sm" : "xxl"}
                            onClick={() => previewFile(value)}
                        />

                        <div className="zd:flex-1 zd:min-w-0 no-print">
                            <div className="zd:flex zd:items-center zd:gap-1 zd:truncate">
                                {isFile ? (
                                    <p
                                        className={cn(
                                            "zd:font-medium zd:truncate zd:cursor-pointer zd:hover:underline",
                                            compact ? "zd:text-xs" : "zd:text-sm"
                                        )}
                                        onClick={() => {
                                            previewFile(value);
                                        }}
                                    >
                                        {fileName}
                                    </p>
                                ) : (
                                    <a
                                        href={!value.startsWith("http") ? `${BASE_URL}${value}` : value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline truncate block"
                                    >
                                        <p className={cn("zd:font-medium zd:truncate", compact ? "zd:text-xs" : "zd:text-sm")}>{fileName}</p>
                                    </a>
                                )}
                            </div>
                            {!compact && fileSize && (
                                <p className="zd:text-muted-foreground">{fileSize}</p>
                            )}
                            {!compact && (
                                <div className="zd:flex zd:items-center zd:gap-2">
                                    {fileTypeCategory !== "other" && (
                                        <p className="zd:text-muted-foreground zd:capitalize">
                                            {fileTypeCategory} file
                                        </p>
                                    )}
                                    {isFile && (
                                        <Badge variant="warning" size="sm">
                                            upload
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="zd:flex zd:items-center zd:shrink-0">
                            {!readOnly && (
                                <Button
                                    variant="ghost"
                                    size={compact ? "sm" : "default"}
                                    onClick={handleRemove}
                                    className={cn(
                                        "zd:text-muted-foreground zd:hover:text-destructive",
                                        compact && "zd:h-7 zd:w-7 zd:p-0"
                                    )}
                                    title="Remove file"
                                >
                                    <X className={compact ? "zd:h-3.5 zd:w-3.5" : "zd:h-4 zd:w-4"} />
                                </Button>
                            )}
                        </div>
                    </div>

                    {!compact && fileTypeCategory === "video" && previewUrl && (
                        <div className="mt-3">
                            <video
                                src={previewUrl}
                                controls
                                className="zd:w-full zd:max-h-48 zd:rounded"
                            />
                        </div>
                    )}

                    {!compact && fileTypeCategory === "audio" && previewUrl && (
                        <div className="mt-3">
                            <audio
                                src={previewUrl}
                                controls
                                className="zd:w-full"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
