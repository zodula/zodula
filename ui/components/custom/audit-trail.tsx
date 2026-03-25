import React, { useMemo, useState } from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { zodula } from "@/zodula/client";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { useDocListAll } from "../../hooks/use-doc-list-all";
import { Link } from "react-router";
import { useTranslation } from "../../hooks/use-translation";
import {
  ExternalLinkIcon,
  Plus,
  Check,
  X,
  Trash2,
  MessageSquare,
  Pencil,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

interface AuditTrailProps {
  doctype: Zodula.DoctypeName;
  docId: string;
  className?: string;
}

// ── Action icon configuration ──────────────────────────────────────────────
type ActionMeta = {
  icon: React.ReactNode;
  bg: string;
  ring: string;
  label: string;
};

function getActionMeta(action: string): ActionMeta {
  switch (action) {
    case "Insert":
      return {
        icon: <Plus className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-primary/10",
        ring: "zd:ring-primary/30",
        label: "created this document",
      };
    case "Submit":
      return {
        icon: <Check className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-green-500/10",
        ring: "zd:ring-green-500/30",
        label: "submitted this document",
      };
    case "Cancel":
      return {
        icon: <X className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-orange-500/10",
        ring: "zd:ring-orange-500/30",
        label: "cancelled this document",
      };
    case "Delete":
      return {
        icon: <Trash2 className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-destructive/10",
        ring: "zd:ring-destructive/30",
        label: "deleted this document",
      };
    case "Comment":
      return {
        icon: <MessageSquare className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-blue-500/10",
        ring: "zd:ring-blue-500/30",
        label: "added a comment",
      };
    case "Rename":
      return {
        icon: <Pencil className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-muted",
        ring: "zd:ring-border",
        label: "renamed this document",
      };
    default: // Update
      return {
        icon: <Pencil className="zd:w-3 zd:h-3" />,
        bg: "zd:bg-muted",
        ring: "zd:ring-border",
        label: "updated this document",
      };
  }
}

// ── Action icon dot ────────────────────────────────────────────────────────
function ActionIconDot({
  action,
  isLast,
}: {
  action: string;
  isLast: boolean;
}) {
  const meta = getActionMeta(action);
  return (
    <div className="zd:relative zd:flex zd:flex-col zd:items-center zd:justify-center zd:flex-shrink-0">
      <div
        className={cn(
          "zd:w-5 zd:h-5 zd:rounded-full zd:flex zd:items-center zd:justify-center zd:ring-1 zd:z-10",
          "zd:text-foreground/70",
          meta.bg,
          meta.ring
        )}
      >
        {meta.icon}
      </div>
      {/* Vertical connector line */}
      {!isLast && (
        <div className="zd:w-px zd:flex-1 zd:min-h-4 zd:mt-1 zd:bg-border" />
      )}
    </div>
  );
}

// ── Date group heading ─────────────────────────────────────────────────────
function DateGroupHeading({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "zd:flex zd:items-center zd:gap-2 zd:w-full zd:text-left zd:py-1 zd:group",
        "zd:text-xs zd:font-semibold zd:text-muted-foreground zd:uppercase zd:tracking-wide",
        "zd:hover:text-foreground zd:transition-colors"
      )}
    >
      {collapsed ? (
        <ChevronRight className="zd:w-3 zd:h-3" />
      ) : (
        <ChevronDown className="zd:w-3 zd:h-3" />
      )}
      <span>{label}</span>
      <span className="zd:ml-auto zd:normal-case zd:font-normal zd:text-muted-foreground/60">
        {count} {count === 1 ? "event" : "events"}
      </span>
      <div className="zd:h-px zd:flex-1 zd:bg-border" />
    </button>
  );
}

// ── Change description formatter ────────────────────────────────────────────
function formatChanges(
  oldValue: string,
  newValue: string,
  action: string,
  fieldConfigMap: Record<string, { label: string; type: string }>
): string {
  const meta = getActionMeta(action);
  if (["Delete", "Insert", "Submit", "Cancel", "Comment", "Rename"].includes(action)) {
    return meta.label;
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value) || typeof value === "object")
      return JSON.stringify(value);
    return String(value);
  };

  try {
    const oldData = JSON.parse(oldValue);
    const newData = JSON.parse(newValue);
    const changes: string[] = [];

    const isOldArray = Array.isArray(oldData);
    const isNewArray = Array.isArray(newData);

    if (isOldArray || isNewArray) {
      if (isOldArray !== isNewArray) {
        changes.push(`type changed`);
      } else {
        const oldLength = oldData.length;
        const newLength = newData.length;
        if (oldLength !== newLength)
          changes.push(`array length from ${oldLength} to ${newLength}`);
        const maxItems = Math.max(oldLength, newLength);
        for (let i = 0; i < maxItems; i++) {
          if (i >= oldLength) changes.push(`added item at index ${i}`);
          else if (i >= newLength) changes.push(`removed item at index ${i}`);
          else if (JSON.stringify(oldData[i]) !== JSON.stringify(newData[i]))
            changes.push(
              `item at index ${i} from ${JSON.stringify(oldData[i])} to ${JSON.stringify(newData[i])}`
            );
        }
      }
    } else {
      if (
        oldData?.doc_status !== undefined &&
        newData?.doc_status !== undefined &&
        oldData.doc_status !== newData.doc_status
      ) {
        const statusMap: Record<string, string> = {
          Draft: "Draft",
          Submitted: "Submitted",
          Cancelled: "Cancelled",
        };
        changes.push(
          `status from "${statusMap[oldData.doc_status] || oldData.doc_status}" to "${statusMap[newData.doc_status] || newData.doc_status}"`
        );
      }

      const allKeys = new Set([
        ...Object.keys(oldData || {}),
        ...Object.keys(newData || {}),
      ]);

      const isSameEmpty = (a: unknown, b: unknown) =>
        (a === "" || a == null) && (b === "" || b == null);

      allKeys.forEach((key) => {
        if (ClientFieldHelper.isStandardField(key)) return;
        const oldVal = oldData[key];
        const newVal = newData[key];
        if (isSameEmpty(oldVal, newVal)) return;
        if (oldVal !== newVal) {
          const config = fieldConfigMap[key];
          const label = config?.label || key;
          if (config?.type === "Signature") {
            changes.push(`${label} updated`);
          } else if (config?.type === "Reference Table") {
            const oldLen = Array.isArray(oldVal) ? oldVal.length : 0;
            const newLen = Array.isArray(newVal) ? newVal.length : 0;
            if (newLen > oldLen) changes.push(`added rows for ${label}`);
            if (newLen < oldLen) changes.push(`removed rows for ${label}`);
          } else {
            changes.push(
              `${label} from "${formatValue(oldVal)}" to "${formatValue(newVal)}"`
            );
          }
        }
      });
    }

    if (changes.length === 0) return "made no detected changes";
    return changes.length === 1
      ? `changed ${changes[0]}`
      : `changed ${changes.slice(0, -1).join(", ")} and ${changes[changes.length - 1]}`;
  } catch {
    return "made changes";
  }
}

// ── Date grouping helper ──────────────────────────────────────────────────
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - entryDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// ── Timestamp helpers ─────────────────────────────────────────────────────

/**
 * Returns true when updated_at is more than 60 seconds after created_at,
 * meaning the audit trail record itself was edited after creation.
 */
function wasEdited(createdAt: string | undefined, updatedAt: string | undefined): boolean {
  if (!createdAt || !updatedAt) return false;
  const diff = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  return diff > 60_000;
}

/**
 * Formats a raw datetime string (yyyy-MM-dd HH:mm:ss) into a human-readable
 * label shown in the tooltip, e.g. "20 Mar 2026, 14:30".
 */
function formatFullDatetime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Single audit trail entry ──────────────────────────────────────────────
function AuditTrailEntry({
  trail,
  isLast,
  fieldConfigMap,
}: {
  trail: Zodula.SelectDoctype<"Audit Trail">;
  isLast: boolean;
  fieldConfigMap: Record<string, { label: string; type: string }>;
}) {
  const action = trail.action ?? "";
  const description = formatChanges(
    trail.old_value ?? "",
    trail.new_value ?? "",
    action,
    fieldConfigMap
  );
  const isComment = action === "Comment";
  const edited = wasEdited(trail.created_at, trail.updated_at);

  return (
    <div className="zd:flex zd:gap-3 zd:group">
      {/* Icon + connector line */}
      <ActionIconDot action={action} isLast={isLast} />

      {/* Body */}
      <div className={cn("zd:flex-1 zd:min-w-0", !isLast && "zd:pb-4")}>
        <div className="zd:flex zd:items-start zd:gap-2 zd:flex-wrap zd:pt-0.5">
          {/* Text */}
          <div className="zd:flex-1 zd:min-w-0 zd:text-sm zd:leading-snug">
            <Link
              to={`/desk/doctypes/User/form/${trail.created_by}`}
              className="zd:font-medium zd:text-foreground zd:hover:text-primary zd:transition-colors"
            >
              {trail.created_by ?? "Unknown"}
            </Link>{" "}
            <span className="zd:text-muted-foreground">{description}</span>
          </div>

          {/* Timestamps + external link */}
          <div className="zd:flex zd:flex-col zd:items-end zd:gap-0.5 zd:flex-shrink-0 zd:ml-auto">
            {/* created_at — relative with full datetime tooltip */}
            <div className="zd:flex zd:items-center zd:gap-1.5">
              <span
                className="zd:text-xs zd:text-muted-foreground/70 zd:whitespace-nowrap zd:cursor-default"
                title={`Created: ${formatFullDatetime(trail.created_at)}`}
              >
                {zodula.utils.formatTimeAgo(trail.created_at)}
              </span>
              <Link
                to={`/desk/doctypes/Audit Trail/form/${trail.id}`}
                className="zd:text-primary zd:opacity-0 zd:group-hover:opacity-100 zd:transition-opacity zd:flex-shrink-0"
              >
                <ExternalLinkIcon className="zd:w-3 zd:h-3" />
              </Link>
            </div>

            {/* updated_at — only shown when the record was edited after creation */}
            {edited && (
              <span
                className="zd:text-[10px] zd:text-muted-foreground/50 zd:whitespace-nowrap zd:cursor-default"
                title={`Updated: ${formatFullDatetime(trail.updated_at)}`}
              >
                edited {zodula.utils.formatTimeAgo(trail.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* Comment card */}
        {isComment && trail.comment && (
          <div
            className={cn(
              "zd:mt-2 zd:ml-8 zd:p-3 zd:rounded-lg zd:text-sm",
              "zd:bg-muted/50 zd:border zd:border-border",
              "zd:text-foreground/80 zd:italic zd:leading-relaxed"
            )}
          >
            {trail.comment}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Collapsible date group ────────────────────────────────────────────────
const COLLAPSE_THRESHOLD = 5;

function DateGroup({
  label,
  entries,
  fieldConfigMap,
  isLastGroup,
}: {
  label: string;
  entries: Zodula.SelectDoctype<"Audit Trail">[];
  fieldConfigMap: Record<string, { label: string; type: string }>;
  isLastGroup: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const shouldCollapse = entries.length > COLLAPSE_THRESHOLD;
  const visibleEntries =
    shouldCollapse && collapsed ? entries.slice(0, 2) : entries;
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className={cn(!isLastGroup && "zd:mb-2")}>
      <DateGroupHeading
        label={label}
        count={entries.length}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {!collapsed && (
        <div className="zd:mt-3 zd:ml-1">
          {visibleEntries.map((trail, idx) => (
            <AuditTrailEntry
              key={trail.id}
              trail={trail}
              isLast={idx === visibleEntries.length - 1 && hiddenCount === 0}
              fieldConfigMap={fieldConfigMap}
            />
          ))}

          {hiddenCount > 0 && (
            <button
              onClick={() => setCollapsed(false)}
              className={cn(
                "zd:flex zd:items-center zd:gap-2 zd:text-xs zd:text-primary",
                "zd:hover:text-primary/80 zd:transition-colors zd:mt-1 zd:ml-10"
              )}
            >
              <ChevronDown className="zd:w-3 zd:h-3" />
              Show {hiddenCount} more {hiddenCount === 1 ? "event" : "events"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Heading ────────────────────────────────────────────────────────────────
function AuditTrailHeading({ t }: { t: (key: string) => string }) {
  return (
    <div className="zd:flex zd:items-center zd:gap-2">
      <h3 className="zd:font-semibold zd:text-foreground">{t("Activity")}</h3>
      <div className="zd:h-px zd:flex-1 zd:bg-border" />
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────
export function AuditTrail({
  doctype,
  docId,
  className = "",
}: AuditTrailProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { doc: doctypeDoc } = useDoc({ doctype: "Doctype", id: doctype }, [doctype]);

  const { docs: allFields } = useDocListAll({ doctype: "Field" });
  const fieldConfigMap = useMemo(() => {
    return Object.fromEntries(
      allFields
        .filter((f: Zodula.SelectDoctype<"Field">) => f.doctype === doctype)
        .map((f: Zodula.SelectDoctype<"Field">) => [
          f.name,
          { label: f.label ?? f.name ?? "", type: f.type ?? "" },
        ])
    ) as Record<string, { label: string; type: string }>;
  }, [allFields, doctype]);

  const { docs: auditTrails, loading, error, reload } = useDocList({
    doctype: "Audit Trail",
    filters: [
      ["doctype", "=", doctype],
      ["doctype_id", "=", docId],
    ],
    sort: "created_at",
    order: "desc",
    limit: 50,
  });

  const commentsEnabled = doctypeDoc?.comments_enabled === 1;

  const handleSubmitComment = async () => {
    if (!comment.trim() || !docId) return;
    setIsSubmitting(true);
    try {
      await zodula.doc.create_doc("Audit Trail", {
        doctype,
        doctype_id: docId,
        action: "Comment",
        comment: comment.trim(),
        old_value: JSON.stringify({}),
        new_value: JSON.stringify({}),
      });
      setComment("");
      reload();
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group entries by date label
  const groupedEntries = useMemo(() => {
    if (!auditTrails || auditTrails.length === 0) return [];
    const map = new Map<string, Zodula.SelectDoctype<"Audit Trail">[]>();
    // auditTrails is sorted desc; we want to group in that order, but display groups oldest-first within each group
    for (const trail of auditTrails) {
      const label = getDateGroupLabel(trail.created_at ?? "");
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(trail);
    }
    return Array.from(map.entries());
  }, [auditTrails]);

  if (!docId) return null;

  return (
    <div className={cn("no-print", className)}>
      <div className="zd:mb-4">
        <AuditTrailHeading t={t} />
      </div>

      {/* Comment input */}
      {commentsEnabled && (
        <div className="zd:mb-6 zd:space-y-2">
          <Textarea
            placeholder={t("")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="zd:min-h-20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
          />
          <div className="zd:flex zd:justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={!comment.trim() || isSubmitting}
              loading={isSubmitting}
            >
              {t("Add Comment") || "Add Comment"}
            </Button>
          </div>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-sm zd:text-muted-foreground">
          <div className="zd:w-4 zd:h-4 zd:border-2 zd:border-primary/20 zd:border-t-primary zd:rounded-full zd:animate-spin" />
          {t("Loading")}
        </div>
      ) : error ? (
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-sm zd:text-destructive">
          {t("Error loading audit trail")}
        </div>
      ) : groupedEntries.length === 0 ? (
        <div className="zd:flex zd:flex-col zd:items-center zd:gap-2 zd:py-8 zd:text-muted-foreground">
          <Clock className="zd:w-8 zd:h-8 zd:opacity-30" />
          <span className="zd:text-sm">{t("No Activity")}</span>
        </div>
      ) : (
        <div className="zd:space-y-2">
          {groupedEntries.map(([label, entries], groupIdx) => (
            <DateGroup
              key={label}
              label={label}
              entries={entries}
              fieldConfigMap={fieldConfigMap}
              isLastGroup={groupIdx === groupedEntries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
