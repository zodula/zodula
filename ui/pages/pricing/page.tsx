import React, { useMemo, useState } from "react";
import { Link } from "@/zodula/ui/components/router";
import { useAction } from "@/zodula/ui/hooks/use-action";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { WebsiteNavbar } from "@/zodula/ui/components/custom/website-navbar";
import { zodula } from "@/zodula/client";
import { cn } from "@/zodula/ui/lib/utils";

type AppTierConfigDoc = Zodula.SelectDoctype<"App Tier Config">;
type AppDoc = Zodula.SelectDoctype<"App">;
type AppTierConfigDoctypeItemDoc = Zodula.SelectDoctype<"App Tier Config Doctype Item">;
type DoctypeDoc = Zodula.SelectDoctype<"Doctype">;

function formatPrice(value: number | string | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (n === 0) return "Free";
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatLimit(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (n === -1) return "Unlimited";
  return String(n);
}

function isUnlimited(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  const n = Number(value);
  return Number.isNaN(n) || n === -1;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Get effective limit item for a tier by inheriting from lower tiers (same logic as insert.ts). */
function getEffectiveLimitItem(
  itemsByConfig: Map<string, AppTierConfigDoctypeItemDoc>,
  appConfigs: AppTierConfigDoc[],
  configIndex: number
): AppTierConfigDoctypeItemDoc | undefined {
  for (let i = configIndex; i >= 0; i--) {
    const config = appConfigs[i];
    if (!config?.id) continue;
    const item = itemsByConfig.get(config.id);
    if (item) return item;
  }
  return undefined;
}

export default function PricingPage() {
  const { doc: globalSetting } = useDocAll({
    doctype: "Global Setting",
    id: "Global Setting",
  });
  const { docs: configs, loading: configsLoading, error: configsError } = useDocListAll({
    doctype: "App Tier Config",
  });
  const { docs: apps, loading: appsLoading } = useDocListAll({
    doctype: "App",
  });
  const { docs: doctypeItems } = useDocListAll({
    doctype: "App Tier Config Doctype Item",
  });
  const { docs: doctypes } = useDocListAll({
    doctype: "Doctype",
  });

  const logoUrl = globalSetting?.logo
    ? zodula.utils.getDoctypeFileUrl(
        "Global Setting",
        globalSetting?.id || "",
        "logo",
        (globalSetting?.logo as string) || "",
        "System Panel"
      ) + "?w=40&h=40"
    : "/public/zodula/zodula-logo.png";

  const itemsByConfigId = useMemo(() => {
    const items = (doctypeItems || []) as AppTierConfigDoctypeItemDoc[];
    const map = new Map<string, AppTierConfigDoctypeItemDoc[]>();
    for (const item of items) {
      const pid = item.parentid;
      if (!pid) continue;
      const list = map.get(pid) || [];
      list.push(item);
      map.set(pid, list);
    }
    return map;
  }, [doctypeItems]);

  const doctypeNameById = useMemo(() => {
    const list = (doctypes || []) as DoctypeDoc[];
    const map = new Map<string, string>();
    for (const d of list) {
      if (d.id) map.set(d.id, d.label || d.name || d.id);
    }
    return map;
  }, [doctypes]);

  const byApp = useMemo(() => {
    const configList = (configs || []).filter(
      (c: AppTierConfigDoc) => c.enabled !== 0
    ) as AppTierConfigDoc[];
    const appList = (apps || []) as AppDoc[];
    const map = new Map<string, { app: AppDoc; configs: AppTierConfigDoc[] }>();

    for (const app of appList) {
      if (!app?.id) continue;
      const configsForApp = configList.filter((c) => c.app === app.id);
      if (configsForApp.length > 0) {
        configsForApp.sort((a, b) => Number(a.tier_level ?? 0) - Number(b.tier_level ?? 0));
        map.set(app.id, { app, configs: configsForApp });
      }
    }

    return Array.from(map.entries())
      .map(([_, v]) => v)
      .sort((a, b) => (a.app.name ?? "").localeCompare(b.app.name ?? ""));
  }, [configs, apps]);

  const [priceInterval, setPriceInterval] = useState<"month" | "year">("year");
  const { data: serverTzData } = useAction("zodula.core.serverTimezone", {}, []);
  const serverTz = serverTzData ?? null;
  const loading = configsLoading || appsLoading;

  if (loading) {
    return (
      <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
        <WebsiteNavbar currentPage="Pricing" logoUrl={logoUrl} />
        <div className="zd:flex-1 zd:flex zd:items-center zd:justify-center zd:relative zd:z-10">
          <p className="zd:text-muted-foreground">Loading pricing…</p>
        </div>
      </div>
    );
  }

  if (configsError) {
    return (
      <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
        <WebsiteNavbar currentPage="Pricing" logoUrl={logoUrl} />
        <div className="zd:flex-1 zd:flex zd:items-center zd:justify-center zd:relative zd:z-10">
          <p className="zd:text-destructive">{configsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
      <WebsiteNavbar currentPage="Pricing" logoUrl={logoUrl} />

      <main className="zd:flex-1 zd:relative zd:z-10 zd:pt-20">
        <div className="zd:max-w-6xl zd:mx-auto zd:px-4 zd:py-10 zd:space-y-14">
          <header className="zd:flex zd:items-start zd:justify-between zd:gap-4 zd:flex-wrap">
            <div className="zd:space-y-2">
              <h1 className="zd:text-3xl zd:font-semibold zd:text-foreground">Pricing</h1>
              <p className="zd:text-muted-foreground">
                Choose a plan per app. Limits and features are defined by tier.
              </p>
              {serverTz?.timezone && (
                <p className="zd:text-xs zd:text-muted-foreground">
                  {serverTz.resetNote ?? "Daily limits reset at midnight; monthly limits reset on the 1st."}{" "}
                  <span className="zd:font-medium zd:text-foreground/80">Server timezone: {serverTz.timezone}</span>
                </p>
              )}
            </div>
            <div className="zd:flex zd:items-center zd:gap-1 zd:rounded-lg zd:p-1 zd:bg-muted/50 zd:border zd:border-border">
              <button
                type="button"
                onClick={() => setPriceInterval("month")}
                className={cn(
                  "zd:px-3 zd:py-1.5 zd:rounded-md zd:text-sm zd:font-medium zd:transition-colors",
                  priceInterval === "month"
                    ? "zd:bg-background zd:text-foreground zd:shadow-sm"
                    : "zd:text-muted-foreground zd:hover:text-foreground"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPriceInterval("year")}
                className={cn(
                  "zd:px-3 zd:py-1.5 zd:rounded-md zd:text-sm zd:font-medium zd:transition-colors",
                  priceInterval === "year"
                    ? "zd:bg-background zd:text-foreground zd:shadow-sm"
                    : "zd:text-muted-foreground zd:hover:text-foreground"
                )}
              >
                Yearly
              </button>
            </div>
          </header>

          {byApp.length === 0 ? (
            <div className="zd:text-center zd:py-12 zd:text-muted-foreground">
              No pricing configured yet.
            </div>
          ) : (
            byApp.map(({ app, configs: appConfigs }) => {
              const allItemsForApp = appConfigs.flatMap(
                (c) => itemsByConfigId.get(c.id) || []
              );
              const uniqueDoctypeIds = [...new Set(allItemsForApp.map((i) => i.doctype).filter(Boolean))] as string[];

              return (
                <section key={app.id} className="zd:space-y-6">
                  <h2 className="zd:text-xl zd:font-semibold zd:text-foreground zd:border-b zd:pb-2">
                    {capitalize(app.name ?? app.id ?? "")}
                  </h2>

                  {/* Comparison table: plan columns with description + features */}
                  <div className="zd:rounded-2xl zd:border zd:border-border zd:bg-card zd:overflow-hidden zd:shadow-lg zd:shadow-black/5">
                    <div className="zd:overflow-x-auto">
                      <table className="zd:w-full zd:min-w-[560px] zd:text-sm zd:border-collapse">
                        <thead>
                          <tr>
                            <th className="zd:w-[180px] zd:text-left zd:font-semibold zd:text-foreground zd:px-5 zd:py-4 zd:bg-muted/30 zd:border-b zd:border-border zd:rounded-tl-2xl" />
                            <th className="zd:text-left zd:font-medium zd:text-muted-foreground zd:px-5 zd:py-4 zd:bg-muted/30 zd:border-b zd:border-border zd:w-24" />
                            {appConfigs.map((config, idx) => {
                              const isFirst = idx === 0;
                              const isLast = idx === appConfigs.length - 1;
                              const currency = config.currency ?? "$";
                              const priceMonthly = config.price_monthly != null ? Number(config.price_monthly) : null;
                              const priceYearly = config.price_yearly != null ? Number(config.price_yearly) : null;
                              const price = priceInterval === "month" ? priceMonthly : priceYearly;
                              const periodLabel = priceInterval === "month" ? " / month" : " / year";
                              return (
                                <th
                                  key={config.id}
                                  className={cn(
                                    "zd:text-left zd:align-top zd:px-5 zd:py-5 zd:bg-muted/20 zd:border-b zd:border-border",
                                    isFirst && "zd:border-l",
                                    isLast && "zd:rounded-tr-2xl"
                                  )}
                                >
                                  <div className="zd:space-y-3">
                                    <div className="zd:font-semibold zd:text-base zd:text-foreground">
                                      {config.package_name || "—"}
                                    </div>
                                    <div className="zd:text-lg zd:font-semibold zd:text-foreground">
                                      {formatPrice(price, currency)}
                                      <span className="zd:text-sm zd:font-normal zd:text-muted-foreground">{periodLabel}</span>
                                    </div>
                                    {config.description ? (
                                      <p className="zd:text-xs zd:text-muted-foreground zd:leading-snug zd:line-clamp-3">
                                        {config.description}
                                      </p>
                                    ) : null}
                                    <Link
                                      to="/desk"
                                      className="zd:inline-flex zd:items-center zd:justify-center zd:w-full zd:py-2 zd:rounded-lg zd:text-sm zd:font-medium zd:bg-primary zd:text-primary-foreground zd:hover:bg-primary/90 zd:transition-colors"
                                    >
                                      Get started
                                    </Link>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Document limits section header */}
                          {uniqueDoctypeIds.length > 0 && (
                            <tr className="zd:bg-muted/30">
                              <td
                                colSpan={2 + appConfigs.length}
                                className="zd:px-5 zd:py-2.5 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground"
                              >
                                Document limits
                              </td>
                            </tr>
                          )}
                          {uniqueDoctypeIds.map((doctypeId, docIdx) => {
                            const doctypeName = doctypeNameById.get(doctypeId) ?? doctypeId;
                            const itemsByConfig = new Map<string, AppTierConfigDoctypeItemDoc>();
                            for (const item of allItemsForApp) {
                              if (item.doctype === doctypeId && item.parentid)
                                itemsByConfig.set(item.parentid, item);
                            }
                            const itemsForDoctype = appConfigs.map((_, idx) =>
                              getEffectiveLimitItem(itemsByConfig, appConfigs, idx)
                            ).filter(Boolean) as AppTierConfigDoctypeItemDoc[];
                            const showMaxTotal = itemsForDoctype.some((i) => !isUnlimited(i.max_doc));
                            const showMaxPerMonth = itemsForDoctype.some((i) =>
                              !isUnlimited(i.max_doc_per_month)
                            );
                            const showMaxPerDay = itemsForDoctype.some((i) =>
                              !isUnlimited(i.max_doc_per_day)
                            );
                            const rowCount =
                              (showMaxTotal ? 1 : 0) +
                              (showMaxPerMonth ? 1 : 0) +
                              (showMaxPerDay ? 1 : 0);
                            const isLastDoctype = docIdx === uniqueDoctypeIds.length - 1;
                            const rowClass = cn(
                              "zd:border-b zd:border-border/50",
                              docIdx % 2 === 0 ? "zd:bg-background/40" : "zd:bg-background/60"
                            );
                            return (
                              <React.Fragment key={doctypeId}>
                                {showMaxTotal && (
                                  <tr
                                    className={cn(
                                      rowClass,
                                      !showMaxPerMonth && !showMaxPerDay && isLastDoctype && "zd:border-b-0"
                                    )}
                                  >
                                    <td
                                      className="zd:px-5 zd:py-2.5 zd:font-medium zd:text-foreground zd:align-top"
                                      rowSpan={rowCount}
                                    >
                                      {doctypeName}
                                    </td>
                                    <td className="zd:px-5 zd:py-2.5 zd:text-muted-foreground zd:whitespace-nowrap zd:text-xs">
                                      Max total
                                    </td>
                                    {appConfigs.map((config, idx) => {
                                      const item = getEffectiveLimitItem(itemsByConfig, appConfigs, idx);
                                      return (
                                        <td
                                          key={config.id}
                                          className="zd:px-5 zd:py-2.5 zd:text-foreground"
                                        >
                                          {formatLimit(item?.max_doc)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                )}
                                {showMaxPerMonth && (
                                  <tr
                                    className={cn(
                                      rowClass,
                                      !showMaxPerDay && isLastDoctype && "zd:border-b-0"
                                    )}
                                  >
                                    {!showMaxTotal && (
                                      <td
                                        className="zd:px-5 zd:py-2.5 zd:font-medium zd:text-foreground zd:align-top"
                                        rowSpan={rowCount}
                                      >
                                        {doctypeName}
                                      </td>
                                    )}
                                    <td className="zd:px-5 zd:py-2.5 zd:text-muted-foreground zd:whitespace-nowrap zd:text-xs">
                                      Max per month
                                    </td>
                                    {appConfigs.map((config, idx) => {
                                      const item = getEffectiveLimitItem(itemsByConfig, appConfigs, idx);
                                      return (
                                        <td
                                          key={config.id}
                                          className="zd:px-5 zd:py-2.5 zd:text-foreground"
                                        >
                                          {formatLimit(item?.max_doc_per_month)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                )}
                                {showMaxPerDay && (
                                  <tr
                                    className={cn(
                                      rowClass,
                                      isLastDoctype && "zd:border-b-0"
                                    )}
                                  >
                                    {!showMaxTotal && !showMaxPerMonth && (
                                      <td
                                        className="zd:px-5 zd:py-2.5 zd:font-medium zd:text-foreground zd:align-top"
                                        rowSpan={rowCount}
                                      >
                                        {doctypeName}
                                      </td>
                                    )}
                                    <td className="zd:px-5 zd:py-2.5 zd:text-muted-foreground zd:whitespace-nowrap zd:text-xs">
                                      Max per day
                                    </td>
                                    {appConfigs.map((config, idx) => {
                                      const item = getEffectiveLimitItem(itemsByConfig, appConfigs, idx);
                                      return (
                                        <td
                                          key={config.id}
                                          className="zd:px-5 zd:py-2.5 zd:text-foreground"
                                        >
                                          {formatLimit(item?.max_doc_per_day)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
