import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

const DRAWER_SIDES = ["left", "right"] as const;
type DrawerSide = (typeof DRAWER_SIDES)[number];

const ANIMATION_DURATION_MS = 300;

export interface DrawerProps {
  open?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Which side the drawer slides in from. Default: "left" */
  side?: DrawerSide;
  /** Optional title shown in the drawer header */
  title?: React.ReactNode;
  /** Max width of the drawer panel. Default: "min(320px, 85vw)" */
  width?: string | number;
  /** Hide the close button. User can still close via overlay click or Escape */
  showCloseButton?: boolean;
}

export function Drawer({
  open = false,
  onClose,
  children,
  className,
  side = "left",
  title,
  width,
  showCloseButton = true,
}: DrawerProps) {
  const panelWidth = width ?? "min(320px, 85vw)";
  const widthStyle =
    typeof panelWidth === "number" ? `${panelWidth}px` : panelWidth;

  // Keep mounted during exit animation; isVisible drives slide transition
  const [shouldRender, setShouldRender] = React.useState(open);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Double RAF so initial off-screen state paints before animating in
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(rafId);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), ANIMATION_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  React.useEffect(() => {
    if (shouldRender) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [shouldRender]);

  React.useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!shouldRender) return null;

  const isLeft = side === "left";

  return (
    <div
      className={cn("zd:fixed zd:inset-0 zd:z-50", className)}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Drawer"}
    >
      {/* Backdrop - click to close, with fade animation */}
      <div
        className={cn(
          "zd:absolute zd:inset-0 zd:bg-black/40 zd:backdrop-blur-sm zd:cursor-pointer zd:transition-opacity zd:duration-300",
          isVisible ? "zd:opacity-100" : "zd:opacity-0"
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Panel - slide animation */}
      <div
        className={cn(
          "zd:absolute zd:top-0 zd:bottom-0 zd:z-10 zd:flex zd:flex-col zd:bg-background zd:shadow-xl zd:transition-transform zd:duration-300 zd:ease-out",
          isLeft ? "zd:left-0" : "zd:right-0",
          isVisible
            ? "zd:translate-x-0"
            : isLeft
              ? "zd:-translate-x-full"
              : "zd:translate-x-full"
        )}
        style={{ width: widthStyle, maxWidth: "85vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="zd:flex zd:flex-shrink-0 zd:items-center zd:justify-between zd:gap-2 zd:border-b zd:border-border zd:px-4 zd:py-3">
            {title && (
              <div className="zd:flex-1 zd:min-w-0">
                {typeof title === "string" ? (
                  <h2 className="zd:text-lg zd:font-semibold zd:text-foreground zd:truncate">
                    {title}
                  </h2>
                ) : (
                  title
                )}
              </div>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="zd:h-8 zd:w-8 zd:p-0"
                aria-label="Close"
              >
                <X className="zd:h-4 zd:w-4" />
              </Button>
            )}
          </div>
        )}
        <div className="zd:flex-1 zd:overflow-y-auto zd:overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
