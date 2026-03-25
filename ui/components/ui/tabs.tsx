import React, { useCallback } from "react";
import { useTranslation } from "../../hooks/use-translation";
import { cn } from "../../lib/utils";

interface TabsProps {
    tabs: string[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    translate?: boolean;
    /** Tab labels that contain required fields get a red asterisk */
    tabHasRequired?: Record<string, boolean>;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    translate = false,
    tabHasRequired,
    className,
}) => {
    const { t } = useTranslation();

    const translateText = useCallback(
        (text: string) => (translate ? t(text) : text),
        [translate, t]
    );

    return (
        <div className={cn("zd:border-b zd:border-border", className)}>
            <nav className="zd:-mb-px zd:flex zd:items-end" aria-label="Tabs">
                {tabs.map((tab: string) => {
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => onTabChange(tab)}
                            className={cn(
                                "zd:relative zd:cursor-pointer zd:whitespace-nowrap zd:px-4 zd:py-2.5",
                                "zd:text-sm zd:font-medium zd:transition-colors zd:duration-150 zd:select-none",
                                "zd:focus-visible:outline-none",
                                isActive
                                    ? "zd:text-foreground"
                                    : "zd:text-muted-foreground zd:hover:text-foreground"
                            )}
                        >
                            {translateText(tab)}
                            {tab !== tabs[0] && tabHasRequired?.[tab] && (
                                <span className="zd:text-destructive zd:ml-0.5" aria-hidden>
                                    {" "}*
                                </span>
                            )}
                            {/* Active bottom bar */}
                            <span
                                className={cn(
                                    "zd:absolute zd:bottom-0 zd:left-0 zd:right-0 zd:h-0.5 zd:rounded-t-full zd:transition-all zd:duration-200",
                                    isActive ? "zd:bg-primary" : "zd:bg-transparent"
                                )}
                            />
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};
