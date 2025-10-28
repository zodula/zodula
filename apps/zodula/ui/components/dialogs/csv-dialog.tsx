import { useEffect, useState } from "react"
import { useDocList } from "../../hooks/use-doc-list"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"

interface CSVDialogProps {
    isOpen: boolean
    onClose: (result?: { fields: string[] }) => void
    initialData?: { doctype: string, selected: string[] }
}

export const CSVDialog = ({ isOpen, onClose, initialData }: CSVDialogProps) => {
    const { docs: fields } = useDocList({
        doctype: "zodula__Field",
        limit: 1000000,
        sort: "idx",
        order: "asc",
        q: "",
        filters: [
            ["doctype", "=", initialData?.doctype as Zodula.DoctypeName]
        ]
    })

    const [selectedFields, setSelectedFields] = useState<string[]>(initialData?.selected || [])
    useEffect(() => {
        setSelectedFields(fields.map((field) => field.label || field.name || ""))
    }, [fields])
    return (
        <div className="zd:min-w-[500px] zd:flex zd:flex-col zd:gap-2">
            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-between zd:mt-2">
                <span>Select fields to export</span>
                <div className="zd:flex zd:items-center zd:space-x-2">
                    <Checkbox checked={selectedFields.length === fields.length} onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedFields(fields.map((field) => field.label || field.name || ""))
                        } else {
                            setSelectedFields([])
                        }
                    }} />
                    <span>Select All</span>
                </div>
            </div>
            <div className="zd:grid zd:grid-cols-2 zd:gap-2 zd:border zd:rounded zd:p-2 ">
                {fields.map((field) => (
                    <div key={field.id} className="zd:flex zd:items-center zd:space-x-2">
                        <Checkbox checked={selectedFields.includes(field.label || field.name || "")} onCheckedChange={(checked) => {
                            if (checked) {
                                setSelectedFields([...selectedFields, field.label || field.name || ""])
                            } else {
                                setSelectedFields(selectedFields.filter((id) => id !== field.label || field.name || ""))
                            }
                        }} />
                        <span>{field.label || field.name || ""}</span>
                    </div>
                ))}
            </div>
            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-end">
                <Button onClick={() => onClose()} variant="subtle">Close</Button>
                <Button onClick={() => onClose({ fields: selectedFields })} variant="solid">Export</Button>
            </div>
        </div>
    )
}