import React from "react";
import { Link } from "@/zodula/ui/components/router";
import { Button } from "@/zodula/ui/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/zodula/ui/lib/utils";

export interface WebsiteNavbarProps {
  /** Current page label (e.g. "Pricing") */
  currentPage?: string;
  /** Logo URL; if not set, no logo is shown */
  logoUrl?: string | null;
  /** Show "Go To Desk" button */
  showDeskButton?: boolean;
  className?: string;
}

export function WebsiteNavbar({
  currentPage = "Pricing",
  logoUrl,
  showDeskButton = true,
  className,
}: WebsiteNavbarProps) {
  return (
    <header
      className={cn(
        "zd:max-w-8xl zd:mx-auto zd:fixed zd:top-4 zd:left-4 zd:right-4 zd:z-50 zd:flex zd:items-center zd:justify-between zd:px-5 zd:py-3",
        "zd:rounded-2xl zd:border zd:border-border/50 zd:bg-background/90 zd:backdrop-blur-md zd:shadow-lg zd:shadow-black/5",
        className
      )}
    >
      <div className="zd:flex zd:items-center zd:gap-6">
        {logoUrl && (
          <Link
            to="/"
            className="zd:flex zd:items-center zd:gap-2 zd:rounded zd:hover:opacity-80 zd:transition-opacity"
          >
            <img src={logoUrl} alt="Logo" className="zd:w-9 zd:h-9 zd:rounded-lg zd:shadow-sm" />
          </Link>
        )}
        <nav className="zd:flex zd:items-center zd:gap-1">
          <Link
            to="/"
            className={cn(
              "zd:px-3 zd:py-2 zd:rounded-md zd:text-sm zd:font-medium zd:transition-colors",
              currentPage === "Home"
                ? "zd:text-foreground zd:bg-muted/60"
                : "zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/40"
            )}
          >
            Home
          </Link>
          <Link
            to="/pricing"
            className={cn(
              "zd:px-3 zd:py-2 zd:rounded-md zd:text-sm zd:font-medium zd:transition-colors",
              currentPage === "Pricing"
                ? "zd:text-foreground zd:bg-muted/60"
                : "zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/40"
            )}
          >
            Pricing
          </Link>
        </nav>
      </div>
      {showDeskButton && (
        <Link to="/desk">
          <Button variant="outline" size="sm" className="zd:gap-2">
            <LayoutDashboard className="zd:w-4 zd:h-4" />
            Go To Desk
          </Button>
        </Link>
      )}
    </header>
  );
}
