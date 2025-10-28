import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog"

// Types for the dialog functions
type AlertOptions = {
  title?: string
  message: string
  confirmText?: string
  variant?: "default" | "destructive" | "warning"
}

type PromptOptions = {
  title?: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  required?: boolean
  validator?: (value: string) => string | null // returns error message or null
}

type ConfirmOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive" | "warning"
}

// Dialog item types
export interface DialogItem {
  id: string
  type: "alert" | "prompt" | "confirm" | "custom"
  isOpen: boolean
  data: any
  resolve: (value: any) => void
  createdAt: number
}

// Global state
let dialogs: DialogItem[] = []
let listeners: (() => void)[] = []

// Utility functions
const notifyListeners = () => {
  listeners.forEach(listener => listener())
}

const addDialog = (dialog: Omit<DialogItem, "id" | "createdAt">) => {
  const id = Math.random().toString(36).substr(2, 9)
  const newDialog: DialogItem = {
    ...dialog,
    id,
    createdAt: Date.now(),
  }

  dialogs = [...dialogs, newDialog]
  notifyListeners()

  return id
}

const removeDialog = (id: string) => {
  dialogs = dialogs.filter(dialog => dialog.id !== id)
  notifyListeners()
}

// Dialog component for alerts
function AlertDialog({
  dialog,
  onClose
}: {
  dialog: DialogItem
  onClose: () => void
}) {
  const { title = "Alert", message, confirmText = "OK", variant = "default" } = dialog.data

  return (
    <Dialog open={dialog.isOpen} onClose={onClose} className="relative z-50">
      <div className="zd:fixed zd:inset-0 zd:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" aria-hidden="true" />
      <div className="zd:fixed zd:inset-0 zd:flex zd:items-center zd:justify-center zd:p-4">
        <DialogContent className="zd:mx-auto zd:max-w-sm zd:rounded zd:bg-background zd:p-6 zd:shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="zd:flex zd:items-start zd:gap-4">
            <div className="zd:flex-1">
              <DialogTitle className="zd:text-lg zd:font-semibold zd:text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="zd:mt-2 zd:text-sm zd:text-muted-foreground">
                {message}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="zd:h-6 zd:w-6 zd:p-0"
            >
              <X className="zd:h-4 zd:w-4" />
            </Button>
          </div>
          <div className="zd:mt-6 zd:flex zd:justify-end">
            <Button
              variant={variant === "destructive" ? "solid" : "outline"}
              onClick={onClose}
              className={cn(
                variant === "destructive" ? "zd:bg-destructive zd:text-primary-foreground zd:hover:bg-destructive/90" : "zd:bg-background zd:text-foreground zd:hover:bg-accent zd:hover:text-accent-foreground zd:hover:border-accent zd:active:bg-accent/80"
              )}
            >
              {confirmText}
            </Button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  )
}

// Dialog component for prompts
function PromptDialog({
  dialog,
  onClose,
  onConfirm
}: {
  dialog: DialogItem
  onClose: () => void
  onConfirm: (value: string) => void
}) {
  const {
    title = "Prompt",
    message,
    placeholder = "Enter value...",
    defaultValue = "",
    confirmText = "OK",
    cancelText = "Cancel",
    required = false,
    validator
  } = dialog.data

  const [value, setValue] = React.useState(defaultValue)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (dialog.isOpen) {
      setValue(defaultValue)
      setError(null)
    }
  }, [dialog.isOpen, defaultValue])

  const handleConfirm = () => {
    if (required && !value.trim()) {
      setError("This field is required")
      return
    }

    if (validator) {
      const validationError = validator(value)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    onConfirm(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm()
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <Dialog open={dialog.isOpen} onClose={onClose} className="relative z-50">
      <div className="zd:fixed zd:inset-0 zd:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" aria-hidden="true" />
      <div className="zd:fixed zd:inset-0 zd:flex zd:items-center zd:justify-center zd:p-4">
        <Dialog.Panel className="zd:mx-auto zd:max-w-sm zd:rounded zd:bg-background zd:p-6 zd:shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="zd:flex zd:items-start zd:gap-4">
            <div className="zd:flex-1">
              <Dialog.Title className="zd:text-lg zd:font-semibold zd:text-foreground">
                {title}
              </Dialog.Title>
              {message && (
                <Dialog.Description className="zd:mt-2 zd:text-sm zd:text-muted-foreground">
                  {message}
                </Dialog.Description>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="zd:h-6 zd:w-6 zd:p-0"
            >
              <X className="zd:h-4 zd:w-4" />
            </Button>
          </div>
          <div className="zd:mt-4">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(error ? "zd:border-destructive" : "")}
              autoFocus
            />
            {error && (
              <p className="zd:mt-1 zd:text-destructive">{error}</p>
            )}
          </div>
          <div className="zd:mt-6 zd:flex zd:justify-end zd:gap-2">
            <Button variant="outline" onClick={onClose}>
              {cancelText}
            </Button>
            <Button onClick={handleConfirm}>
              {confirmText}
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

// Dialog component for confirmations
function ConfirmDialog({
  dialog,
  onClose,
  onConfirm
}: {
  dialog: DialogItem
  onClose: () => void
  onConfirm: () => void
}) {
  const {
    title = "Confirm",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default"
  } = dialog.data

  return (
    <Dialog open={dialog.isOpen} onClose={onClose} className="zd:relative zd:z-50">
      <div className="zd:fixed zd:inset-0 zd:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" aria-hidden="true" />
      <div className="zd:fixed zd:inset-0 zd:flex zd:items-center zd:justify-center zd:p-4">
        <Dialog.Panel className="zd:mx-auto zd:max-w-sm zd:rounded zd:bg-background zd:p-6 zd:shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="zd:flex zd:items-start zd:gap-4">
            <div className="zd:flex-1">
              <Dialog.Title className="zd:text-lg zd:font-semibold zd:text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="zd:mt-2 zd:text-sm zd:text-muted-foreground zd:whitespace-pre-line">
                {message}
              </Dialog.Description>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="zd:h-6 zd:w-6 zd:p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="zd:mt-6 zd:flex zd:justify-end zd:gap-2">
            <Button variant="outline" onClick={onClose}>
              {cancelText}
            </Button>
            <Button
              variant={variant === "destructive" ? "solid" : "outline"}
              onClick={onConfirm}
              className={cn(
                variant === "destructive" ? "zd:bg-destructive zd:text-primary-foreground zd:hover:bg-destructive/90" : "zd:bg-background zd:text-foreground zd:hover:bg-accent zd:hover:text-accent-foreground zd:hover:border-accent zd:active:bg-accent/80"
              )}
            >
              {confirmText}
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

// Custom dialog component
function CustomDialog({
  dialog,
  onClose
}: {
  dialog: DialogItem
  onClose: (result?: any) => void
}) {
  const { Component, options, initialData } = dialog.data
  const showCloseButton = options?.showCloseButton ?? true

  return (
    <Dialog open={dialog.isOpen} onClose={() => onClose()}>
      <div className="zd:fixed zd:inset-0 zd:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" aria-hidden="true" />
      <div className="zd:fixed zd:inset-0 zd:flex zd:items-center zd:justify-center zd:p-4">
        <DialogContent className="zd:rounded zd:bg-background zd:shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 zd:max-w-4xl zd:max-h-[90vh] zd:w-fit zd:flex zd:flex-col">
          {(options?.title || options?.description) && (
            <div className="zd:flex-shrink-0 zd:p-6 zd:pb-4">
              {options?.title && (
                <div className="zd:flex zd:items-center zd:justify-between">
                  <DialogTitle className="zd:text-lg zd:font-semibold zd:text-foreground">
                    {options.title}
                  </DialogTitle>
                  {showCloseButton && (
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="zd:h-6 zd:w-6 zd:p-0"
                    >
                      <X className="zd:h-4 zd:w-4" />
                    </Button>
                  )}
                </div>
              )}
              {options?.description && (
                <DialogDescription className="zd:mt-2 zd:text-sm zd:text-muted-foreground">
                  {options.description}
                </DialogDescription>
              )}
            </div>
          )}
          <div className="zd:flex-1 zd:overflow-y-auto zd:px-6 zd:pb-6">
            <Component
              isOpen={dialog.isOpen}
              onClose={onClose}
              initialData={{
                ...initialData,
                showCloseButton: options?.showCloseButton ?? true
              }}
            />
          </div>
        </DialogContent>
      </div>
    </Dialog>
  )
}

// Dialog Portal Component
export const DialogPortal: React.FC<{ className?: string }> = ({ className }) => {
  const [mounted, setMounted] = React.useState(false)
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  React.useEffect(() => {
    setMounted(true)
    listeners.push(forceUpdate)
    return () => {
      listeners = listeners.filter(listener => listener !== forceUpdate)
    }
  }, [])

  if (!mounted) return null

  const portalContainer = document.body

  return createPortal(
    <div className={cn("zd:fixed zd:z-50", className || "")}>
      {dialogs.map((dialog) => {
        const handleClose = () => {
          dialog.resolve(null)
          removeDialog(dialog.id)
        }

        const handleConfirm = (value?: any) => {
          dialog.resolve(value)
          removeDialog(dialog.id)
        }

        switch (dialog.type) {
          case "alert":
            return (
              <AlertDialog
                key={dialog.id}
                dialog={dialog}
                onClose={handleClose}
              />
            )
          case "prompt":
            return (
              <PromptDialog
                key={dialog.id}
                dialog={dialog}
                onClose={handleClose}
                onConfirm={handleConfirm}
              />
            )
          case "confirm":
            return (
              <ConfirmDialog
                key={dialog.id}
                dialog={dialog}
                onClose={handleClose}
                onConfirm={handleConfirm}
              />
            )
          case "custom":
            return (
              <CustomDialog
                key={dialog.id}
                dialog={dialog}
                onClose={handleConfirm}
              />
            )
          default:
            return null
        }
      })}
    </div>,
    portalContainer
  )
}

// Alert function
export function alert(options: AlertOptions | string): Promise<void> {
  return new Promise((resolve) => {
    const config = typeof options === "string" ? { message: options } : options

    addDialog({
      type: "alert",
      isOpen: true,
      data: config,
      resolve
    })
  })
}

// Prompt function
export function prompt(options: PromptOptions | string): Promise<string | null> {
  return new Promise((resolve) => {
    const config = typeof options === "string" ? { message: options } : options

    addDialog({
      type: "prompt",
      isOpen: true,
      data: config,
      resolve
    })
  })
}

// Confirm function
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  return new Promise((resolve) => {
    const config = typeof options === "string" ? { message: options } : options

    addDialog({
      type: "confirm",
      isOpen: true,
      data: config,
      resolve
    })
  })
}

// Custom dialog function for React components
function popup<T = any, I = any>(
  Component: React.ComponentType<{
    isOpen: boolean
    onClose: (result?: T) => void
    initialData?: I
  }>,
  options?: {
    title?: string
    description?: string
    showCloseButton?: boolean
  },
  initialData?: I
): Promise<T | null> {
  return new Promise((resolve) => {
    addDialog({
      type: "custom",
      isOpen: true,
      data: { Component, options, initialData },
      resolve
    })
  })
}

// Export the dialog components for direct use if needed
export { AlertDialog, PromptDialog, ConfirmDialog, CustomDialog, popup }