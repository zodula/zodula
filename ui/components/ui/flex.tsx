import { type HTMLAttributes } from "react";

interface FlexProps extends HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

export const Flex = ({ children, ...props }: FlexProps) => {
    return <div className="zd:flex" {...props}>{children}</div>;
};

export const Row = ({ children, ...props }: FlexProps) => {
    return <div className="zd:flex zd:flex-row" {...props}>{children}</div>;
};

export const Column = ({ children, ...props }: FlexProps) => {
    return <div className="zd:flex zd:flex-col" {...props}>{children}</div>;
};