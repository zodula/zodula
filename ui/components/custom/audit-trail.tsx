import React, { useEffect, useState } from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { zodula } from "@/zodula/client";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { Link } from "react-router";
import { useTranslation } from "../../hooks/use-translation";
import { ExternalLinkIcon } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useAuth } from "../../hooks/use-auth";

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
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch doctype to check comments_enabled
  const { doc: doctypeDoc } = useDoc({
    doctype: "zodula__Doctype",
    id: doctype,
  }, [doctype]);

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

  // Check if comments are enabled for this doctype
  const commentsEnabled = doctypeDoc?.comments_enabled === 1;

  const handleSubmitComment = async () => {
    if (!comment.trim() || !docId) return;

    setIsSubmitting(true);
    try {
      // Create audit trail entry with comment
      await zodula.doc.create_doc("zodula__Audit Trail", {
        doctype: doctype,
        doctype_id: docId,
        action: "Comment",
        comment: comment.trim(),
        old_value: JSON.stringify({}),
        new_value: JSON.stringify({}),
        by_name: user?.name || "",
      });

      // Clear comment input
      setComment("");
      
      // Reload audit trail to show new comment
      reload();
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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

    if (action === "Comment") {
      return "added a comment";
    }

    if (action === "Rename") {
      return (
        "Rename this document from " +
        JSON.parse(oldValue)?.id +
        " to " +
        JSON.parse(newValue)?.id
      );
    }

    // Helper function to format a value for display
    const formatValue = (value: any, maxLen: number = 50): string => {
      if (value === null || value === undefined) {
        return "empty";
      }
      
      // For arrays and objects, use JSON.stringify to avoid "[object Object]"
      if (Array.isArray(value) || typeof value === "object") {
        const jsonStr = JSON.stringify(value);
        if (jsonStr.length > maxLen) {
          return jsonStr.substring(0, maxLen) + "...";
        }
        return jsonStr;
      }
      
      return String(value);
    };

    try {
      const oldData = JSON.parse(oldValue);
      const newData = JSON.parse(newValue);

      const changes: string[] = [];

      // Handle arrays
      const isOldArray = Array.isArray(oldData);
      const isNewArray = Array.isArray(newData);

      if (isOldArray || isNewArray) {
        // Handle mixed types (one is array, one is object)
        if (isOldArray !== isNewArray) {
          const oldType = isOldArray ? "array" : "object";
          const newType = isNewArray ? "array" : "object";
          changes.push(`type from ${oldType} to ${newType}`);
        } else {
          // Both are arrays
          const oldLength = oldData.length;
          const newLength = newData.length;

          if (oldLength !== newLength) {
            changes.push(`array length from ${oldLength} to ${newLength}`);
          }

          // Check for item changes (simple comparison)
          const maxItemsToCompare = Math.max(oldLength, newLength);
          for (let i = 0; i < maxItemsToCompare; i++) {
            if (i >= oldLength) {
              changes.push(`added item at index ${i}`);
            } else if (i >= newLength) {
              changes.push(`removed item at index ${i}`);
            } else if (JSON.stringify(oldData[i]) !== JSON.stringify(newData[i])) {
              const oldItem = JSON.stringify(oldData[i]);
              const newItem = JSON.stringify(newData[i]);
              const truncatedOld =
                oldItem.length > 20 ? oldItem.substring(0, 20) + "..." : oldItem;
              const truncatedNew =
                newItem.length > 20 ? newItem.substring(0, 20) + "..." : newItem;
              changes.push(`item at index ${i} from ${truncatedOld} to ${truncatedNew}`);
            }
          }
        }
      } else {
        // Both are objects
        // Check for doc_status changes
        if (oldData?.doc_status !== undefined && newData?.doc_status !== undefined && oldData.doc_status !== newData.doc_status) {
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
        const allKeys = new Set([
          ...Object.keys(oldData || {}),
          ...Object.keys(newData || {}),
        ]);

        allKeys.forEach((key) => {
          if (key !== "doc_status" && oldData[key] !== newData[key]) {
            // Use formatValue for a concise display, or formatValueDetailed for full JSON
            const oldVal = formatValue(oldData[key]);
            const newVal = formatValue(newData[key]);

            changes.push(`${key} from "${oldVal}" to "${newVal}"`);
          }
        });
      }

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
      <div className="zd:mb-4">
        <AuditTrailHeading t={t} />
      </div>

      {/* Comment Input Box - Only show if comments are enabled */}
      {commentsEnabled && (
        <div className="zd:mb-4 zd:space-y-2">
          <Textarea
            placeholder={t("Add a comment...") || "Add a comment..."}
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
              size="sm"
            >
              {t("Add Comment") || "Add Comment"}
            </Button>
          </div>
        </div>
      )}

      <div className="zd:space-y-0">
        {(!auditTrails || auditTrails.length === 0) ? (
          <div className="zd:flex zd:items-center zd:gap-2 zd:text-muted-foreground zd:py-4">
            {t("No Activity")}
          </div>
        ) : (
          auditTrails.map((trail, index) => (
          <div key={trail.id} className="zd:relative zd:group">
            <div className="zd:flex zd:items-start zd:gap-4 zd:pl-3">
              {/* Bullet point */}
              <div className="zd:relative zd:flex-shrink-0 zd:pt-3">
                <div className="zd:w-1 zd:h-1 zd:bg-gray-400 zd:rounded-full zd:group-hover:bg-primary zd:transition-colors"></div>
              </div>

              {/* Content */}
              <div className="zd:flex-1 zd:min-w-0 zd:pb-2 zd:pt-1">
                <div className="zd:flex zd:flex-col zd:gap-1">
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
                  {/* Comment display */}
                  {trail.comment && (
                    <div className="zd:ml-0 zd:mt-1 zd:pl-4 zd:border-l-2 zd:border-gray-200 zd:text-sm zd:text-gray-600 zd:italic">
                      {trail.comment}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
