import React from "react";
import { Image, Video, FileText, Music, Archive, FileIcon } from "lucide-react";

// File type categories for preview
export const getFileTypeCategory = (fileName: string, mimeType?: string): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' => {
    const extension = fileName.split('.').pop()?.toLowerCase();

    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(extension || '') ||
        mimeType?.startsWith('image/')) {
        return 'image';
    }

    // Video files
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension || '') ||
        mimeType?.startsWith('video/')) {
        return 'video';
    }

    // Audio files
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension || '') ||
        mimeType?.startsWith('audio/')) {
        return 'audio';
    }

    // Document files
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(extension || '') ||
        mimeType?.startsWith('application/pdf') ||
        mimeType?.startsWith('application/msword') ||
        mimeType?.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        return 'document';
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension || '') ||
        mimeType?.startsWith('application/zip') ||
        mimeType?.startsWith('application/x-rar-compressed')) {
        return 'archive';
    }

    return 'other';
};

export const getFileIcon = (category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other') => {
    switch (category) {
        case 'image':
            return <Image className="h-8 w-8 text-blue-500" />;
        case 'video':
            return <Video className="h-8 w-8 text-red-500" />;
        case 'audio':
            return <Music className="h-8 w-8 text-green-500" />;
        case 'document':
            return <FileText className="h-8 w-8 text-yellow-500" />;
        case 'archive':
            return <Archive className="h-8 w-8 text-purple-500" />;
        default:
            return <FileIcon className="h-8 w-8 text-gray-500" />;
    }
};

export interface FileThumbnailProps {
    fileName: string;
    mimeType?: string;
    previewUrl?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
    className?: string;
    onClick?: () => void;
}

export const FileThumbnail: React.FC<FileThumbnailProps> = ({
    fileName,
    mimeType,
    previewUrl,
    size = 'md',
    className = "",
    onClick
}) => {
    const fileTypeCategory = getFileTypeCategory(fileName, mimeType);

    const sizeClasses = {
        sm: "zd:h-8 zd:w-8",
        md: "zd:h-12 zd:w-12",
        lg: "zd:h-16 zd:w-16",
        xl: "zd:h-20 zd:w-20",
        xxl: "zd:h-24 zd:w-24",
        xxxl: "zd:h-28 zd:w-28"
    };

    const iconSizeClasses = {
        sm: "zd:h-6 zd:w-6",
        md: "zd:h-8 zd:w-8",
        lg: "zd:h-12 zd:w-12",
        xl: "zd:h-16 zd:w-16",
        xxl: "zd:h-20 zd:w-20",
        xxxl: "zd:h-24 zd:w-24"
    };

    const handleClick = () => {
        if (onClick) {
            onClick();
        }
    };

    return (
        <div
            className={`zd:flex-shrink-0 zd:cursor-pointer zd:hover:opacity-50 zd:rounded-md zd:p-1 zd:bg-muted/50 zd:w-fit ${className}`}
            onClick={handleClick}
        >
            {fileTypeCategory === 'image' && previewUrl ? (
                <img
                    src={previewUrl}
                    alt={fileName}
                    className={`${sizeClasses[size]} zd:object-cover zd:rounded`}
                />
            ) : (
                <div className={`zd:flex zd:items-center zd:justify-center ${sizeClasses[size]} zd:rounded-md`}>
                    {React.cloneElement(getFileIcon(fileTypeCategory), {
                        className: iconSizeClasses[size] + " " + getFileIcon(fileTypeCategory).props.className.split(' ').slice(1).join(' ')
                    })}
                </div>
            )}
        </div>
    );
};
