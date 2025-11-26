import React, { useCallback, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
    X,
    Download,
    ZoomIn,
    ZoomOut,
    RotateCw,
    ChevronLeft,
    ChevronRight,
    FileText,
    Image,
    FileSpreadsheet,
    FileCode,
    FileIcon
} from "lucide-react";
import { popup } from "../ui/popit";
import { BASE_URL } from "@/zodula/client/utils";

export interface FilePreviewProps {
    file?: File | string;
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

// File type detection
const getFileType = (fileName: string, mimeType?: string): 'image' | 'pdf' | 'csv' | 'xlsx' | 'text' | 'other' => {
    const extension = fileName.split('.').pop()?.toLowerCase();

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(extension || '') ||
        mimeType?.startsWith('image/')) {
        return 'image';
    }

    // PDF
    if (extension === 'pdf' || mimeType === 'application/pdf') {
        return 'pdf';
    }

    // CSV
    if (extension === 'csv' || mimeType === 'text/csv') {
        return 'csv';
    }

    // Excel files
    if (['xlsx', 'xls'].includes(extension || '') ||
        mimeType?.includes('spreadsheet') ||
        mimeType?.includes('excel')) {
        return 'xlsx';
    }

    // Text files
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(extension || '') ||
        mimeType?.startsWith('text/')) {
        return 'text';
    }

    return 'other';
};

const getFileIcon = (type: 'image' | 'pdf' | 'csv' | 'xlsx' | 'text' | 'other') => {
    switch (type) {
        case 'image':
            return <Image className="zd:h-16 zd:w-16 zd:text-blue-500" />;
        case 'pdf':
            return <FileText className="zd:h-16 zd:w-16 zd:text-red-500" />;
        case 'csv':
        case 'xlsx':
            return <FileSpreadsheet className="zd:h-16 zd:w-16 zd:text-green-500" />;
        case 'text':
            return <FileCode className="zd:h-16 zd:w-16 zd:text-yellow-500" />;
        default:
            return <FileIcon className="zd:h-16 zd:w-16 zd:text-gray-500" />;
    }
};

// CSV to HTML table converter
const csvToTable = (csvText: string): string => {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            return '<p class="zd:text-gray-500">Empty CSV file</p>';
        }

        // Simple CSV parser that handles quoted fields
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }

            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0] || '');
        const rows = lines.slice(1).map(line => parseCSVLine(line));

        let tableHtml = '<table class="min-w-full border-collapse border border-gray-300">';

        // Headers
        tableHtml += '<thead><tr>';
        headers.forEach(header => {
            tableHtml += `<th class="zd:border zd:border-gray-300 zd:px-4 zd:py-2 zd:bg-gray-100 zd:font-semibold">${header || 'Column'}</th>`;
        });
        tableHtml += '</tr></thead>';

        // Rows
        tableHtml += '<tbody>';
        rows.forEach(row => {
            tableHtml += '<tr>';
            headers.forEach((_, index) => {
                const cell = row[index] || '';
                tableHtml += `<td class="zd:border zd:border-gray-300 zd:px-4 zd:py-2">${cell}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';

        return tableHtml;
    } catch (error) {
        console.error('Error parsing CSV:', error);
        return '<p class="zd:text-red-500">Error parsing CSV file</p>';
    }
};

// Internal component for the file preview content
const FilePreviewContent: React.FC<{
    file?: File | string;
    onClose: () => void;
    className?: string;
}> = ({ file, onClose, className }) => {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [textContent, setTextContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // Determine if file is a File object or string path
    const isFile = file && typeof file === 'object' && 'name' in file && 'size' in file && 'type' in file;
    const isStringPath = typeof file === 'string' && file.length > 0;

    const fileName = useMemo(() => {
        if (isFile) {
            return file.name;
        }
        if (isStringPath) {
            return file.split('/').pop() || file;
        }
        return '';
    }, [file, isFile, isStringPath]);

    const fileType = useMemo(() => {
        if (fileName) {
            return getFileType(fileName, isFile ? file.type : undefined);
        }
        return 'other' as const;
    }, [fileName, file, isFile]);

    const fileUrl = useMemo(() => {
        if (isFile) {
            return URL.createObjectURL(file);
        }
        if (isStringPath) {
            if (file.startsWith('http')) {
                return file;
            }
            return `${BASE_URL}${file}`;
        }
        return null;
    }, [file, isFile, isStringPath]);

    // Load text content for text files and CSV files
    const loadTextContent = useCallback(async () => {
        if (!fileUrl || (fileType !== 'text' && fileType !== 'csv')) return;

        setIsLoading(true);
        try {
            const response = await fetch(fileUrl);
            const text = await response.text();
            setTextContent(text);
        } catch (error) {
            console.error('Error loading text content:', error);
            setTextContent('Error loading file content');
        } finally {
            setIsLoading(false);
        }
    }, [fileUrl, fileType]);

    // Load text content when file changes
    React.useEffect(() => {
        if ((fileType === 'text' || fileType === 'csv') && fileUrl) {
            loadTextContent();
        } else {
            setTextContent('');
        }
    }, [fileType, fileUrl, loadTextContent]);

    // Reset zoom and rotation when file changes
    React.useEffect(() => {
        setZoom(1);
        setRotation(0);
    }, [file]);

    // Clean up object URL on unmount
    React.useEffect(() => {
        return () => {
            if (fileUrl && isFile) {
                URL.revokeObjectURL(fileUrl);
            }
        };
    }, [fileUrl, isFile]);

    const handleDownload = useCallback(() => {
        if (!fileUrl) return;

        const link = document.createElement('a');
        link.target = '_blank';
        link.href = fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [fileUrl, fileName]);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 0.25, 3));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 0.25, 0.25));
    }, []);

    const handleRotate = useCallback(() => {
        setRotation(prev => (prev + 90) % 360);
    }, []);

    const handleReset = useCallback(() => {
        setZoom(1);
        setRotation(0);
    }, []);

    const renderPreview = () => {
        if (!fileUrl) {
            return (
                <div className="zd:flex zd:flex-col zd:items-center zd:justify-start zd:h-64 zd:text-muted-foreground zd:pt-8">
                    {getFileIcon(fileType)}
                    <p className="mt-4 text-lg">No file selected</p>
                </div>
            );
        }

        switch (fileType) {
            case 'image':
                return (
                    <div className="zd:flex zd:items-center zd:justify-center zd:min-h-[400px] zd:w-full">
                        <img
                            src={fileUrl}
                            alt={fileName}
                            className="zd:max-w-full zd:max-h-full zd:object-contain"
                            style={{
                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease-in-out'
                            }}
                        />
                    </div>
                );

            case 'pdf':
                return (
                    <div className="zd:w-full zd:h-[600px]">
                        <iframe
                            src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                            className="zd:w-full zd:h-full zd:border-0"
                            title={fileName}
                        />
                    </div>
                );

            case 'csv':
                return (
                    <div className="zd:w-full zd:overflow-auto">
                        {isLoading ? (
                            <div className="zd:flex zd:items-center zd:justify-start zd:h-64 zd:pt-8">
                                <div className="zd:animate-spin zd:rounded-full zd:h-8 zd:w-8 zd:border-b-2 zd:border-primary"></div>
                                <span className="zd:ml-2">Loading CSV...</span>
                            </div>
                        ) : textContent ? (
                            <div
                                className="zd:p-4"
                                dangerouslySetInnerHTML={{
                                    __html: csvToTable(textContent)
                                }}
                            />
                        ) : (
                            <div className="zd:flex zd:flex-col zd:items-center zd:justify-start zd:h-64 zd:text-muted-foreground zd:pt-8">
                                <FileSpreadsheet className="zd:h-16 zd:w-16 zd:text-green-500" />
                                <p className="zd:mt-4 zd:text-lg">No CSV content available</p>
                                <Button onClick={handleDownload} className="mt-4">
                                    <Download className="zd:h-4 zd:w-4 zd:mr-2" />
                                    Download File
                                </Button>
                            </div>
                        )}
                    </div>
                );

            case 'xlsx':
                return (
                    <div className="zd:flex zd:flex-col zd:items-center zd:justify-start zd:h-64 zd:text-muted-foreground zd:pt-8">
                        <FileSpreadsheet className="zd:h-16 zd:w-16 zd:text-green-500" />
                        <p className="zd:mt-4 zd:text-lg">Excel files cannot be previewed directly</p>
                        <Button onClick={handleDownload} className="mt-4">
                            <Download className="zd:h-4 zd:w-4 zd:mr-2" />
                            Download File
                        </Button>
                    </div>
                );

            case 'text':
                return (
                    <div className="zd:w-full zd:h-[600px] zd:overflow-auto">
                        {isLoading ? (
                            <div className="zd:flex zd:items-center zd:justify-start zd:h-full zd:pt-8">
                                <div className="zd:animate-spin zd:rounded-full zd:h-8 zd:w-8 zd:border-b-2 zd:border-primary"></div>
                            </div>
                        ) : (
                            <pre className="zd:p-4 zd:text-sm zd:font-mono zd:bg-gray-50 zd:rounded zd:h-full zd:overflow-auto">
                                {textContent}
                            </pre>
                        )}
                    </div>
                );

            default:
                return (
                    <div className="zd:flex zd:flex-col zd:items-center zd:justify-start zd:h-64 zd:text-muted-foreground zd:pt-8">
                        {getFileIcon(fileType)}
                        <p className="zd:mt-4 zd:text-lg">Preview not available for this file type</p>
                        <Button onClick={handleDownload} className="zd:mt-4">
                            <Download className="zd:h-4 zd:w-4 zd:mr-2" />
                            Download File
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className={cn("zd:max-w-8xl zd:w-[90vw] zd:h-[90vh] zd:flex zd:flex-col", className || '')}>
            {/* Header */}
            <div className="zd:flex zd:items-center zd:justify-between zd:p-4 zd:border-b">
                <div className="zd:flex zd:items-center zd:space-x-3 zd:flex-1">
                    <h2 className="zd:text-lg zd:font-semibold zd:truncate">{fileName}</h2>
                    <span className="zd:text-sm zd:text-muted-foreground zd:capitalize">
                        {fileType} file
                    </span>
                </div>

                <Button
                    variant="ghost"
                    onClick={onClose}
                >
                    <X className="zd:h-4 zd:w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="zd:flex-1 zd:overflow-auto zd:relative zd:flex zd:items-start zd:justify-center">
                {renderPreview()}

                {/* Floating Toolbar */}
                <div className="zd:fixed zd:bottom-12 zd:left-1/2 zd:transform zd:-translate-x-1/2 zd:bg-white/90 zd:backdrop-blur-sm zd:border zd:rounded zd:shadow-lg zd:p-2 zd:flex zd:items-center zd:space-x-2">
                    {/* Image controls */}
                    {fileType === 'image' && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleZoomOut}
                                disabled={zoom <= 0.25}
                            >
                                <ZoomOut className="zd:h-4 zd:w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleZoomIn}
                                disabled={zoom >= 3}
                            >
                                <ZoomIn className="zd:h-4 zd:w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleRotate}
                            >
                                <RotateCw className="zd:h-4 zd:w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleReset}
                            >
                                Reset
                            </Button>
                        </>
                    )}

                    <Button
                        variant="outline"
                        onClick={handleDownload}
                    >
                        <Download className="zd:h-4 zd:w-4 zd:mr-2" />
                        Download
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Main component that uses popup
export const FilePreview: React.FC<FilePreviewProps> = ({
    file,
    isOpen,
    onClose,
    className
}) => {
    // This component is now just a wrapper that uses popup
    // The actual preview logic is in FilePreviewContent
    React.useEffect(() => {
        if (isOpen) {
            popup(
                ({ onClose: dialogClose }) => (
                    <FilePreviewContent
                        file={file}
                        onClose={dialogClose}
                        className={className}
                    />
                )
            ).then(() => {
                onClose();
            });
        }
    }, [isOpen, file, onClose, className]);

    return null;
};

// Function-based API for easier usage
export function previewFile(
    file: File | string,
    options?: {
        title?: string;
        className?: string;
    }
): Promise<void> {
    return popup(
        ({ onClose }) => (
            <FilePreviewContent
                file={file}
                onClose={onClose}
                className={options?.className}
            />
        ),
    ).then(() => {
        // Convert Promise<void | null> to Promise<void>
    });
}
