import React from "react";
import { useAction } from "@/zodula/ui/hooks/use-action";
import { cn } from "@/zodula/ui/lib/utils";

interface AppTierPopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: { orgId: string; orgName?: string };
}

export function AppTierPopup({ isOpen, onClose, initialData }: AppTierPopupProps) {
  const orgId = initialData?.orgId ?? "";
  const orgName = initialData?.orgName ?? orgId;

  const { data, loading } = useAction(
    "zodula.org.getAppTiers",
    { data: { organization: orgId }, method: "post" },
    [isOpen && orgId ? orgId : ""]
  );

  const items = data?.items ?? [];

  return (
    <div className="zd:flex zd:flex-col zd:gap-4">
      {loading ? (
        <p className="zd:text-sm zd:text-muted-foreground">Loading app tiers…</p>
      ) : items.length === 0 ? (
        <p className="zd:text-sm zd:text-muted-foreground">
          Unknown [0]
        </p>
      ) : (
        <ul className="zd:space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className={cn(
                "zd:flex zd:items-center zd:justify-between zd:gap-2 zd:py-2 zd:px-3",
                "zd:rounded-md zd:bg-muted/50 zd:text-sm"
              )}
            >
              <span className="zd:font-medium zd:text-foreground">
                {item.appName}
              </span>
              <span className="zd:text-muted-foreground">
                {item.packageName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
