import { useRouter } from "@/zodula/ui/components/router";
import { DeskNavbarLayout, type PrimaryAction } from "@/zodula/ui/layout/desk-navbar-layout";
import { useDocListAll } from "@/zodula/ui/hooks/use-doc-list-all";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useDocAll } from "@/zodula/ui/hooks/use-doc-all";
import { useListParams } from "@/zodula/ui/hooks/use-list-params";
import { Plus, RefreshCw } from "lucide-react";
import {
  ViewSelector,
  getDoctypeViewOptions,
  getDoctypeViewFromPath,
  type FieldLike,
} from "@/zodula/ui/components/view-selector";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodula } from "@/zodula/client";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import ErrorView from "@/zodula/ui/views/error-view";
import { CalendarView, type CalendarEventItem } from "@/zodula/ui/components/list/CalendarView";
import { ListToolbar } from "@/zodula/ui/components/list/ListToolbar";
import { QuickFilterBar } from "@/zodula/ui/components/list/QuickFilterBar";
import type { IFilter, IOperator } from "@/zodula/server/zodula/type";

function monthRangeYmd(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month + 1)}-01`;
  const last = new Date(year, month + 1, 0);
  const to = `${year}-${pad(month + 1)}-${pad(last.getDate())}`;
  return { from, to };
}

export default function DoctypeCalendarPage() {
  const { params, push, replace, location, search } = useRouter();
  const doctype = params.doctype as Zodula.DoctypeName;
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [primary, setPrimary] = useState<CalendarEventItem[]>([]);
  const [secondary, setSecondary] = useState<CalendarEventItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);

  const {
    sort,
    order,
    filters,
    onSortChange,
    onOrderChange,
    onApplyFilters,
    onClearFilter,
  } = useListParams();

  const { docs: allFields, reload: reloadFields } = useDocListAll({ doctype: "Field" });
  const { doc: doctypeDoc, reload: reloadDoctype } = useDocAll({
    doctype: "Doctype",
    id: doctype,
  });

  const { docs: calendarRows, reload: reloadCalendarFlag } = useDocList(
    {
      doctype: "Doctype Calendar",
      limit: 1,
      filters: [["doctype", "=", doctype] as any],
    },
    [doctype]
  );
  const calendarEnabled = calendarRows.length > 0;

  const fields = useMemo(
    () =>
      allFields
        .filter((f) => (f as any).doctype === doctype)
        .sort((a, b) => ((a as any).idx ?? 0) - ((b as any).idx ?? 0)),
    [allFields, doctype]
  );

  const sortFields = useMemo(
    () =>
      fields.filter(
        (field: Zodula.Field) =>
          field.type !== "Reference Table" && field.type !== "Extend"
      ),
    [fields]
  );

  const emptyFilters = useMemo(() => [] as IFilter<any, any, IOperator>[], []);
  const filtersKey = JSON.stringify(filters ?? []);

  const { from, to } = useMemo(() => monthRangeYmd(year, month), [year, month]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let filtersPayload: IFilter<any, any, IOperator>[] = [];
    try {
      filtersPayload = JSON.parse(filtersKey) as IFilter<any, any, IOperator>[];
    } catch {
      filtersPayload = [];
    }
    try {
      const res = (await zodula.action("zodula.calendar.get" as any, {
        data: {
          doctype,
          from,
          to,
          filters: filtersPayload,
          q: "",
          sort: sort || "updated_at",
          order: order || "desc",
        },
      })) as {
        config: unknown;
        primary: CalendarEventItem[];
        secondary: CalendarEventItem[];
      };
      setPrimary(res?.primary || []);
      setSecondary(res?.secondary || []);
      if (!res?.config) {
        setLoadError(t("No calendar configuration for this doctype."));
      }
    } catch (e: any) {
      setPrimary([]);
      setSecondary([]);
      setLoadError(e?.message || t("Failed to load calendar"));
    } finally {
      setLoading(false);
    }
  }, [doctype, from, to, filtersKey, sort, order, t]);

  useEffect(() => {
    reloadFields();
    reloadDoctype();
  }, [doctype, search, params, reloadFields, reloadDoctype]);

  useEffect(() => {
    if (doctypeDoc?.is_single) {
      replace(`/desk/doctypes/${doctype}`);
    }
  }, [doctypeDoc, replace, doctype]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const handleCreate = () => {
    push(`/desk/doctypes/${doctype}/form`, { state: { resetForm: true } });
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    reloadCalendarFlag();
    await loadMonth();
    setIsRefreshing(false);
  };

  const primaryActions: PrimaryAction[] = [
    {
      label: t("Create"),
      icon: <Plus className="zd:h-4 zd:w-4" />,
      onClick: handleCreate,
    },
    {
      label: "",
      icon: <RefreshCw className="zd:h-4 zd:w-4" />,
      onClick: handleRefresh,
      variant: "outline",
      disabled: isRefreshing,
    },
  ];

  const title = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
        new Date(year, month, 1)
      ),
    [year, month]
  );

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
    const base = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(base.getTime() + i * 86400000)));
  }, []);

  const hasActiveFilter = useMemo(
    () => (filters?.length ?? 0) > 0,
    [filters]
  );

  const handleClearFilters = () => {
    onClearFilter();
  };

  if (!doctypeDoc?.id) {
    return <ErrorView message="Doctype not found" status={404} />;
  }

  return (
    <DeskNavbarLayout
      title={t(`${doctypeDoc?.label || doctype}`)}
      defaultRightOpen={false}
      primaryAction={primaryActions}
      actionSection={
        <ViewSelector
          views={getDoctypeViewOptions(t, fields as FieldLike[], doctype, { calendarEnabled })}
          value={getDoctypeViewFromPath(location.pathname)}
          onChange={(value) => {
            if (value === "list") {
              push(`/desk/doctypes/${doctype}/list${location.search}`);
            } else if (value === "tree") {
              push(`/desk/doctypes/${doctype}/tree${location.search}`);
            } else if (value === "calendar") {
              push(`/desk/doctypes/${doctype}/calendar${location.search}`);
            } else {
              push(`/desk/doctypes/${doctype}/sheet${location.search}`);
            }
          }}
        />
      }
    >
      <div className="zd:flex zd:flex-col zd:gap-4 zd:pb-12 zd:h-full">
        <ListToolbar
          hasActiveFilter={hasActiveFilter}
          onClearFilter={handleClearFilters}
          sortFields={sortFields}
          sortValue={sort ?? ""}
          onSortChange={onSortChange}
          orderValue={(order ?? "desc") as "asc" | "desc"}
          onOrderChange={onOrderChange}
          filters={filters ?? emptyFilters}
          onApplyFilters={(f) => onApplyFilters(f)}
          filterPopupOpen={filterPopupOpen}
          onFilterPopupOpenChange={setFilterPopupOpen}
          allFields={fields as Zodula.Field[]}
          doctype={doctype}
          quickFilterBar={
            <QuickFilterBar
              fields={fields as Zodula.Field[]}
              filters={filters ?? emptyFilters}
              onApplyFilters={(f) => onApplyFilters(f)}
              doctype={doctype}
            />
          }
        />
        <CalendarView
          year={year}
          month={month}
          primary={primary}
          secondary={secondary}
          allFields={allFields as Zodula.Field[]}
          loading={loading}
          error={loadError}
          title={title}
          weekdayLabels={weekdayLabels}
          onPrevMonth={() => {
            if (month === 0) {
              setYear((y) => y - 1);
              setMonth(11);
            } else {
              setMonth(month - 1);
            }
          }}
          onNextMonth={() => {
            if (month === 11) {
              setYear((y) => y + 1);
              setMonth(0);
            } else {
              setMonth(month + 1);
            }
          }}
          onToday={() => {
            const d = new Date();
            setYear(d.getFullYear());
            setMonth(d.getMonth());
          }}
        />
      </div>
    </DeskNavbarLayout>
  );
}
