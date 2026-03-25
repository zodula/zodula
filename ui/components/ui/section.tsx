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
    /** Wrap content in a card-like container */
    card?: boolean;
    className?: string;
}

export const Section: React.FC<SectionProps> = ({
    title,
    columns = 1,
    children,
    hideLabel = false,
    collapsible = false,
    defaultCollapsed = false,
    card = false,
    className,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

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
        if (collapsible) setIsCollapsed(!isCollapsed);
    };

    return (
        <div
            className={cn(
                "zd:flex zd:flex-col zd:gap-3",
                card && "zd:rounded-xl zd:border zd:border-border zd:bg-card zd:p-4 zd:shadow-sm",
                className
            )}
        >
            {title && !hideLabel && (
                <div
                    className={cn(
                        "zd:flex zd:items-center zd:justify-between zd:transition-colors",
                        !card && "zd:border-b zd:border-border zd:pb-2",
                        collapsible && "zd:cursor-pointer zd:select-none"
                    )}
                    role={collapsible ? "button" : undefined}
                    tabIndex={collapsible ? 0 : undefined}
                    onKeyDown={
                        collapsible
                            ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleToggle();
                                  }
                              }
                            : undefined
                    }
                    onClick={collapsible ? handleToggle : undefined}
                    aria-expanded={collapsible ? !isCollapsed : undefined}
                >
                    <h3 className="zd:text-sm zd:font-semibold zd:text-foreground zd:tracking-tight">
                        {title}
                    </h3>
                    {collapsible && (
                        <span className="zd:text-muted-foreground zd:transition-transform zd:duration-200">
                            {isCollapsed ? (
                                <ChevronRight className="zd:w-4 zd:h-4" />
                            ) : (
                                <ChevronDown className="zd:w-4 zd:h-4" />
                            )}
                        </span>
                    )}
                </div>
            )}
            <div
                className={cn(
                    `zd:grid ${gridCols} zd:gap-3`,
                    isCollapsed ? "zd:hidden" : ""
                )}
            >
                {children}
            </div>
        </div>
    );
};
