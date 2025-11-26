import React, { useEffect } from 'react';

interface TabLayout {
    label: string;
    layout: (string | string[])[];
}

interface FormLayoutProps<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DN;
    tabs?: TabLayout[]; // Direct tab configuration
    [key: string]: TabLayout | DN | string | TabLayout[] | undefined;
}

// Store for registered layouts
const layoutStore = new Map<string, TabLayout[]>();

export const FormLayout = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>({
    doctype,
    tabs,
    ...tabProps
}: FormLayoutProps<DN>) => {
    useEffect(() => {
        // Process tabs from tabs prop or dynamic tab props
        const tabsToProcess = tabs || Object.entries(tabProps)
            .filter(([key, tabConfig]) => 
                key.startsWith('tab_') && 
                tabConfig && 
                typeof tabConfig === 'object' && 
                'label' in tabConfig && 
                'layout' in tabConfig
            )
            .map(([, tabConfig]) => tabConfig as TabLayout);

        // Register the tabs layout
        layoutStore.set(doctype, tabsToProcess);
    }, [doctype, tabs]);

    return null; // This component only registers layout, doesn't render anything
};

// Hook to get registered layout
export const useFormLayoutTabs = (doctype: string): TabLayout[] | undefined => {
    return layoutStore.get(doctype);
};
