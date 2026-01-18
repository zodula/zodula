import { useCallback, useState } from 'react';
import type { ListColumn } from '../components/list/ListTable';

interface ColumnItem {
  id: string;
  type: 'column';
  index: number;
  data: ListColumn;
}

export interface UseColumnDndOptions {
  columns: ListColumn[];
  onReorder: (fromId: string, toId: string, type: 'before' | 'after') => void;
  disabled?: boolean;
}

export interface UseColumnDndReturn {
  draggedColumn: string | null;
  dragOverColumn: string | null;
  handleDragStart: (e: React.DragEvent, columnKey: string) => void;
  handleDragOver: (e: React.DragEvent, columnKey: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, targetColumnKey: string) => void;
  handleDragEnd: () => void;
  getDragProps: (columnKey: string) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    className: string;
  };
  getDropZoneProps: (columnKey: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    className: string;
  };
}

export const useColumnDnd = ({
  columns,
  onReorder,
  disabled = false,
}: UseColumnDndOptions): UseColumnDndReturn => {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      if (disabled) return;
      setDraggedColumn(columnKey);
      e.dataTransfer.effectAllowed = 'move';
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      e.preventDefault();
      if (draggedColumn && draggedColumn !== columnKey) {
        setDragOverColumn(columnKey);
      }
    },
    [draggedColumn]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnKey: string) => {
      e.preventDefault();
      if (!draggedColumn || draggedColumn === targetColumnKey) {
        setDraggedColumn(null);
        setDragOverColumn(null);
        return;
      }

      // Determine drop position based on mouse position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const type: 'before' | 'after' = x < width / 2 ? 'before' : 'after';

      onReorder(draggedColumn, targetColumnKey, type);
      setDraggedColumn(null);
      setDragOverColumn(null);
    },
    [draggedColumn, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  const getDragProps = useCallback(
    (columnKey: string) => {
      const isDragged = draggedColumn === columnKey;
      return {
        draggable: !disabled && !isDragged,
        onDragStart: (e: React.DragEvent) => handleDragStart(e, columnKey),
        onDragEnd: handleDragEnd,
        className: isDragged ? 'zd:cursor-grabbing' : 'zd:cursor-grab',
      };
    },
    [disabled, draggedColumn, handleDragStart, handleDragEnd]
  );

  const getDropZoneProps = useCallback(
    (columnKey: string) => {
      const isDragOver = dragOverColumn === columnKey;
      const isDragged = draggedColumn === columnKey;
      return {
        onDragOver: (e: React.DragEvent) => handleDragOver(e, columnKey),
        onDragLeave: handleDragLeave,
        onDrop: (e: React.DragEvent) => handleDrop(e, columnKey),
        className: `${
          isDragOver ? 'zd:ring-2 zd:ring-blue-500' : ''
        } ${isDragged ? 'zd:opacity-50' : ''}`,
      };
    },
    [dragOverColumn, draggedColumn, handleDragOver, handleDragLeave, handleDrop]
  );

  return {
    draggedColumn,
    dragOverColumn,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    getDragProps,
    getDropZoneProps,
  };
};

