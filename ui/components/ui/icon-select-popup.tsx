import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "../../lib/utils"
import * as LucideIcons from "lucide-react"

export interface IconSelectPopupProps {
  selectedIcon: string
  onIconSelect: (iconName: string) => void
  onClose: () => void
  isOpen: boolean
  availableIcons?: string[]
  className?: string
}

// Default available icons
const DEFAULT_ICONS = [
  "Folder", "FolderOpen", "FileText", "File", "Database", "Settings", 
  "Home", "User", "Users", "Calendar", "Mail", "MessageSquare", "Star",
  "Heart", "Bookmark", "Tag", "Search", "Filter", "Grid", "List",
  "Plus", "Minus", "Edit", "Trash2", "Copy", "Move", "Download",
  "Upload", "Share", "Lock", "Unlock", "Eye", "EyeOff", "Bell",
  "BellOff", "Check", "X", "AlertCircle", "Info", "HelpCircle"
]

export const IconSelectPopup: React.FC<IconSelectPopupProps> = ({
  selectedIcon,
  onIconSelect,
  onClose,
  isOpen,
  availableIcons = DEFAULT_ICONS,
  className = ""
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calculate dropdown position
  const calculateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // Small gap
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 300) // Minimum width
      })
    }
  }

  // Handle icon selection
  const handleIconSelect = (iconName: string) => {
    onIconSelect(iconName)
    onClose()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    const totalIcons = availableIcons.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev < totalIcons - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : totalIcons - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < totalIcons) {
          handleIconSelect(availableIcons[focusedIndex] || "")
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target)
      
      if (isOutsideContainer && isOutsideDropdown) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Update dropdown position on scroll and resize
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition()
      
      const handleUpdatePosition = () => {
        calculateDropdownPosition()
      }

      window.addEventListener('scroll', handleUpdatePosition, true)
      window.addEventListener('resize', handleUpdatePosition)
      
      return () => {
        window.removeEventListener('scroll', handleUpdatePosition, true)
        window.removeEventListener('resize', handleUpdatePosition)
      }
    }
  }, [isOpen])

  // Scroll focused icon into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.children[focusedIndex] as HTMLElement
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedIndex])

  // Reset focus when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div ref={containerRef} className={cn("zd:relative", className)}>
      {createPortal(
        <div
          ref={dropdownRef}
          className={cn(
            "zd:fixed zd:z-50",
            "zd:bg-background zd:border zd:border-border zd:rounded-lg zd:shadow-lg",
            "zd:max-h-[300px] zd:overflow-y-auto",
            "zd:no-scrollbar"
          )}
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div className="zd:p-2">
            <div className="zd:grid zd:grid-cols-6 zd:gap-2">
              {availableIcons.map((iconName, index) => {
                const Icon = (LucideIcons as any)[iconName]
                const isSelected = selectedIcon === iconName

                return (
                  <button
                    key={iconName}
                    type="button"
                    className={cn(
                      "zd:flex zd:flex-col zd:items-center zd:justify-center zd:p-3 zd:rounded-full zd:w-10 zd:h-10",
                      "zd:transition-colors zd:cursor-pointer",
                      "zd:hover:bg-muted zd:focus:bg-muted zd:focus:outline-none",
                      isSelected ? "zd:bg-primary zd:text-primary-foreground" : "",
                      focusedIndex === index ? "zd:bg-muted" : ""
                    )}
                    onClick={() => handleIconSelect(iconName)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    tabIndex={-1}
                  >
                    {Icon && <Icon className="zd:w-5 zd:h-5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
