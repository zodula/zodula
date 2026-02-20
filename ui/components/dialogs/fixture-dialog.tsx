import { useEffect, useState, useMemo } from "react"
import { useDocList } from "../../hooks/use-doc-list"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { FormControl } from "../ui/form-control"
import { zodula } from "@/zodula/client"
import { Select } from "../ui/select"

interface FixtureDialogProps {
    isOpen: boolean
    onClose: (result: { app?: string, app_field?: string, fields: string[] }) => void
    initialData?: { doctype: string, selected: string[] }
}

export const FixtureDialog = ({ isOpen, onClose, initialData }: FixtureDialogProps) => {
    const { docs: fields } = useDocList({
        doctype: "Field",
        limit: -1,
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
    const [selectedAppField, setSelectedAppField] = useState<string>("")
    const [appError, setAppError] = useState<string>("")
    const [useAppField, setUseAppField] = useState<boolean>(false)
    const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false)
    
    // Find fields that reference App
    const appFields = useMemo(() => {
        return fields.filter(field => 
            field.type === "Reference" && 
            field.reference === "App"
        )
    }, [fields])
    
    // Default to first app field if available (only on initial mount, before user interaction)
    useEffect(() => {
        if (!hasUserInteracted && appFields.length > 0 && !selectedAppField && appFields[0]?.name) {
            setSelectedAppField(appFields[0].name)
            setUseAppField(true)
        }
    }, [appFields, selectedAppField, hasUserInteracted])
    
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
            {/* App Selection Method */}
            <div className="zd:flex zd:items-center zd:space-x-2 zd:mb-2">
                <Checkbox 
                    checked={useAppField} 
                    onCheckedChange={(checked) => {
                        setHasUserInteracted(true)
                        setUseAppField(checked as boolean)
                        if (checked) {
                            setSelectedApp("")
                            setAppError("")
                            // If checking and we have app fields but no selection, set the first one as default
                            if (appFields.length > 0 && !selectedAppField && appFields[0]?.name) {
                                setSelectedAppField(appFields[0].name)
                            }
                        } else {
                            setSelectedAppField("")
                            setAppError("")
                        }
                    }} 
                />
                <span>Use App Field (each document can have different app)</span>
            </div>
            
            {useAppField ? (
                // App Field Selection
                <div className="zd:space-y-2">
                    <label className="zd:text-sm zd:font-medium">Select App Field</label>
                    {appFields.length > 0 ? (
                        <Select
                            options={appFields.map(field => {
                                return {
                                    label: field.label || field.name || "",
                                    value: field.name || ""
                                }
                            })}
                            displayMode="label"
                            value={selectedAppField}
                            onChange={(value) => {
                                setSelectedAppField(value)
                                if (value) {
                                    setAppError("")
                                }
                            }}
                        />
                    ) : (
                        <div className="zd:text-sm zd:text-muted-foreground">
                            No fields found that reference App. Please use a fixed app instead.
                        </div>
                    )}
                </div>
            ) : (
                // Fixed App Selection
                <FormControl
                    docId=""
                    label="Select App"
                    field={{
                        type: "Reference",
                        reference: "App"
                    }}
                    value={selectedApp}
                    fieldKey="value"
                    onChange={(fieldKey, value) => {
                        setSelectedApp(value)
                        if (value) {
                            setAppError("")
                        }
                    }} 
                />
            )}
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
                <Button 
                    onClick={() => onClose({ 
                        app: useAppField ? undefined : selectedApp, 
                        app_field: useAppField ? selectedAppField : undefined,
                        fields: selectedFields 
                    })} 
                    variant="subtle"
                >
                    Close
                </Button>
                <Button 
                    onClick={() => {
                        if (useAppField) {
                            if (!selectedAppField) {
                                setAppError("Please select an app field")
                                return
                            }
                            onClose({ 
                                app_field: selectedAppField, 
                                fields: selectedFields 
                            })
                        } else {
                            if (!selectedApp) {
                                setAppError("Please select an app")
                                return
                            }
                            onClose({ 
                                app: selectedApp, 
                                fields: selectedFields 
                            })
                        }
                    }} 
                    variant="solid"
                    disabled={useAppField ? !selectedAppField : !selectedApp}
                >
                    Export
                </Button>
            </div>
        </div>
    )
}