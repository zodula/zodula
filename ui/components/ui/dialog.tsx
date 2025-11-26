import * as React from "react"
import { cn } from "../../lib/utils"

// Main Dialog component
interface DialogProps {
  open?: boolean
  onClose?: () => void
  children: React.ReactNode
  className?: string
}

function Dialog({ open = false, onClose, children, className = "" }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={cn("zd:fixed zd:inset-0 zd:z-50", className)}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

// DialogContent component
interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

function DialogContent({ children, className = "" }: DialogContentProps) {
  return (
    <div className={cn(
      "relative bg-background rounded shadow-lg border border-border",
      className
    )}>
      {children}
    </div>
  )
}

// DialogTitle component
interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

function DialogTitle({ children, className = "" }: DialogTitleProps) {
  return (
    <h2 className={cn(
      "zd:text-lg zd:font-semibold zd:text-foreground",
      className
    )}>
      {children}
    </h2>
  )
}

// DialogDescription component
interface DialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

function DialogDescription({ children, className = "" }: DialogDescriptionProps) {
  return (
    <p className={cn(
      "zd:text-sm zd:text-muted-foreground",
      className
    )}>
      {children}
    </p>
  )
}

// Dialog.Panel component (alias for DialogContent)
Dialog.Panel = DialogContent

// Dialog.Title component (alias for DialogTitle)
Dialog.Title = DialogTitle

// Dialog.Description component (alias for DialogDescription)
Dialog.Description = DialogDescription

export { Dialog, DialogContent, DialogDescription, DialogTitle }

