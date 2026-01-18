import React, { useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { zodula } from "@/zodula/client";
import { cn } from "@/zodula/ui/lib/utils";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const created = await zodula.doc.create_doc("zodula__Organization", {
        name: name.trim(),
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
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter organization name"
            autoFocus
            className={cn(error ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
          {error && (
            <p className="zd:mt-1 zd:text-sm zd:text-destructive">{error}</p>
          )}
        </div>
      </div>
      <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-4 zd:border-t">
        <Button
          variant="outline"
          onClick={() => onClose()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
          {isLoading ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );
}

