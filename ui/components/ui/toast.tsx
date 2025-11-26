import * as React from "react"
import { createPortal } from "react-dom"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/zodula/ui/lib/utils"

// Toast component variants
const toastVariants = cva(
  "zd:group zd:pointer-events-auto zd:relative zd:flex zd:w-[90vw] zd:max-w-sm zd:items-center zd:justify-between zd:space-x-4 zd:overflow-hidden zd:rounded-xl zd:border zd:p-4 zd:transition-all zd:data-[state=open]:animate-in zd:data-[state=closed]:animate-out zd:data-[state=closed]:fade-out-80 zd:data-[state=closed]:slide-out-to-right-full zd:data-[state=open]:slide-in-from-top-full zd:data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "zd:border-gray-200 zd:bg-white zd:text-gray-900",
        destructive:
          "zd:border-red-200 zd:bg-red-50 zd:text-red-800",
        success:
          "zd:border-green-200 zd:bg-green-50 zd:text-green-800",
        warning:
          "zd:border-yellow-200 zd:bg-yellow-50 zd:text-yellow-800",
        info:
          "zd:border-blue-200 zd:bg-blue-50 zd:text-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Toast component with drag functionality
interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  onSwipeStart?: () => void
  onSwipeMove?: (deltaX: number) => void
  onSwipeEnd?: (deltaX: number) => void
  onDismiss?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, onSwipeStart, onSwipeMove, onSwipeEnd, onDismiss, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const [startX, setStartX] = React.useState(0)
    const [currentX, setCurrentX] = React.useState(0)
    const [swipeDirection, setSwipeDirection] = React.useState<'left' | 'right' | null>(null)

    const handleStart = (clientX: number) => {
      setIsDragging(true)
      setStartX(clientX)
      setCurrentX(clientX)
      onSwipeStart?.()
    }

    const handleMove = (clientX: number) => {
      if (!isDragging) return
      
      const deltaX = clientX - startX
      setCurrentX(clientX)
      
      if (Math.abs(deltaX) > 10) {
        setSwipeDirection(deltaX > 0 ? 'right' : 'left')
      }
      
      onSwipeMove?.(deltaX)
    }

    const handleEnd = () => {
      if (!isDragging) return
      
      const deltaX = currentX - startX
      const threshold = config.swipeThreshold ?? 50
      
      if (Math.abs(deltaX) > threshold) {
        onDismiss?.()
      } else {
        // Reset position
        setCurrentX(startX)
        setSwipeDirection(null)
      }
      
      setIsDragging(false)
      onSwipeEnd?.(deltaX)
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      handleStart(e.clientX)
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX)
    }

    const handleMouseUp = () => {
      handleEnd()
    }

    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches[0]) {
        handleStart(e.touches[0].clientX)
      }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      e.preventDefault()
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX)
      }
    }

    const handleTouchEnd = () => {
      handleEnd()
    }

    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
        }
      }
    }, [isDragging, startX, currentX])

    const deltaX = currentX - startX
    const shouldDismiss = Math.abs(deltaX) > (config.swipeThreshold ?? 50)

    return (
      <div
        ref={ref}
        className={cn(
          toastVariants({ variant }), 
          className ?? "",
          isDragging ? "zd:cursor-grabbing" : "zd:cursor-grab"
        )}
        style={{
          transform: isDragging ? `translateX(${deltaX}px)` : undefined,
          opacity: shouldDismiss ? Math.max(0.3, 1 - Math.abs(deltaX) / 200) : undefined,
          transition: isDragging ? 'none' : 'all 0.2s ease-out'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...props}
      />
    )
  }
)
Toast.displayName = "Toast"

// Internal components (not exported)
const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "zd:inline-flex zd:h-8 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-md zd:border zd:border-gray-300 zd:bg-white zd:px-3 zd:text-sm zd:font-medium zd:text-gray-700 zd:transition-colors zd:hover:bg-gray-50 zd:focus:outline-none zd:focus:ring-2 zd:focus:ring-gray-400 zd:focus:ring-offset-2 zd:disabled:pointer-events-none zd:disabled:opacity-50",
      className ?? ""
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "zd:absolute zd:right-2 zd:top-2 zd:flex zd:h-6 zd:w-6 zd:items-center zd:justify-center zd:rounded-full zd:bg-gray-100 zd:text-gray-500 zd:opacity-0 zd:transition-all zd:duration-200 zd:hover:bg-gray-200 zd:hover:text-gray-700 zd:hover:scale-110 zd:focus:opacity-100 zd:focus:outline-none zd:focus:ring-2 zd:focus:ring-gray-400 zd:focus:ring-offset-1 zd:group-hover:opacity-100 zd:active:scale-95",
      className ?? ""
    )}
    toast-close=""
    {...props}
  >
    <X className="zd:h-3 zd:w-3" />
  </button>
))
ToastClose.displayName = "ToastClose"

const ToastTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("zd:text-sm zd:font-semibold", className ?? "")}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("zd:text-sm zd:opacity-90", className ?? "")}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

const ToastIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("zd:flex zd:h-6 zd:w-6 zd:shrink-0 zd:items-center zd:justify-center", className ?? "")}
    {...props}
  />
))
ToastIcon.displayName = "ToastIcon"

// Types
export interface ToastConfig {
  duration?: number
  position?: "top-left" | "top-right" | "top-center" | "bottom-left" | "bottom-right" | "bottom-center"
  maxToasts?: number
  swipeDirection?: "left" | "right" | "up" | "down"
  swipeThreshold?: number
  swipeCancelThreshold?: number
  showCloseButton?: boolean
  showIcon?: boolean
  pauseOnHover?: boolean
  pauseOnFocusLoss?: boolean
  className?: string
}

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success" | "warning" | "info"
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
  createdAt: number
  className?: string
}

export interface ToastOptions {
  id?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
  className?: string
}

interface ToastAPI {
  (props: Omit<ToastItem, "id" | "createdAt">): string
  success: (title: string, description?: string, options?: ToastOptions) => string
  error: (title: string, description?: string, options?: ToastOptions) => string
  warn: (title: string, description?: string, options?: ToastOptions) => string
  warning: (title: string, description?: string, options?: ToastOptions) => string
  info: (title: string, description?: string, options?: ToastOptions) => string
  default: (title: string, description?: string, options?: ToastOptions) => string
}

// Global state
let toasts: ToastItem[] = []
let config: ToastConfig = {
  duration: 5000,
  position: "top-right",
  maxToasts: 5,
  swipeDirection: "right",
  swipeThreshold: 50,
  swipeCancelThreshold: 80,
  showCloseButton: true,
  showIcon: true,
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  className: "",
}

let listeners: (() => void)[] = []

// Utility functions
const getPositionClasses = (position: ToastConfig["position"]) => {
  switch (position) {
    case "top-left":
      return "zd:top-0 zd:left-0"
    case "top-right":
      return "zd:top-0 zd:right-0"
    case "top-center":
      return "zd:top-0 zd:left-1/2 zd:-translate-x-1/2"
    case "bottom-left":
      return "zd:bottom-0 zd:left-0"
    case "bottom-right":
      return "zd:bottom-0 zd:right-0"
    case "bottom-center":
      return "zd:bottom-0 zd:left-1/2 zd:-translate-x-1/2"
    default:
      return "zd:top-0 zd:right-0"
  }
}

const getIcon = (variant: ToastItem["variant"]) => {
  switch (variant) {
    case "success":
      return <CheckCircle className="zd:h-5 zd:w-5 zd:text-green-600" />
    case "destructive":
      return <AlertCircle className="zd:h-5 zd:w-5 zd:text-red-600" />
    case "warning":
      return <AlertTriangle className="zd:h-5 zd:w-5 zd:text-yellow-600" />
    case "info":
      return <Info className="zd:h-5 zd:w-5 zd:text-blue-600" />
    default:
      return null
  }
}

const notifyListeners = () => {
  listeners.forEach(listener => listener())
}

const addToast = (toastProps: Omit<ToastItem, "id" | "createdAt"> & { id?: string }) => {
  const providedId = toastProps.id
  const id = providedId || Math.random().toString(36).substr(2, 9)

  // Check if toast with this ID already exists
  const existingToastIndex = toasts.findIndex(toast => toast.id === id)

  const newToast: ToastItem = {
    ...toastProps,
    id,
    createdAt: Date.now(),
  }

  if (existingToastIndex !== -1) {
    // Update existing toast
    toasts[existingToastIndex] = newToast
  } else {
    // Add new toast
    toasts = [newToast, ...toasts].slice(0, config.maxToasts)
  }

  notifyListeners()

  // Auto dismiss
  if (newToast.duration !== 0) {
    const duration = newToast.duration ?? config.duration
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }

  return id
}

const dismiss = (id: string) => {
  toasts = toasts.filter(toast => toast.id !== id)
  notifyListeners()
}

const dismissAll = () => {
  toasts = []
  notifyListeners()
}

const updateConfig = (newConfig: Partial<ToastConfig>) => {
  config = { ...config, ...newConfig }
  notifyListeners()
}

// Toast Portal Component
export const ToastPortal: React.FC<{ className?: string }> = ({ className }) => {
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
    <div
      className={cn(
        "zd:fixed zd:z-[100] zd:flex zd:flex-col zd:gap-2 zd:p-4",
        getPositionClasses(config.position),
        config.className ?? "",
        className ?? ""
      )}
      style={{}}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          data-state="open"
          data-swipe="cancel"
          className={toast.className}
          onDismiss={() => {
            dismiss(toast.id)
            toast.onClose?.()
          }}
        >
          <div className="zd:flex zd:items-start zd:gap-3">
            {config.showIcon && toast.variant && (
              <ToastIcon>
                {getIcon(toast.variant)}
              </ToastIcon>
            )}
            <div className="zd:flex-1">
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
          </div>
          {toast.action && (
            <ToastAction onClick={toast.action.onClick}>
              {toast.action.label}
            </ToastAction>
          )}
          {config.showCloseButton && (
            <ToastClose 
              onClick={() => {
                dismiss(toast.id)
                toast.onClose?.()
              }}
            />
          )}
        </Toast>
      ))}
    </div>,
    portalContainer
  )
}

// Global toast API
export const toast: ToastAPI = ((props: Omit<ToastItem, "id" | "createdAt">) => {
  return addToast(props)
}) as ToastAPI

// Add methods to the global toast object
toast.success = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "success",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

toast.error = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "destructive",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

toast.warn = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "warning",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

toast.warning = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "warning",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

toast.info = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "info",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

toast.default = (title: string, description?: string, options?: ToastOptions) => {
  return addToast({
    title,
    description,
    variant: "default",
    className: options?.className,
    id: options?.id,
    duration: options?.duration,
    action: options?.action,
    onClose: options?.onClose
  })
}

// Global dismiss functions
export const dismissToast = (id: string) => {
  dismiss(id)
}

export const dismissAllToasts = () => {
  dismissAll()
}

// Configuration functions
export const configureToast = (newConfig: Partial<ToastConfig>) => {
  updateConfig(newConfig)
}

// Export only what's needed for the API
export { Toast }
