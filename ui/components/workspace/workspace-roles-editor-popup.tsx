import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/zodula/ui/components/ui/button"
import { FormControl } from "@/zodula/ui/components/ui/form-control"

type WorkspaceRoleRow = { id?: string; role?: string | null }

interface WorkspaceRolesEditorPopupProps {
  isOpen: boolean
  onClose: (result?: WorkspaceRoleRow[] | null) => void
  initialData?: {
    workspaceName?: string
    roles?: WorkspaceRoleRow[]
  }
}

export function WorkspaceRolesEditorPopup({
  isOpen: _isOpen,
  onClose,
  initialData,
}: WorkspaceRolesEditorPopupProps) {
  const [roles, setRoles] = useState<WorkspaceRoleRow[]>(() => initialData?.roles || [])

  const title = useMemo(
    () => initialData?.workspaceName || "Workspace",
    [initialData?.workspaceName]
  )

  const addRole = () => {
    setRoles((prev) => [...prev, { id: `temp_role_${Date.now()}`, role: null }])
  }

  const updateRole = (index: number, roleValue: string | null) => {
    setRoles((prev) => {
      const next = [...prev]
      next[index] = { ...(next[index] || {}), role: roleValue || null }
      return next
    })
  }

  const removeRole = (index: number) => {
    setRoles((prev) => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }

  return (
    <div className="zd:flex zd:flex-col zd:gap-4">
      <p className="zd:text-sm zd:text-muted-foreground">
        Edit roles for <span className="zd:font-medium">{title}</span>.
      </p>

      <div className="zd:flex zd:flex-col zd:gap-2">
        {roles.map((roleRow, index) => (
          <div key={`${title}-role-${index}`} className="zd:flex zd:items-center zd:gap-2">
            <div className="zd:flex-1">
              <FormControl
                hideFormControl
                fieldKey={`workspace-role-${index}`}
                value={roleRow?.role || ""}
                onChange={(_key, value) => updateRole(index, value || null)}
                field={{
                  type: "Reference",
                  reference: "Role",
                  label: "Role",
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="zd:h-8 zd:w-8 zd:p-0!"
              onClick={() => removeRole(index)}
              title="Remove role"
            >
              <X className="zd:w-4 zd:h-4" />
            </Button>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="zd:text-sm zd:text-muted-foreground">No roles assigned.</div>
        )}
      </div>

      <div className="zd:flex zd:justify-between">
        <Button variant="outline" size="sm" onClick={addRole}>
          <Plus className="zd:w-4 zd:h-4 zd:mr-1" />
          Add Role
        </Button>
        <div className="zd:flex zd:gap-2">
          <Button variant="outline" onClick={() => onClose(null)}>
            Cancel
          </Button>
          <Button onClick={() => onClose(roles.filter((r) => r.role))}>Apply</Button>
        </div>
      </div>
    </div>
  )
}
