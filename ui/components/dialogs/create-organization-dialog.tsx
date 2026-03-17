import React, { useState } from "react";
import { Button } from "@/zodula/ui/components/ui/button";
import { Checkbox } from "@/zodula/ui/components/ui/checkbox";
import { Input } from "@/zodula/ui/components/ui/input";
import { zodula } from "@/zodula/client";
import { cn } from "@/zodula/ui/lib/utils";
import { useTranslation } from "../../hooks/use-translation";

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: (result?: { id: string; organization_name: string; unique_name: string; abbr: string }) => void;
  initialData?: Record<string, any>;
}

export function CreateOrganizationDialog({
  isOpen,
  onClose,
  initialData,
}: CreateOrganizationDialogProps) {
  const [organizationName, setOrganizationName] = useState(initialData?.organization_name ?? "");
  const [uniqueName, setUniqueName] = useState(initialData?.unique_name ?? "");
  const [abbr, setAbbr] = useState(initialData?.abbr ?? "");
  const [taxId, setTaxId] = useState(initialData?.tax_id ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [website, setWebsite] = useState(initialData?.website ?? "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "$");
  const [acceptedNameAbbrImmutable, setAcceptedNameAbbrImmutable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleCreate = async () => {
    if (!organizationName.trim()) {
      setError("Organization Name is required");
      return;
    }
    if (!uniqueName.trim()) {
      setError("Unique Name is required");
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
          organization_name: organizationName.trim(),
          unique_name: uniqueName.trim(),
          abbr: abbr.trim(),
          ...(taxId.trim() ? { tax_id: taxId.trim() } : {}),
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(website.trim() ? { website: website.trim() } : {}),
          ...(currency.trim() ? { currency: currency.trim() } : {}),
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
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const clearError = () => setError(null);
  const isFormValid =
    organizationName.trim() &&
    uniqueName.trim() &&
    abbr.trim() &&
    acceptedNameAbbrImmutable;

  if (!isOpen) return null;

  return (
    <div className="zd:min-w-[400px] zd:max-h-[85vh] zd:flex zd:flex-col zd:gap-4 zd:overflow-y-auto">
      <div className="zd:space-y-4">
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Organization Name")} <span className="zd:text-destructive">*</span>
          </label>
          <Input
            value={organizationName}
            onChange={(e) => {
              setOrganizationName(e.target.value);
              clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("Enter organization name")}
            autoFocus
            className={cn(error && !organizationName.trim() ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Unique Name")} <span className="zd:text-destructive">*</span>
          </label>
          <Input
            value={uniqueName}
            onChange={(e) => {
              setUniqueName(e.target.value);
              clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("e.g. My Company")}
            className={cn(error && !uniqueName.trim() ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
          <p className="zd:mt-1 zd:text-xs zd:text-muted-foreground">
            {t('Must be unique and short. Used in naming series (e.g. "My Company", "Your Company", "Their Company").')}
          </p>
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Abbreviation")} <span className="zd:text-destructive">*</span>
          </label>
          <Input
            value={abbr}
            onChange={(e) => {
              setAbbr(e.target.value);
              clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ORG1, ORG2"
            className={cn(error && !abbr.trim() ? "zd:border-destructive" : "")}
            disabled={isLoading}
          />
          <p className="zd:mt-1 zd:text-xs zd:text-muted-foreground">
            {t('Must be unique and short. Used in naming series (e.g. "ORG1", "ORG2", "ORG3").')}
          </p>
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Tax ID")}
          </label>
          <Input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Tax ID")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Address")}
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Address")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Phone")}
          </label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Phone")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Email")}
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Email")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Website")}
          </label>
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("Website")}
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="zd:text-sm zd:font-medium zd:text-foreground zd:block zd:mb-2">
            {t("Currency")}
          </label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="$"
            disabled={isLoading}
          />
        </div>
        <Checkbox
          id="accept-name-abbr-immutable"
          checked={acceptedNameAbbrImmutable}
          onCheckedChange={(v) => setAcceptedNameAbbrImmutable(v === true)}
          label={t("I understand that the organization unique name and abbreviation cannot be changed later.")}
          disabled={isLoading}
          className="zd:mt-2"
        />
        {error && (
          <p className="zd:text-sm zd:text-destructive">{error}</p>
        )}
      </div>
      <div className="zd:flex zd:justify-end zd:gap-2 zd:pt-4 zd:border-t zd:flex-shrink-0">
        <Button
          variant="outline"
          onClick={() => onClose()}
          disabled={isLoading}
        >
          {t("Cancel")}
        </Button>
        <Button onClick={handleCreate} disabled={isLoading || !isFormValid}>
          {isLoading ? t("Creating...") : t("Create")}
        </Button>
      </div>
    </div>
  );
}



