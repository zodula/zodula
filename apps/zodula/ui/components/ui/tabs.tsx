import React, { useCallback } from "react";
import { useTranslation } from "../../hooks/use-translation";

interface TabsProps {
    tabs: string[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    translate?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, translate = false }) => {
    const { t } = useTranslation();

    const translateText = useCallback((text: string) => {
        return translate ? t(text) : text;
    }, [translate, t]);

    return (
        <div className="zd:border-b zd:border-gray-200">
            <nav className="zd:-mb-px zd:flex zd:space-x-8" aria-label="Tabs">
                {tabs.map((tab: string) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`
                            zd:cursor-pointer zd:whitespace-nowrap zd:py-2 zd:px-1 zd:border-b-2 zd:font-medium zd:text-sm
                            ${activeTab === tab
                                ? "zd:border-primary/50 zd:text-primary"
                                : "zd:border-transparent zd:text-gray-500 zd:hover:text-gray-700 zd:hover:border-gray-300"
                            }
                        `}
                    >
                        {translateText(tab)}
                    </button>
                ))}
            </nav>
        </div>
    );
};
