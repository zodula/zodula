import { useEffect, useState } from "react"
import { useDocList } from "../../hooks/use-doc-list"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { FormControl } from "../ui/form-control"
import { zodula } from "@/zodula/client"

interface FixtureDialogProps {
    isOpen: boolean
    onClose: (result: { app: string, fields: string[] }) => void
    initialData?: { doctype: string, selected: string[] }
}

export const FixtureDialog = ({ isOpen, onClose, initialData }: FixtureDialogProps) => {
    const { docs: fields } = useDocList({
        doctype: "zodula__Field",
        limit: 1000000,
        sort: "idx",
        order: "asc",
        q: "",
        filters: [
            ["doctype", "=", initialData?.doctype as Zodula.DoctypeName],
            ["type", "NOT IN", ["Reference Table", "Extend"]]
        ]
    })

    const [selectedFields, setSelectedFields] = useState<string[]>(initialData?.selected || [])
    const [selectedApp, setSelectedApp] = useState<string>("")
    const [appError, setAppError] = useState<string>("")
    
    // Separate standard fields from user-defined fields
    const standardFields = fields.filter(field => zodula.utils.isStandardField(field.name || ""))
    const userDefinedFields = fields.filter(field => !zodula.utils.isStandardField(field.name || ""))
    
    useEffect(() => {
        // Always include id field and all user-defined fields by default
        const defaultFields = [
            "id", // Always include id
            ...userDefinedFields.map(field => field.name || "")
        ]
        setSelectedFields(defaultFields)
    }, [fields])

    return (
        <div className="zd:min-w-[500px] zd:flex zd:flex-col zd:gap-2">
            <FormControl
                docId=""
                label="Select App"
                field={{
                    type: "Reference",
                    reference: "zodula__App"
                }}
                value={selectedApp}
                fieldKey="value"
                onChange={(fieldKey, value) => {
                    setSelectedApp(value)
                    if (value) {
                        setAppError("")
                    }
                }} />
            {appError && (
                <div className="zd:text-red-500 zd:text-sm zd:mt-1">
                    {appError}
                </div>
            )}
            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-between zd:mt-2">
                <span>Select fields to export</span>
                <div className="zd:flex zd:items-center zd:space-x-2">
                    <Checkbox checked={userDefinedFields.every(field => selectedFields.includes(field.name || ""))} onCheckedChange={(checked) => {
                        if (checked) {
                            setSelectedFields([
                                "id", // Always keep id
                                ...userDefinedFields.map((field) => field.name || "")
                            ])
                        } else {
                            setSelectedFields(["id"]) // Always keep id
                        }
                    }} />
                    <span>Select All User Fields</span>
                </div>
            </div>
            
            {/* User Defined Fields Section */}
            <div className="zd:border zd:rounded zd:p-2">
                <h4 className="zd:font-semibold zd:mb-2">User Defined Fields</h4>
                <div className="zd:grid zd:grid-cols-2 zd:gap-2">
                    {userDefinedFields.map((field) => (
                        <div key={field.id} className="zd:flex zd:items-center zd:space-x-2">
                            <Checkbox checked={selectedFields.includes(field.name || "")} onCheckedChange={(checked) => {
                                if (checked) {
                                    setSelectedFields([...selectedFields, field.name || ""])
                                } else {
                                    setSelectedFields(selectedFields.filter((id) => id !== field.name))
                                }
                            }} />
                            <span>{field.label || field.name || ""}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Standard Fields Section */}
            <div className="zd:border zd:rounded zd:p-2">
                <h4 className="zd:font-semibold zd:mb-2">Standard Fields</h4>
                <div className="zd:grid zd:grid-cols-2 zd:gap-2">
                    {standardFields.map((field) => (
                        <div key={field.id} className="zd:flex zd:items-center zd:space-x-2">
                            <Checkbox 
                                checked={field.name === "id" ? true : selectedFields.includes(field.name || "")} 
                                disabled={field.name === "id"}
                                onCheckedChange={(checked) => {
                                    if (field.name === "id") return; // id cannot be deselected
                                    if (checked) {
                                        setSelectedFields([...selectedFields, field.name || ""])
                                    } else {
                                        setSelectedFields(selectedFields.filter((id) => id !== field.name))
                                    }
                                }} 
                            />
                            <span className={field.name === "id" ? "zd:font-semibold" : ""}>{field.label || field.name || ""}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-end">
                <Button onClick={() => onClose({ app: selectedApp, fields: selectedFields })} variant="subtle">Close</Button>
                <Button 
                    onClick={() => {
                        if (!selectedApp) {
                            setAppError("Please select an app")
                            return
                        }
                        // Export only the selected fields (id is always included)
                        onClose({ app: selectedApp, fields: selectedFields })
                    }} 
                    variant="solid"
                    disabled={!selectedApp}
                >
                    Export
                </Button>
            </div>
        </div>
    )
}