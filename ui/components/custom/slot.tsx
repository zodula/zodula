import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type SlotType = "replace" | "append" | "shift";
type SlotIndex = number | "all";

interface SlotProps {
    query: string;              // CSS selector for target element(s)
    index?: SlotIndex;          // which match to use, or "all"
    type?: SlotType;            // injection strategy
    children: ReactNode;
}

export const Slot: React.FC<SlotProps> = ({
    query,
    index = 0,
    type = "replace",
    children,
}) => {
    const [targets, setTargets] = useState<HTMLElement[]>([]);

    // Find all matching elements
    useEffect(() => {
        const els = Array.from(document.querySelectorAll<HTMLElement>(query));
        if (index === "all") {
            setTargets(els);
        } else {
            setTargets(els[index] ? [els[index]] : []);
        }
    }, [query, index]);

    // One container per target
    const containers = useMemo(() => {
        if (typeof document === "undefined") return [];
        return targets.map(() => document.createElement("div"));
    }, [targets]);

    useEffect(() => {
        containers.forEach((container, i) => {
            const target = targets[i];
            if (!target) return;

            if (type === "replace") {
                target.innerHTML = "";
                target.appendChild(container);
            } else if (type === "append") {
                target.appendChild(container);
            } else if (type === "shift") {
                target.insertBefore(container, target.firstChild);
            }
        });

        return () => {
            containers.forEach((container, i) => {
                const target = targets[i];
                if (target && container.parentNode === target) {
                    target.removeChild(container);
                }
            });
        };
    }, [targets, containers, type]);

    return (
        <>
            {containers.map((container, i) =>
                createPortal(children, container, `slot-${i}`)
            )}
        </>
    );
};
