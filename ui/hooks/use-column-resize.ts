import { useCallback, useEffect, useRef } from 'react';

export interface UseColumnResizeOptions {
  columnKey: string;
  currentWidth: number;
  onResize: (columnKey: string, width: number) => void;
  minWidth?: number;
}

export interface UseColumnResizeReturn {
  handleResizeStart: (e: React.MouseEvent) => void;
}

/**
 * Hook for handling column resizing in table views
 * @param options - Configuration options for column resizing
 * @returns Handler function for starting resize
 */
export const useColumnResize = ({
  columnKey,
  currentWidth,
  onResize,
  minWidth = 200,
}: UseColumnResizeOptions): UseColumnResizeReturn => {
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isResizingRef.current) return;
      isResizingRef.current = true;

      const startWidth = currentWidth;
      const startX = e.clientX;

      const handleResizeMove = (e: MouseEvent) => {
        const diff = e.clientX - startX;
        const newWidth = Math.max(minWidth, startWidth + diff);
        onResize(columnKey, newWidth);
      };

      const handleResizeEnd = () => {
        isResizingRef.current = false;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    },
    [columnKey, currentWidth, onResize, minWidth]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isResizingRef.current = false;
    };
  }, []);

  return {
    handleResizeStart,
  };
};

