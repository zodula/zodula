import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "@/zodula/ui/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarEventPreview } from "./CalendarEventPreview";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

export type CalendarEventItem = {
  id: string;
  doctype: string;
  date: string;
  label: string;
};

const MAX_CHIPS_VISIBLE = 5;

type CalendarViewProps = {
  year: number;
  month: number;
  primary: CalendarEventItem[];
  secondary: CalendarEventItem[];
  allFields: Zodula.Field[];
  loading?: boolean;
  error?: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  weekdayLabels: string[];
  title: string;
};

function startOfCalendarGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const mondayBased = dow === 0 ? 6 : dow - 1;
  const d = new Date(year, month, 1 - mondayBased);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarEventChip({
  event,
  allFields,
  variant,
}: {
  event: CalendarEventItem;
  allFields: Zodula.Field[];
  variant: "primary" | "secondary";
}) {
  const metaFields = useMemo(
    () =>
      allFields
        .filter((f) => (f as { doctype?: string }).doctype === event.doctype)
        .sort((a, b) => ((a as { idx?: number }).idx ?? 0) - ((b as { idx?: number }).idx ?? 0)),
    [allFields, event.doctype]
  );

  const btnClass =
    variant === "primary"
      ? cn(
          "zd:w-full zd:cursor-pointer zd:truncate zd:rounded-md zd:border zd:border-amber-500/25 zd:bg-amber-500/[0.08] zd:px-2 zd:py-1.5",
          "zd:text-left zd:text-xs zd:leading-snug zd:text-foreground zd:shadow-sm",
          "zd:transition-colors hover:zd:bg-amber-500/15 focus-visible:zd:outline-none focus-visible:zd:ring-2 focus-visible:zd:ring-primary/30"
        )
      : cn(
          "zd:w-full zd:cursor-pointer zd:truncate zd:rounded-md zd:border zd:border-border/80 zd:bg-muted/50 zd:px-2 zd:py-1.5",
          "zd:text-left zd:text-xs zd:leading-snug zd:text-foreground",
          "zd:transition-colors hover:zd:bg-muted focus-visible:zd:outline-none focus-visible:zd:ring-2 focus-visible:zd:ring-primary/30"
        );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={btnClass} title={event.label}>
          <span className="zd:block zd:truncate">{event.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="zd:w-max zd:min-w-[12rem] zd:max-w-[min(100vw-1.5rem,26rem)] zd:p-0 zd:shadow-xl"
        align="start"
        side="right"
        sideOffset={8}
      >
        <CalendarEventPreview
          doctype={event.doctype as Zodula.DoctypeName}
          id={event.id}
          metaFields={metaFields}
          chipLabel={event.label}
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarDayCell({
  bucket,
  allFields,
  inMonth,
  isToday,
  dayNumber,
  className,
}: {
  bucket: { primary: CalendarEventItem[]; secondary: CalendarEventItem[] };
  allFields: Zodula.Field[];
  inMonth: boolean;
  isToday: boolean;
  dayNumber: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(
    () => [
      ...bucket.primary.map((e) => ({ event: e, variant: "primary" as const })),
      ...bucket.secondary.map((e) => ({ event: e, variant: "secondary" as const })),
    ],
    [bucket.primary, bucket.secondary]
  );

  const total = items.length;
  const hasOverflow = total > MAX_CHIPS_VISIBLE;
  const visible = hasOverflow && !expanded ? items.slice(0, MAX_CHIPS_VISIBLE) : items;
  const hiddenCount = total - MAX_CHIPS_VISIBLE;

  return (
    <div
      className={cn(
        "zd:flex zd:min-h-[6.5rem] zd:flex-col zd:bg-background zd:p-2 zd:text-left",
        "zd:transition-colors",
        !inMonth && "zd:bg-muted/30 zd:text-muted-foreground",
        isToday && "zd:bg-primary/[0.04] zd:ring-1 zd:ring-inset zd:ring-primary/35",
        className
      )}
    >
      <div className="zd:mb-1.5 zd:flex zd:items-center zd:justify-between zd:gap-1">
        <span
          className={cn(
            "zd:inline-flex zd:h-7 zd:min-w-[1.75rem] zd:items-center zd:justify-center zd:rounded-full zd:px-1.5 zd:text-xs zd:font-semibold zd:tabular-nums",
            isToday
              ? "zd:bg-primary zd:text-primary-foreground"
              : inMonth
                ? "zd:text-foreground"
                : "zd:text-muted-foreground"
          )}
        >
          {dayNumber}
        </span>
        {total > 0 && inMonth ? (
          <span className="zd:shrink-0 zd:rounded-full zd:bg-muted/80 zd:px-1.5 zd:py-0.5 zd:text-[10px] zd:font-medium zd:tabular-nums zd:text-muted-foreground">
            {total}
          </span>
        ) : null}
      </div>

      <div className="zd:flex zd:min-h-0 zd:flex-1 zd:flex-col zd:gap-1">
        {visible.map(({ event, variant }) => (
          <CalendarEventChip
            key={`${variant}-${event.id}`}
            event={event}
            allFields={allFields}
            variant={variant}
          />
        ))}
        {hasOverflow ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="zd:h-7 zd:shrink-0 zd:justify-center zd:gap-1 zd:px-1 zd:text-[11px] zd:font-medium zd:text-muted-foreground hover:zd:text-foreground"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? (
              <>
                <ChevronUp className="zd:h-3.5 zd:w-3.5" aria-hidden />
                {t("Show less")}
              </>
            ) : (
              <>
                <ChevronDown className="zd:h-3.5 zd:w-3.5" aria-hidden />
                {t(`+${hiddenCount} more`)}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function CalendarView({
  year,
  month,
  primary,
  secondary,
  allFields,
  loading,
  error,
  onPrevMonth,
  onNextMonth,
  onToday,
  weekdayLabels,
  title,
}: CalendarViewProps) {
  const { t } = useTranslation();

  const byDate = useMemo(() => {
    const map = new Map<string, { primary: CalendarEventItem[]; secondary: CalendarEventItem[] }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { primary: [], secondary: [] });
      return map.get(key)!;
    };
    for (const e of primary) {
      ensure(e.date).primary.push(e);
    }
    for (const e of secondary) {
      ensure(e.date).secondary.push(e);
    }
    return map;
  }, [primary, secondary]);

  const cells = useMemo(() => {
    const start = startOfCalendarGrid(year, month);
    const out: { date: Date; inMonth: boolean; ymd: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const inMonth = d.getMonth() === month;
      out.push({ date: d, inMonth, ymd: toYmd(d) });
    }
    return out;
  }, [year, month]);

  return (
    <div className="zd:flex zd:flex-col zd:gap-5 zd:rounded-xl zd:border zd:border-border/60 zd:bg-card/30 zd:p-4 zd:shadow-sm">
      <div className="zd:flex zd:flex-wrap zd:items-center zd:justify-between zd:gap-3">
        <div className="zd:min-w-0">
          <h2 className="zd:truncate zd:text-xl zd:font-semibold zd:tracking-tight zd:text-foreground">{title}</h2>
        </div>
        <div className="zd:flex zd:items-center zd:gap-1 zd:rounded-lg zd:border zd:border-border/80 zd:bg-muted/20 zd:p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="zd:h-8 zd:px-2"
            onClick={onPrevMonth}
            aria-label={t("Previous month")}
          >
            <ChevronLeft className="zd:h-4 zd:w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="zd:h-8 zd:px-3 zd:text-xs" onClick={onToday}>
            {t("Today")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="zd:h-8 zd:px-2"
            onClick={onNextMonth}
            aria-label={t("Next month")}
          >
            <ChevronRight className="zd:h-4 zd:w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="zd:rounded-lg zd:border zd:border-destructive/35 zd:bg-destructive/10 zd:px-3 zd:py-2.5 zd:text-sm zd:text-destructive">
          {error}
        </div>
      ) : null}

      <div
        className={cn(
          "zd:overflow-hidden zd:rounded-xl zd:border zd:border-border/70 zd:bg-background zd:shadow-inner",
          loading && "zd:pointer-events-none zd:opacity-55"
        )}
      >
        <div className="zd:grid zd:grid-cols-7">
          {weekdayLabels.map((w) => (
            <div
              key={w}
              className="zd:border-b zd:border-border/60 zd:bg-muted/40 zd:px-2 zd:py-2.5 zd:text-center zd:text-[11px] zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {cells.map(({ date, inMonth, ymd }, i) => {
            const bucket = byDate.get(ymd) || { primary: [], secondary: [] };
            const isToday = toYmd(new Date()) === ymd;
            const col = i % 7;
            const notLastRow = i < 35;
            return (
              <CalendarDayCell
                key={ymd}
                bucket={bucket}
                allFields={allFields}
                inMonth={inMonth}
                isToday={isToday}
                dayNumber={date.getDate()}
                className={cn(col < 6 && "zd:border-r zd:border-border/45", notLastRow && "zd:border-b zd:border-border/45")}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
