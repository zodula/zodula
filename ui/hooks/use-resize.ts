import { useCallback, useState, useEffect, useRef } from 'react';

export interface UseResizeOptions {
  onResize?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  initialWidth?: number;
}

export interface UseResizeReturn {
  isResizing: boolean;
  width: number;
  startResize: (e: React.MouseEvent, startWidth: number) => void;
  resizeProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    className: string;
  };
}

export const useResize = ({
  onResize,
  minWidth = 80,
  maxWidth = Infinity,
  initialWidth = 120,
}: UseResizeOptions = {}): UseResizeReturn => {
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(initialWidth);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);
  const resizeRef = useRef<{ startWidth: number; startX: number } | null>(null);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const diff = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, resizeRef.current.startWidth + diff)
      );

      setWidth(newWidth);
      onResize?.(newWidth);
    },
    [minWidth, maxWidth, onResize]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeRef.current = null;
  }, []);

  const startResize = useCallback(
    (e: React.MouseEvent, startWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setDragStartX(e.clientX);
      setDragStartWidth(startWidth);
      resizeRef.current = {
        startWidth,
        startX: e.clientX,
      };
    },
    []
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return {
    isResizing,
    width,
    startResize,
    resizeProps: {
      onMouseDown: (e: React.MouseEvent) => {
        startResize(e, width);
      },
      className: 'zd:cursor-col-resize zd:hover:bg-blue-500',
    },
  };
};

