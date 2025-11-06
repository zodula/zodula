import React from "react";
import { Button, buttonVariants } from "@/zodula/ui/components/ui/button";
import { Keyboard, HelpCircle, X } from "lucide-react";
import { cn } from "@/zodula/ui/lib/utils";
import { popup } from "@/zodula/ui/components/ui/popit";
import type { VariantProps } from "class-variance-authority";

interface KeyboardShortcut {
  keys: string;
  description: string;
}

interface KeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: VariantProps<typeof buttonVariants>["variant"];
}

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: (result?: void) => void;
  initialData?: {
    shortcuts: KeyboardShortcut[];
  };
}

// Dialog component for popup usage
export const KeyboardShortcutsDialog = ({
  isOpen,
  onClose,
  initialData,
}: KeyboardShortcutsDialogProps) => {
  const shortcuts = initialData?.shortcuts || [];

  if (!shortcuts || shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="zd:flex zd:flex-col zd:gap-4">
      <div className="zd:space-y-4">
        <div className="zd:grid zd:grid-cols-1 zd:lg:grid-cols-3 zd:gap-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="zd:flex zd:items-center zd:justify-between zd:p-3 zd:bg-muted/50 zd:rounded-lg"
            >
              <span className="zd:text-sm zd:font-medium">
                {shortcut.description}
              </span>
              <div className="zd:flex zd:items-center zd:gap-1">
                {shortcut.keys.split(" + ").map((key, keyIndex) => (
                  <React.Fragment key={keyIndex}>
                    <kbd className="zd:px-2 zd:py-1 zd:bg-background zd:border zd:border-border zd:rounded zd:text-xs zd:font-mono">
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.split(" + ").length - 1 && (
                      <span className="zd:text-muted-foreground">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="zd:pt-4 zd:border-t">
          <p className="zd:text-xs zd:text-muted-foreground">
            Press{" "}
            <kbd className="zd:px-1 zd:py-0.5 zd:bg-background zd:border zd:border-border zd:rounded zd:text-xs">
              F1
            </kbd>{" "}
            to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
};

export function KeyboardShortcuts({
  shortcuts,
  className,
  size = "default",
  variant = "outline",
}: KeyboardShortcutsProps) {
  if (!shortcuts || shortcuts.length === 0) {
    return null;
  }

  const handleOpenShortcuts = async () => {
    popup(
      KeyboardShortcutsDialog,
      {
        title: "Keyboard Shortcuts",
        description: "Available keyboard shortcuts for this page",
      },
      {
        shortcuts,
      }
    );
  };

  return (
    <Button
      variant={variant || "subtle"}
      size={size}
      className={cn(className || "")}
      onClick={handleOpenShortcuts}
    >
      <Keyboard className="zd:w-4 zd:h-4" />
    </Button>
  );
}

// Helper component for displaying a single shortcut
export function ShortcutKey({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "zd:px-2 zd:py-1 zd:bg-background zd:border zd:border-border zd:rounded zd:text-xs zd:font-mono",
        className || ""
      )}
    >
      {children}
    </kbd>
  );
}

// Helper component for displaying shortcut combinations
export function ShortcutCombination({
  keys,
  className,
}: {
  keys: string;
  className?: string;
}) {
  return (
    <div className={cn("zd:flex zd:items-center zd:gap-1", className || "")}>
      {keys.split(" + ").map((key, index) => (
        <React.Fragment key={index}>
          <ShortcutKey>{key}</ShortcutKey>
          {index < keys.split(" + ").length - 1 && (
            <span className="zd:text-muted-foreground">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
