import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useTranslation } from "../../hooks/use-translation";
import { X } from "lucide-react";

interface ColumnSelectDialogProps {
  isOpen: boolean;
  onClose: (result?: string) => void;
  initialData?: {
    availableColumns: Array<{ key: string; label: string }>;
  };
}

export const ColumnSelectDialog = ({
  isOpen,
  onClose,
  initialData,
}: ColumnSelectDialogProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen || !initialData) return null;

  const { availableColumns } = initialData;

  // Filter columns based on search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableColumns;
    }

    const query = searchQuery.toLowerCase().trim();
    return availableColumns.filter((col) =>
      (col.label?.toLowerCase() || "").includes(query) ||
      (col.key?.toLowerCase() || "").includes(query)
    );
  }, [availableColumns, searchQuery]);

  const handleColumnSelect = (columnKey: string) => {
    onClose(columnKey);
  };

  return (
    <div className="zd:min-w-[400px] zd:flex zd:flex-col zd:gap-4">
      <div className="zd:flex zd:items-center zd:justify-between">
        <h3 className="zd:text-lg zd:font-semibold">{t("Select Column")}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onClose()}
          className="zd:h-6 zd:w-6 zd:p-0"
        >
          <X className="zd:h-4 zd:w-4" />
        </Button>
      </div>

      <div className="zd:flex zd:flex-col zd:gap-2">
        <Input
          placeholder={t("Search columns...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="zd:w-full"
        />

        <div className="zd:max-h-[400px] zd:overflow-y-auto zd:border zd:border-border zd:rounded-md">
          {filteredColumns.length === 0 ? (
            <div className="zd:p-4 zd:text-center zd:text-muted-foreground">
              {t("No columns found")}
            </div>
          ) : (
            <div className="zd:divide-y zd:divide-border">
              {filteredColumns.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => handleColumnSelect(col.key)}
                  className="zd:w-full zd:px-4 zd:py-2 zd:text-left zd:hover:bg-muted zd:transition-colors"
                >
                  <div className="zd:font-medium">{t(col.label || col.key)}</div>
                  <div className="zd:text-sm zd:text-muted-foreground">{col.key}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="zd:flex zd:justify-end zd:gap-2">
        <Button variant="outline" size="sm" onClick={() => onClose()}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  );
};

