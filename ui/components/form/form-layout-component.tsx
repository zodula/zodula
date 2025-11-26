import React from 'react';
import { FormLayoutField } from './form-layout-field';

// Tab Component
interface TabProps<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DN;
    position: 'below' | 'above' | 'replace';
    to: keyof Zodula.SelectDoctype<DN>;
    label: string;
}

export const FormLayoutTab = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(
    { doctype, position, to, label }: TabProps<DN>
) => (
    <FormLayoutField
        doctype={doctype}
        position={position}
        to={to}
        type="Tab"
        label={label}
    />
);

// Section Component
interface SectionProps<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DN;
    position: 'below' | 'above' | 'replace';
    to: keyof Zodula.SelectDoctype<DN>;
    label: string;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
}

export const FormLayoutSection = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(
    { doctype, position, to, label, collapsible, defaultCollapsed }: SectionProps<DN>
) => (
    <FormLayoutField
        doctype={doctype}
        position={position}
        to={to}
        type="Section"
        label={label}
        collapsible={collapsible}
        defaultCollapsed={defaultCollapsed}
    />
);

// Column Component
interface ColumnProps<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    doctype: DN;
    position: 'below' | 'above' | 'replace';
    to: keyof Zodula.SelectDoctype<DN>;
    length?: number;
}

export const FormLayoutColumn = <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(
    { doctype, position, to, length }: ColumnProps<DN>
) => (
    <FormLayoutField
        doctype={doctype}
        position={position}
        to={to}
        type="Column"
        length={length}
    />
);
