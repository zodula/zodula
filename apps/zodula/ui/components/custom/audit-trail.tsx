import React, { useEffect } from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { zodula } from "@/zodula/client";
import { useDocList } from "../../hooks/use-doc-list";
import { Link } from "react-router";
import { useTranslation } from "../../hooks/use-translation";
import { ExternalLinkIcon } from "lucide-react";

interface AuditTrailProps {
  doctype: Zodula.DoctypeName;
  docId: string;
  className?: string;
}

// Extract heading component to avoid duplication
function AuditTrailHeading({ t }: { t: (key: string) => string }) {
  return (
    <div className="zd:flex zd:items-center zd:gap-2">
      <h3 className="zd:font-semibold zd:text-foreground">{t("Activity")}</h3>
      <div className="zd:h-px zd:flex-1 zd:bg-border"></div>
    </div>
  );
}

export function AuditTrail({
  doctype,
  docId,
  className = "",
}: AuditTrailProps) {
  const { t } = useTranslation();
  const {
    docs: auditTrails,
    loading,
    error,
    reload,
  } = useDocList({
    doctype: "zodula__Audit Trail",
    filters: [
      ["doctype", "=", doctype],
      ["doctype_id", "=", docId],
    ],
    sort: "created_at",
    order: "desc",
    limit: 50,
  });

  if (!docId) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn("zd:space-y-4", className)}>
        <AuditTrailHeading t={t} />
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-sm zd:text-muted-foreground">
          <div className="zd:w-4 zd:h-4 zd:border-2 zd:border-primary/20 zd:border-t-primary zd:rounded-full zd:animate-spin"></div>
          {t("Loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("zd:space-y-4", className)}>
        <AuditTrailHeading t={t} />
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-sm zd:text-destructive">
          {t("Error loading audit trail")}
        </div>
      </div>
    );
  }

  if (!auditTrails || auditTrails.length === 0) {
    return (
      <div className={cn("zd:space-y-4 no-print", className)}>
        <AuditTrailHeading t={t} />
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-muted-foreground">
          {t("No Activity")}
        </div>
      </div>
    );
  }

  const formatChanges = (
    oldValue: string,
    newValue: string,
    action: string,
    maxLength: number = 100
  ) => {
    if (action === "Delete") {
      return "Delete this document";
    }

    if (action === "Submit") {
      return "Submit this document";
    }

    if (action === "Cancel") {
      return "Cancel this document";
    }

    if (action === "Rename") {
      return (
        "Rename this document from " +
        JSON.parse(oldValue)?.id +
        " to " +
        JSON.parse(newValue)?.id
      );
    }

    try {
      const oldData = JSON.parse(oldValue);
      const newData = JSON.parse(newValue);

      const changes: string[] = [];

      // Check for doc_status changes
      if (oldData.doc_status !== newData.doc_status) {
        const statusMap: Record<number, string> = {
          0: "Draft",
          1: "Submitted",
          2: "Cancelled",
        };
        const oldStatus = statusMap[oldData.doc_status] || oldData.doc_status;
        const newStatus = statusMap[newData.doc_status] || newData.doc_status;
        changes.push(`status from "${oldStatus}" to "${newStatus}"`);
      }

      // Check for other field changes
      Object.keys(newData).forEach((key) => {
        if (key !== "doc_status" && oldData[key] !== newData[key]) {
          const oldVal =
            oldData[key] === null || oldData[key] === undefined
              ? "empty"
              : String(oldData[key]);
          const newVal =
            newData[key] === null || newData[key] === undefined
              ? "empty"
              : String(newData[key]);

          // Truncate long values
          const truncatedOld =
            oldVal.length > 30 ? oldVal.substring(0, 30) + "..." : oldVal;
          const truncatedNew =
            newVal.length > 30 ? newVal.substring(0, 30) + "..." : newVal;

          changes.push(`${key} from "${truncatedOld}" to "${truncatedNew}"`);
        }
      });

      if (changes.length === 0) {
        return "No changes detected";
      }

      const fullText =
        changes.length === 1
          ? `Changed ${changes[0]}`
          : `Changed ${changes.slice(0, -1).join(", ")} and ${changes[changes.length - 1]}`;

      if (fullText.length <= maxLength) {
        return fullText;
      }

      return fullText.substring(0, maxLength) + "...";
    } catch {
      return "Changes made";
    }
  };

  return (
    <div className={cn("no-print", className)}>
      <div className="zd:mb-2">
        <AuditTrailHeading t={t} />
      </div>

      <div className="zd:space-y-0">
        {auditTrails.map((trail, index) => (
          <div key={trail.id} className="zd:relative zd:group">
            <div className="zd:flex zd:items-start zd:gap-4 zd:pl-3">
              {/* Bullet point */}
              <div className="zd:relative zd:flex-shrink-0 zd:pt-3">
                <div className="zd:w-1 zd:h-1 zd:bg-gray-400 zd:rounded-full zd:group-hover:bg-primary zd:transition-colors"></div>
              </div>

              {/* Content */}
              <div className="zd:flex-1 zd:min-w-0 zd:pb-2 zd:pt-1">
                <div className="zd:flex zd:items-center zd:gap-2">
                  <div className="zd:text-sm zd:text-gray-700 zd:leading-relaxed">
                    <Link
                      to={`/desk/doctypes/zodula__User/form/${trail.created_by}`}
                      className="zd:text-muted-foreground zd:hover:text-primary zd:transition-colors"
                    >
                      {trail.by_name
                        ? trail.by_name
                        : trail.created_by
                          ? `${trail.created_by.substring(0, 8)}...`
                          : "System"}
                    </Link>
                    <span className="zd:text-muted-foreground">
                      {" "}
                      {formatChanges(
                        trail.old_value || "",
                        trail.new_value || "",
                        trail.action || ""
                      )}
                    </span>
                  </div>
                  <span className="zd:text-muted-foreground">·</span>

                  <div className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:text-gray-500">
                    <span className="">
                      {zodula.utils.formatTimeAgo(trail.created_at)}
                    </span>
                    <span className="zd:text-muted-foreground">·</span>
                    <Link
                      to={`/desk/doctypes/zodula__Audit Trail/form/${trail.id}`}
                      className="zd:text-primary zd:hover:text-primary zd:transition-colors zd:opacity-0 zd:group-hover:opacity-100"
                    >
                      <ExternalLinkIcon className="zd:w-3 zd:h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
