import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface SectionProps {
    title?: string;
    columns?: number;
    children: React.ReactNode;
    hideLabel?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
}

export const Section: React.FC<SectionProps> = ({
    title,
    columns = 1,
    children,
    hideLabel = false,
    collapsible = false,
    defaultCollapsed = false
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    // More flexible grid system
    const getGridCols = (cols: number) => {
        if (cols <= 1) return "zd:grid-cols-1";
        if (cols <= 2) return "zd:grid-cols-1 zd:md:grid-cols-2";
        if (cols <= 3) return "zd:grid-cols-1 zd:md:grid-cols-2 zd:lg:grid-cols-3";
        if (cols <= 4) return "zd:grid-cols-1 zd:md:grid-cols-2 zd:lg:grid-cols-3 zd:xl:grid-cols-4";
        if (cols <= 6) return "zd:grid-cols-1 zd:md:grid-cols-2 zd:lg:grid-cols-3 zd:xl:grid-cols-6";
        return "zd:grid-cols-1 zd:md:grid-cols-2 zd:lg:grid-cols-3 zd:xl:grid-cols-6 zd:2xl:grid-cols-8";
    };

    const gridCols = getGridCols(columns);

    const handleToggle = () => {
        if (collapsible) {
            setIsCollapsed(!isCollapsed);
        }
    };

    return (
        <div className="zd:flex zd:flex-col zd:gap-4">
            {title && !hideLabel && (
                <div
                    className={`zd:flex zd:items-center zd:justify-between zd:cursor-pointer zd:transition-colors ${collapsible
                        ? 'zd:rounded zd:p-2 zd:-m-2'
                        : ''
                        }`}
                    role={collapsible ? 'button' : undefined}
                    tabIndex={collapsible ? 0 : undefined}
                    onKeyDown={collapsible ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggle();
                        }
                    } : undefined}
                    aria-label={collapsible ? (isCollapsed ? "Expand section" : "Collapse section") : undefined}
                >
                    <h3 className="zd:text-sm zd:font-medium zd:text-accent-foreground/80 zd:border-b zd:border-muted zd:pb-2 zd:flex-1">
                        {title}
                    </h3>
                    {collapsible && (
                        <div className="zd:ml-2 zd:text-muted-foreground zd:cursor-pointer zd:hover:text-accent-foreground" onClick={collapsible ? handleToggle : undefined}>
                            {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className={cn(
                `zd:grid ${gridCols} zd:gap-4`,
                !!isCollapsed ? "zd:hidden" : ""
            )}>
                {children}
            </div>
        </div>
    );
};
