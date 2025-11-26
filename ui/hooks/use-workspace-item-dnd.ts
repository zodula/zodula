import { useState, useCallback, useMemo } from 'react'
import type { WorkspaceItem } from '../components/workspace/use-workspace'

interface WorkspaceItemDragItem {
  id: string
  data: WorkspaceItem
}

interface DropZone {
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  className: string
  style?: React.CSSProperties
}

interface DropIndicator {
  className: string
  style?: React.CSSProperties
}

interface UseWorkspaceItemDndProps {
  items: WorkspaceItem[]
  onReorder: (fromId: string, toId: string, type: 'before' | 'after') => void
  disabled?: boolean
  maxDepth?: number
}

export const useWorkspaceItemDnd = ({
  items,
  onReorder,
  disabled = false,
  maxDepth = -1
}: UseWorkspaceItemDndProps) => {
  const [draggedItem, setDraggedItem] = useState<WorkspaceItemDragItem | null>(null)
  const [dragOverItem, setDragOverItem] = useState<WorkspaceItem | null>(null)
  const [dragOverType, setDragOverType] = useState<'before' | 'after' | null>(null)

  // Reset drag state
  const resetDragState = useCallback(() => {
    setDraggedItem(null)
    setDragOverItem(null)
    setDragOverType(null)
  }, [])

  // Get drop type based on mouse position
  const getDropType = useCallback((e: React.DragEvent, item: WorkspaceItem): 'before' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    
    // Define zones: top 50% = before, bottom 50% = after
    return y < height * 0.5 ? 'before' : 'after'
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, item: WorkspaceItem) => {
    if (disabled) return
    
    setDraggedItem({ id: item.id, data: item })
    e.dataTransfer.effectAllowed = 'move'
  }, [disabled])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    resetDragState()
  }, [resetDragState])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, item: WorkspaceItem) => {
    e.preventDefault()
    
    if (disabled || !draggedItem || draggedItem.id === item.id) return

    const dropType = getDropType(e, item)
    const isInvalidDrop = false // For workspace items, we don't have depth/circular reference issues

    if (!isInvalidDrop) {
      setDragOverItem(item)
      setDragOverType(dropType)
    }
  }, [draggedItem, getDropType, disabled])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetItem: WorkspaceItem) => {
    e.preventDefault()
    
    if (disabled || !draggedItem || draggedItem.id === targetItem.id) return

    const dropType = getDropType(e, targetItem)
    const isValidDrop = true // For workspace items, we don't have complex validation

    if (!isValidDrop) {
      resetDragState()
      return
    }

    onReorder(draggedItem.id, targetItem.id, dropType)
    resetDragState()
  }, [draggedItem, getDropType, onReorder, disabled, resetDragState])

  // Get drop zone props for an item
  const getDropZoneProps = useCallback((item: WorkspaceItem): DropZone => {
    const isDragOver = dragOverItem?.id === item.id
    const isDraggedItem = draggedItem?.id === item.id
    const isInvalidDrop = false // For workspace items, we don't have complex validation

    return {
      onDragOver: (e: React.DragEvent) => handleDragOver(e, item),
      onDrop: (e: React.DragEvent) => handleDrop(e, item),
      className: `zd:relative ${
        isDragOver ? (isInvalidDrop ? 'zd:ring-2 zd:ring-red-500 zd:ring-opacity-50' : '') : ''
      } ${isDraggedItem ? 'zd:opacity-50' : ''}`,
      style: {
        cursor: isDragOver && isInvalidDrop ? 'not-allowed' : 'default'
      }
    }
  }, [dragOverItem, draggedItem, handleDragOver, handleDrop])

  // Get drag props for an item
  const getDragProps = useCallback((item: WorkspaceItem) => {
    return {
      draggable: !disabled,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, item),
      onDragEnd: handleDragEnd,
      className: disabled ? 'zd:cursor-default' : 'zd:cursor-grab active:zd:cursor-grabbing'
    }
  }, [disabled, handleDragStart, handleDragEnd])

  // Get drop indicator props
  const getDropIndicatorProps = useCallback((item: WorkspaceItem, type: 'before' | 'after') => {
    const isActive = dragOverItem?.id === item.id && dragOverType === type

    return {
      className: `zd:absolute zd:left-0 zd:right-0 zd:h-0.5 zd:bg-blue-500 zd:z-10 ${
        isActive ? 'zd:opacity-100' : 'zd:opacity-0'
      } ${type === 'before' ? 'zd:top-0' : 'zd:bottom-0'}`,
      style: { pointerEvents: 'none' as const }
    }
  }, [dragOverItem, dragOverType])

  return {
    draggedItem,
    isDragging: !!draggedItem,
    getDropZoneProps,
    getDragProps,
    getDropIndicatorProps,
    resetDragState
  }
}
