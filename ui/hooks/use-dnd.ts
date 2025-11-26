import { useCallback, useRef, useState, useEffect } from 'react'
import type { WorkspaceItem } from '../components/workspace/use-workspace'

export interface DragItem {
  id: string
  type: string
  index: number
  data: WorkspaceItem
}

export interface DropZone {
  id: string
  index: number
  type: 'before' | 'after'
}

export interface UseDndOptions {
  items: WorkspaceItem[]
  onReorder: (fromId: string, toId: string, type: 'before' | 'after') => void
  onMove?: (fromId: string, toId: string, type: 'before' | 'after') => void
  disabled?: boolean
  dragHandleSelector?: string
  dropZoneClass?: string
  dragPreviewClass?: string
}

export interface UseDndReturn {
  // Drag handlers
  handleDragStart: (e: React.DragEvent, item: WorkspaceItem, index: number) => void
  handleDragEnd: (e: React.DragEvent) => void

  // Drop handlers
  handleDragOver: (e: React.DragEvent, index: number) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, targetItem: WorkspaceItem, targetIndex: number) => void

  // State
  draggedItem: DragItem | null
  dragOverIndex: number | null
  dragOverPosition: 'before' | 'after' | null
  isDragging: boolean

  // Utility functions
  getDropZoneProps: (index: number, item: WorkspaceItem) => {
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    className: string
    'data-drop-index': number
  }

  getDragProps: (item: WorkspaceItem, index: number) => {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: (e: React.DragEvent) => void
    className: string
    'data-drag-id': string
  }
}

export const useDnd = ({
  items,
  onReorder,
  onMove,
  disabled = false,
  dragHandleSelector = '[data-drag-handle]',
  dropZoneClass = 'zd:relative',
  dragPreviewClass = 'zd:opacity-50 zd:rotate-2 zd:scale-105'
}: UseDndOptions): UseDndReturn => {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Reset drag state
  const resetDragState = useCallback(() => {
    setDraggedItem(null)
    setDragOverIndex(null)
    setDragOverPosition(null)
    setIsDragging(false)
    dragCounterRef.current = 0
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, item: WorkspaceItem, index: number) => {
    if (disabled) return

    // Check if drag handle is being used
    const target = e.target as HTMLElement
    const dragHandle = target.closest(dragHandleSelector)

    // For now, allow dragging from any part of the element to debug
    // if (dragHandleSelector !== '[data-drag-handle]' && !dragHandle) return

    const dragItem: DragItem = {
      id: item.id,
      type: item.type || 'unknown',
      index,
      data: item
    }

    setDraggedItem(dragItem)
    setIsDragging(true)

    // Set drag data
    e.dataTransfer.setData('application/json', JSON.stringify(dragItem))
    e.dataTransfer.effectAllowed = 'move'

    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add(...dragPreviewClass.split(' '))
    }
  }, [disabled, dragHandleSelector, dragPreviewClass])

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove(...dragPreviewClass.split(' '))
    }

    resetDragState()
  }, [dragPreviewClass, resetDragState])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedItem && draggedItem.index !== index) {
      setDragOverIndex(index)

      // Determine drop position based on mouse position
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      const position: 'before' | 'after' = y < height / 2 ? 'before' : 'after'
      setDragOverPosition(position)
    }
  }, [draggedItem])

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only decrement if we're leaving the drop zone, not a child element
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setDragOverIndex(null)
      }
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetItem: WorkspaceItem, targetIndex: number) => {
    e.preventDefault()

    if (!draggedItem || draggedItem.id === targetItem.id) {
      resetDragState()
      return
    }

    // Determine drop position
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const type: 'before' | 'after' = y < height / 2 ? 'before' : 'after'


    // Call the appropriate handler
    if (onMove) {
      onMove(draggedItem.id, targetItem.id, type)
    } else {
      onReorder(draggedItem.id, targetItem.id, type)
    }

    resetDragState()
  }, [draggedItem, onReorder, onMove, resetDragState])

  // Get drop zone props for an item
  const getDropZoneProps = useCallback((index: number, item: WorkspaceItem) => {
    const isDragOver = dragOverIndex === index
    const isDraggedItem = draggedItem?.id === item.id
    const position = isDragOver ? dragOverPosition : null

    // Create position-specific visual feedback
    let positionClass = ''
    if (isDragOver && position) {
      if (position === 'before') {
        positionClass = 'zd:border-t-2 zd:border-blue-500'
      } else {
        positionClass = 'zd:border-b-2 zd:border-blue-500'
      }
    }

    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        dragCounterRef.current++
        handleDragOver(e, index)
      },
      onDragLeave: (e: React.DragEvent) => {
        handleDragLeave(e)
      },
      onDrop: (e: React.DragEvent) => {
        handleDrop(e, item, index)
      },
      className: `${dropZoneClass} ${positionClass} ${isDraggedItem ? 'zd:opacity-50' : ''}`,
      'data-drop-index': index
    }
  }, [dragOverIndex, dragOverPosition, draggedItem, dropZoneClass, handleDragOver, handleDragLeave, handleDrop])

  // Get drag props for an item
  const getDragProps = useCallback((item: WorkspaceItem, index: number) => {
    const isDraggedItem = draggedItem?.id === item.id

    return {
      draggable: !disabled && !isDraggedItem,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, item, index),
      onDragEnd: (e: React.DragEvent) => handleDragEnd(e),
      className: isDraggedItem ? 'zd:cursor-grabbing' : 'zd:cursor-grab',
      'data-drag-id': item.id
    }
  }, [disabled, draggedItem, handleDragStart, handleDragEnd])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetDragState()
    }
  }, [resetDragState])

  return {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    draggedItem,
    dragOverIndex,
    dragOverPosition,
    isDragging,
    getDropZoneProps,
    getDragProps
  }
}

// Utility hook for creating drag handles
export const useDragHandle = (onDragStart?: (e: React.DragEvent) => void) => {
  return {
    'data-drag-handle': true,
    onMouseDown: (e: React.MouseEvent) => {
      // Prevent text selection while dragging
      e.preventDefault()
    },
    onDragStart: onDragStart || (() => { }),
    className: 'zd:cursor-grab zd:active:cursor-grabbing'
  }
}

// Utility hook for creating drop indicators
export const useDropIndicator = (isActive: boolean, position: 'before' | 'after' = 'after') => {
  return {
    className: `zd:absolute zd:left-0 zd:right-0 zd:h-1 zd:bg-blue-500 zd:rounded-full zd:transition-all zd:duration-200 ${isActive ? 'zd:opacity-100 zd:scale-y-100' : 'zd:opacity-0 zd:scale-y-0'
      } ${position === 'before' ? 'zd:-top-0.5' : 'zd:-bottom-0.5'}`,
    'data-drop-indicator': true
  }
}
