import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { RotateCcw } from "lucide-react"
import { useTranslation } from "../../hooks/use-translation"

interface ColumnSettingsDialogProps {
    isOpen: boolean
    onClose: (result?: { visibleColumns: string[]; resetToDefault?: boolean }) => void
    initialData?: {
        doctype: string
        availableColumns: Array<{ key: string; label: string; sortable?: boolean | undefined }>
        visibleColumns: string[]
        defaultColumns: string[]
    }
}

export const ColumnSettingsDialog = ({ isOpen, onClose, initialData }: ColumnSettingsDialogProps) => {
    const [visibleColumns, setVisibleColumns] = useState<string[]>(initialData?.visibleColumns || [])
    const [hasChanges, setHasChanges] = useState(false)
    const { t } = useTranslation()
    useEffect(() => {
        setVisibleColumns(initialData?.visibleColumns || [])
        setHasChanges(false)
    }, [initialData])

    const handleColumnToggle = (columnKey: string, checked: boolean) => {
        const newVisibleColumns = checked
            ? [...visibleColumns, columnKey]
            : visibleColumns.filter(key => key !== columnKey)

        setVisibleColumns(newVisibleColumns)
        setHasChanges(true)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setVisibleColumns(initialData?.availableColumns.map(col => col.key) || [])
        } else {
            setVisibleColumns([])
        }
        setHasChanges(true)
    }

    const handleResetToDefault = () => {
        setVisibleColumns(initialData?.defaultColumns || [])
        setHasChanges(true)
    }

    const handleApply = () => {
        const isDefault = JSON.stringify(visibleColumns.sort()) === JSON.stringify((initialData?.defaultColumns || []).sort())
        onClose({
            visibleColumns,
            resetToDefault: isDefault
        })
    }

    const isAllSelected = visibleColumns.length === (initialData?.availableColumns.length || 0)
    const isDefault = JSON.stringify(visibleColumns.sort()) === JSON.stringify((initialData?.defaultColumns || []).sort())

    return (
        <div className="zd:min-w-[500px] zd:flex zd:flex-col zd:gap-4">
            <div className="zd:flex zd:items-center zd:justify-between">
                <span className="zd:text-sm zd:font-medium">{t("Column Settings")}</span>
                <div className="zd:flex zd:items-center zd:gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetToDefault}
                        className="zd:flex zd:items-center zd:gap-1"
                    >
                        <RotateCcw className="zd:h-3 zd:w-3" />
                        {t("Reset to Default")}
                    </Button>
                    <div className="zd:flex zd:items-center zd:space-x-2">
                        <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                        />
                        <span className="zd:text-sm">{t("Select All")}</span>
                    </div>
                </div>
            </div>

            <div className="zd:border zd:rounded-md zd:p-3 zd:max-h-96 zd:overflow-y-auto">
                <div className="zd:space-y-2">
                    {initialData?.availableColumns.map((column) => (
                        <div key={column.key} className="zd:flex zd:items-center zd:space-x-2">
                            <Checkbox
                                checked={visibleColumns.includes(column.key)}
                                onCheckedChange={(checked: boolean) => handleColumnToggle(column.key, checked)}
                            />
                            <span className="zd:text-sm">{t(column.label)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {!isDefault && (
                <div className="zd:flex zd:items-center zd:gap-2 zd:text-sm zd:text-amber-600 zd:bg-amber-50 zd:p-2 zd:rounded">
                    <div className="zd:w-2 zd:h-2 zd:bg-amber-500 zd:rounded-full"></div>
                    <span>{t("Reset to Default")}</span>
                </div>
            )}

            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-end">
                <Button
                    onClick={() => onClose()}
                    variant="outline"
                >
                    {t("Cancel")}
                </Button>
                <Button
                    onClick={handleApply}
                    variant="solid"
                    disabled={!hasChanges}
                >
                    {t("Apply")}
                </Button>
            </div>
        </div>
    )
}
