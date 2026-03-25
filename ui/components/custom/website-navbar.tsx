import React, { useEffect, useState } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { Button } from "@/zodula/ui/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/zodula/ui/lib/utils";
import { zodula } from "@/zodula/client";

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function navLinkClass(active: boolean) {
  return cn(
    "zd:px-3 zd:py-2 zd:rounded-md zd:text-sm zd:font-medium zd:transition-colors",
    active
      ? "zd:text-foreground zd:bg-muted/60"
      : "zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/40"
  );
}

export interface WebsiteNavbarProps {
  /** Current page label (e.g. "Home") */
  currentPage?: string;
  /** Logo URL; if not set, no logo is shown */
  logoUrl?: string | null;
  /** Show "Go To Desk" button */
  showDeskButton?: boolean;
  className?: string;
}

export function WebsiteNavbar({
  currentPage,
  logoUrl,
  showDeskButton = true,
  className,
}: WebsiteNavbarProps) {
  const { pathname } = useRouter();
  const [additionalMenu, setAdditionalMenu] = useState<{ label: string; url: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    zodula
      .get_action("zodula.org.getInfo" as Zodula.ActionPath, {})
      .then((data: { org: Record<string, unknown> | null }) => {
        if (cancelled) return;
        const raw = data?.org?.additional_menu;
        if (!Array.isArray(raw)) {
          setAdditionalMenu([]);
          return;
        }
        setAdditionalMenu(
          (raw as { label?: string; url?: string }[])
            .map((row) => ({
              label: String(row?.label ?? "").trim(),
              url: String(row?.url ?? "").trim(),
            }))
            .filter((row) => row.label && row.url)
        );
      })
      .catch(() => {
        if (!cancelled) setAdditionalMenu([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const homeActive = currentPage === "Home" || pathname === "/" || pathname === "";
  const contactActive = currentPage === "Contact" || pathname === "/contact";

  const isInternalActive = (url: string) =>
    pathname === url || (url !== "/" && pathname.startsWith(`${url}/`));

  return (
    <header
      className={cn(
        "zd:max-w-8xl zd:mx-auto zd:fixed zd:top-4 zd:left-4 zd:right-4 zd:z-50 zd:flex zd:items-center zd:justify-between zd:gap-3 zd:px-5 zd:py-3",
        "zd:rounded-2xl zd:border zd:border-border/50 zd:bg-background/90 zd:backdrop-blur-md zd:shadow-lg zd:shadow-black/5",
        className
      )}
    >
      <div className="zd:flex zd:min-w-0 zd:flex-1 zd:items-center zd:gap-4 md:zd:gap-6">
        {logoUrl && (
          <Link
            to="/"
            className="zd:flex zd:shrink-0 zd:items-center zd:gap-2 zd:rounded zd:hover:opacity-80 zd:transition-opacity"
          >
            <img src={logoUrl} alt="Logo" className="zd:w-9 zd:h-9 zd:rounded-lg zd:shadow-sm" />
          </Link>
        )}
        <nav className="zd:flex zd:min-w-0 zd:flex-wrap zd:items-center zd:gap-1">
          <Link to="/" className={navLinkClass(homeActive)}>
            Home
          </Link>
          <Link to="/contact" className={navLinkClass(contactActive)}>
            Contact
          </Link>
          {additionalMenu.map((item, i) => {
            const external = isAbsoluteHttpUrl(item.url);
            const active = !external && isInternalActive(item.url);
            if (external) {
              return (
                <a
                  key={`${item.label}-${item.url}-${i}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={navLinkClass(false)}
                >
                  {item.label}
                </a>
              );
            }
            return (
              <Link
                key={`${item.label}-${item.url}-${i}`}
                to={item.url}
                className={navLinkClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {showDeskButton && (
        <Link to="/desk" className="zd:shrink-0">
          <Button variant="outline" size="sm" className="zd:gap-2">
            <LayoutDashboard className="zd:w-4 zd:h-4" />
            Go To Desk
          </Button>
        </Link>
      )}
    </header>
  );
}
