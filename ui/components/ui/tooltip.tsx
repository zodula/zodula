import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/zodula/ui/lib/utils";

const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 0;

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const showTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const padding = 6;
    const tooltipHeight = 28;
    const tooltipWidth = 220;

    let top = 0;
    let left = 0;
    if (side === "top") {
      top = rect.top - tooltipHeight - padding;
      left =
        align === "start"
          ? rect.left
          : align === "end"
            ? rect.right - tooltipWidth
            : rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (side === "bottom") {
      top = rect.bottom + padding;
      left =
        align === "start"
          ? rect.left
          : align === "end"
            ? rect.right - tooltipWidth
            : rect.left + rect.width / 2 - tooltipWidth / 2;
    } else if (side === "left") {
      top =
        align === "start"
          ? rect.top
          : align === "end"
            ? rect.bottom - tooltipHeight
            : rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - padding;
    } else {
      top =
        align === "start"
          ? rect.top
          : align === "end"
            ? rect.bottom - tooltipHeight
            : rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + padding;
    }
    setPosition({ top, left });
  }, [side, align]);

  const handleMouseEnter = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    showTimeoutRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (el) {
        triggerRef.current = el;
        updatePosition();
        setOpen(true);
      }
      showTimeoutRef.current = null;
    }, SHOW_DELAY_MS);
  }, [updatePosition]);

  const handleMouseLeave = React.useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    hideTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      hideTimeoutRef.current = null;
    }, HIDE_DELAY_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const child = React.Children.only(children);
  const trigger = React.cloneElement(child as React.ReactElement<{ ref?: React.Ref<unknown>; onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler }>, {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el;
      const origRef = (child as any).ref;
      if (typeof origRef === "function") origRef(el);
      else if (origRef) origRef.current = el;
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      (child as any).props?.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      (child as any).props?.onMouseLeave?.(e);
    },
  });

  React.useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  return (
    <>
      {trigger}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className={cn(
              "zd:fixed zd:z-[100] zd:max-w-[240px] zd:rounded-md zd:border zd:bg-popover zd:px-2 zd:py-1.5 zd:text-xs zd:text-popover-foreground zd:shadow-md zd:animate-in zd:fade-in-0 zd:zoom-in-95 zd:duration-150",
              className
            )}
            style={{
              top: position.top,
              left: position.left,
            }}
            onMouseEnter={() => {
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
