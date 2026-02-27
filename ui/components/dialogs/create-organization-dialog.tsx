import React, { useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { zodula } from "@/zodula/client";
import { cn } from "@/zodula/ui/lib/utils";
import { useTranslation } from "../../hooks/use-translation";

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: (result?: { id: string; name: string }) => void;
  initialData?: Record<string, any>;
}

export function CreateOrganizationDialog({
  isOpen,
  onClose,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!abbr.trim()) {
      setError("Abbreviation is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const created = await zodula.action("zodula.org.create", {
        data: {
          name: name.trim(),
          abbr: abbr.trim(),
        },
      });
      onClose(created);
    } catch (err: any) {
      setError(err?.message || "Failed to create organization");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const clearError = () => setError(null);
  const isFormValid = name.trim() && abbr.trim();

  if (!isOpen) return null;

  return (
    <div className="zd:min-w-[400px] zd:flex zd:flex-col zd:gap-4">
      <div className="zd:space-y-4">
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            Name <span className="zd:text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter organization name"
            autoFocus
            className={cn(error ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            Abbreviation <span className="zd:text-destructive">*</span>
          </label>
          <Input
            value={abbr}
            onChange={(e) => {
              setAbbr(e.target.value);
              clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ORG1, ORG2"
            className={cn(error ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
          <p className="zd:mt-1 zd:text-xs zd:text-muted-foreground">
            {t('Must be unique and short. Used in naming series (e.g. "ORG1", "ORG2", "ORG3").')}
          </p>
        </div>
        {error && (
          <p className="zd:text-sm zd:text-destructive">{error}</p>
        )}
      </div>
      <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-4 zd:border-t">
        <Button
          variant="outline"
          onClick={() => onClose()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isLoading || !isFormValid}>
          {isLoading ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );
}



