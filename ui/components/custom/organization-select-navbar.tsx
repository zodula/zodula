import React from "react";
import { Link } from "@/zodula/ui/components/router";
import { Button } from "@/zodula/ui/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/zodula/ui/lib/utils";

export interface OrganizationSelectNavbarProps {
  /** Logo URL; if not set, no logo is shown */
  logoUrl?: string | null;
  /** Current user display name or email */
  userDisplayName?: string | null;
  /** Logout handler */
  onLogout?: () => void;
  className?: string;
}

export function OrganizationSelectNavbar({
  logoUrl,
  userDisplayName,
  onLogout,
  className,
}: OrganizationSelectNavbarProps) {
  return (
    <header
      className={cn(
        "zd:fixed zd:top-4 zd:left-4 zd:right-4 zd:z-50 zd:flex zd:items-center zd:justify-between zd:px-5 zd:py-3",
        "zd:rounded-2xl zd:border zd:border-border/50 zd:bg-background/90 zd:backdrop-blur-md zd:shadow-lg zd:shadow-black/5",
        className
      )}
    >
      <Link
        to="/"
        className="zd:flex zd:items-center zd:gap-2 zd:rounded zd:hover:opacity-80 zd:transition-opacity"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="zd:w-9 zd:h-9 zd:rounded-lg zd:shadow-sm" />
        ) : (
          <span className="zd:text-sm zd:font-medium zd:text-foreground">Desk</span>
        )}
      </Link>
      {userDisplayName != null && (
        <div className="zd:flex zd:items-center zd:gap-3">
          <span className="zd:text-sm zd:text-muted-foreground zd:max-w-[180px] zd:truncate">
            {userDisplayName}
          </span>
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="zd:text-muted-foreground zd:hover:text-destructive"
            >
              <LogOut className="zd:w-4 zd:h-4" />
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
