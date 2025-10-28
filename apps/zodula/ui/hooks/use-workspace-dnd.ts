import { useCallback, useRef, useState, useEffect } from 'react'
import type { WorkspaceWithChildren } from '../components/workspace/use-workspace'

export interface WorkspaceDragItem {
  id: string
  type: 'workspace'
  data: WorkspaceWithChildren
  level: number
}

export interface WorkspaceDropZone {
  id: string
  type: 'before' | 'after' | 'inside'
  level: number
  parentId?: string
}

export interface UseWorkspaceDndOptions {
  workspaces: Array<{workspace: WorkspaceWithChildren, level: number}>
  onReorder: (fromId: string, toId: string, type: 'before' | 'after' | 'inside') => void
  disabled?: boolean
  maxDepth?: number
}

export interface UseWorkspaceDndReturn {
  // Drag handlers
  handleDragStart: (e: React.DragEvent, workspace: WorkspaceWithChildren, level: number) => void
  handleDragEnd: (e: React.DragEvent) => void
  
  // Drop handlers
  handleDragOver: (e: React.DragEvent, workspace: WorkspaceWithChildren, level: number) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, targetWorkspace: WorkspaceWithChildren, level: number) => void
  
  // State
  draggedItem: WorkspaceDragItem | null
  dragOverWorkspace: WorkspaceWithChildren | null
  dragOverType: 'before' | 'after' | 'inside' | null
  isDragging: boolean
  
  // Utility functions
  getDropZoneProps: (workspace: WorkspaceWithChildren, level: number) => {
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    className: string
  }
  
  getDragProps: (workspace: WorkspaceWithChildren, level: number) => {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: (e: React.DragEvent) => void
    className: string
  }
  
  getDropIndicatorProps: (workspace: WorkspaceWithChildren, type: 'before' | 'after' | 'inside') => {
    className: string
    style: React.CSSProperties
  }
}

export const useWorkspaceDnd = ({
  workspaces,
  onReorder,
  disabled = false,
  maxDepth = 5
}: UseWorkspaceDndOptions): UseWorkspaceDndReturn => {
  const [draggedItem, setDraggedItem] = useState<WorkspaceDragItem | null>(null)
  const [dragOverWorkspace, setDragOverWorkspace] = useState<WorkspaceWithChildren | null>(null)
  const [dragOverType, setDragOverType] = useState<'before' | 'after' | 'inside' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Reset drag state
  const resetDragState = useCallback(() => {
    setDraggedItem(null)
    setDragOverWorkspace(null)
    setDragOverType(null)
    setIsDragging(false)
    dragCounterRef.current = 0
  }, [])

  // Check if target is a child of the dragged workspace (prevent circular reference)
  const isTargetChildOfDragged = useCallback((draggedWorkspace: WorkspaceWithChildren, targetId: string): boolean => {
    const checkChildren = (workspace: WorkspaceWithChildren): boolean => {
      if (workspace.id === targetId) return true
      return workspace.children.some(child => checkChildren(child))
    }
    return checkChildren(draggedWorkspace)
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, workspace: WorkspaceWithChildren, level: number) => {
    if (disabled) return

    const dragItem: WorkspaceDragItem = {
      id: workspace.id,
      type: 'workspace',
      data: workspace,
      level
    }

    setDraggedItem(dragItem)
    setIsDragging(true)

    // Set drag data
    e.dataTransfer.setData('application/json', JSON.stringify(dragItem))
    e.dataTransfer.effectAllowed = 'move'

    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add('zd:opacity-50', 'zd:rotate-1', 'zd:scale-105')
    }
  }, [disabled])

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove('zd:opacity-50', 'zd:rotate-1', 'zd:scale-105')
    }

    resetDragState()
  }, [resetDragState])

  // Determine drop type based on mouse position
  const getDropType = useCallback((e: React.DragEvent, workspace: WorkspaceWithChildren): 'before' | 'after' | 'inside' => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    
    // Define zones: top 25% = before, middle 50% = inside, bottom 25% = after
    return y < height * 0.25 ? 'before' : y > height * 0.75 ? 'after' : 'inside'
  }, [])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, workspace: WorkspaceWithChildren, level: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    if (draggedItem && draggedItem.id !== workspace.id) {
      const dropType = getDropType(e, workspace)
      
      // Check if drop is valid
      let isValidDrop = true
      
      if (dropType === 'inside') {
        // For inside drops, check depth and circular reference
        const isCircularReference = isTargetChildOfDragged(draggedItem.data, workspace.id)
        const isWithinDepth = maxDepth === -1 || level < maxDepth
        
        isValidDrop = !isCircularReference && isWithinDepth
      }

      if (isValidDrop) {
        setDragOverWorkspace(workspace)
        setDragOverType(dropType)
      }
    }
  }, [draggedItem, getDropType, maxDepth])

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only decrement if we're leaving the drop zone, not a child element
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setDragOverWorkspace(null)
        setDragOverType(null)
      }
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetWorkspace: WorkspaceWithChildren, level: number) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetWorkspace.id) {
      resetDragState()
      return
    }

    const dropType = getDropType(e, targetWorkspace)
    
    // Validate drop
    let isValidDrop = true
    
    if (dropType === 'inside') {
      // For inside drops, check depth and circular reference
      const isCircularReference = isTargetChildOfDragged(draggedItem.data, targetWorkspace.id)
      const isWithinDepth = maxDepth === -1 || level < maxDepth
      
      isValidDrop = !isCircularReference && isWithinDepth
    }

    if (!isValidDrop) {
      resetDragState()
      return
    }

    onReorder(draggedItem.id, targetWorkspace.id, dropType)
    resetDragState()
  }, [draggedItem, getDropType, maxDepth, onReorder, resetDragState])

  // Get drop zone props for a workspace
  const getDropZoneProps = useCallback((workspace: WorkspaceWithChildren, level: number) => {
    const isDragOver = dragOverWorkspace?.id === workspace.id
    const isDraggedItem = draggedItem?.id === workspace.id
    
    // Check if this would be an invalid drop
    const isInvalidDrop = draggedItem && dragOverType === 'inside' && isTargetChildOfDragged(draggedItem.data, workspace.id)

    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        dragCounterRef.current++
        handleDragOver(e, workspace, level)
      },
      onDragLeave: (e: React.DragEvent) => {
        handleDragLeave(e)
      },
      onDrop: (e: React.DragEvent) => {
        handleDrop(e, workspace, level)
      },
      className: `zd:relative ${
        isDragOver ? (isInvalidDrop ? 'zd:ring-2 zd:ring-red-500 zd:ring-opacity-50' : '') : ''
      } ${isDraggedItem ? 'zd:opacity-50' : ''}`,
      style: {
        cursor: isDragOver && isInvalidDrop ? 'not-allowed' : 'default'
      }
    }
  }, [dragOverWorkspace, draggedItem, dragOverType, isTargetChildOfDragged, handleDragOver, handleDragLeave, handleDrop])

  // Get drag props for a workspace
  const getDragProps = useCallback((workspace: WorkspaceWithChildren, level: number) => {
    const isDraggedItem = draggedItem?.id === workspace.id

    return {
      draggable: !disabled && !isDraggedItem,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, workspace, level),
      onDragEnd: (e: React.DragEvent) => handleDragEnd(e),
      className: isDraggedItem ? 'zd:cursor-grabbing' : 'zd:cursor-grab'
    }
  }, [disabled, draggedItem, handleDragStart, handleDragEnd])

  // Get drop indicator props
  const getDropIndicatorProps = useCallback((workspace: WorkspaceWithChildren, type: 'before' | 'after' | 'inside') => {
    const isActive = dragOverWorkspace?.id === workspace.id && dragOverType === type
    
    // Check if this would be an invalid drop
    const isInvalidDrop = draggedItem && type === 'inside' && isTargetChildOfDragged(draggedItem.data, workspace.id)
    
    if (type === 'inside') {
      // For inside drops, show a border around the entire workspace
      const borderColor = isInvalidDrop ? 'zd:border-red-500' : 'zd:border-blue-500'
      return {
        className: `zd:absolute zd:inset-0 zd:border-2 ${borderColor} zd:rounded-md zd:transition-all zd:duration-200 zd:z-10 ${
          isActive ? 'zd:opacity-100' : 'zd:opacity-0'
        }`,
        style: {
          display: isActive ? 'block' : 'none'
        }
      }
    } else {
      // For before/after drops, show a line indicator
      const lineColor = isInvalidDrop ? 'zd:bg-red-500' : 'zd:bg-blue-500'
      const baseClasses = `zd:absolute zd:left-0 zd:right-0 zd:h-0.5 ${lineColor} zd:rounded-full zd:transition-all zd:duration-200 zd:z-10`
      const positionClasses = type === 'before' ? 'zd:-top-0.5' : 'zd:-bottom-0.5'
      const visibilityClasses = isActive ? 'zd:opacity-100 zd:scale-y-100' : 'zd:opacity-0 zd:scale-y-0'
      
      return {
        className: `${baseClasses} ${positionClasses} ${visibilityClasses}`,
        style: {
          display: isActive ? 'block' : 'none'
        }
      }
    }
  }, [dragOverWorkspace, dragOverType, draggedItem, isTargetChildOfDragged])

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
    dragOverWorkspace,
    dragOverType,
    isDragging,
    getDropZoneProps,
    getDragProps,
    getDropIndicatorProps
  }
}
