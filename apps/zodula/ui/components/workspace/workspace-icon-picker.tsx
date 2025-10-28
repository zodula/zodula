import React, { useState } from "react"
import { IconSelectPopup } from "../ui/icon-select-popup"
import { DynamicIcon, availableIcons, type IconName } from "../ui/dynamic-icon"

interface WorkspaceIconPickerProps {
    selectedIcon: string
    onIconSelect: (iconName: string) => void
    className?: string
    showLabel?: boolean
    label?: string
    size?: "small" | "medium" | "large"
    variant?: "default" | "compact" | "minimal"
}

export const WorkspaceIconPicker = ({ 
    selectedIcon, 
    onIconSelect, 
    className = "",
    showLabel = false,
    label = "",
    size = "medium",
    variant = "default"
}: WorkspaceIconPickerProps) => {
    const [isIconPopupOpen, setIsIconPopupOpen] = useState(false)

    // Size configurations
    const sizeConfig = {
        small: {
            button: "zd:w-6 zd:h-6",
            icon: "zd:w-3 zd:h-3",
            text: "zd:text-xs"
        },
        medium: {
            button: "zd:w-10 zd:h-10",
            icon: "zd:w-5 zd:h-5",
            text: "zd:text-sm"
        },
        large: {
            button: "zd:w-12 zd:h-12",
            icon: "zd:w-6 zd:h-6",
            text: "zd:text-base"
        }
    }

    // Variant configurations
    const variantConfig = {
        default: "zd:border zd:border-gray-300 zd:rounded-lg zd:bg-white zd:hover:bg-gray-50",
        compact: "zd:bg-muted zd:rounded-md zd:hover:bg-muted/80",
        minimal: "zd:bg-transparent zd:hover:bg-gray-100 zd:rounded"
    }

    const currentSize = sizeConfig[size]
    const currentVariant = variantConfig[variant]

    return (
        <>
            <div className={`zd:flex zd:items-center zd:gap-2 ${className}`}>
                {showLabel && (
                    <span className={`${currentSize.text} zd:font-medium zd:text-gray-700`}>
                        {label}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setIsIconPopupOpen(true)}
                    className={`zd:flex zd:items-center zd:justify-center ${currentSize.button} ${currentVariant} zd:transition-colors`}
                >
                    <DynamicIcon
                        iconName={selectedIcon as IconName}
                        className={currentSize.icon}
                    />
                </button>
                {showLabel && (
                    <span className={`${currentSize.text} zd:text-gray-600`}>
                        {selectedIcon}
                    </span>
                )}
            </div>
            
            <IconSelectPopup
                selectedIcon={selectedIcon}
                onIconSelect={(iconName) => {
                    onIconSelect(iconName)
                    setIsIconPopupOpen(false)
                }}
                onClose={() => setIsIconPopupOpen(false)}
                isOpen={isIconPopupOpen}
                availableIcons={availableIcons}
            />
        </>
    )
}
