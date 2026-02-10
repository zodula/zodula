import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface PrintTemplateElementHoverProps {
  elementId: string | null;
  layout: Array<{ id: string; transform?: { x: number; y: number; width: number; height: number } }>;
  zoom: number;
  paperRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function PrintTemplateElementHover({
  elementId,
  layout,
  zoom,
  paperRef,
  canvasRef,
}: PrintTemplateElementHoverProps) {
  const hoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementId || !hoverRef.current || !paperRef.current || !canvasRef.current) {
      return;
    }

    const element = layout.find(el => el.id === elementId);
    if (!element || !element.transform) {
      return;
    }

    const updatePosition = () => {
      if (!hoverRef.current || !paperRef.current || !canvasRef.current) return;

      const paperRect = paperRef.current.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const scale = zoom / 100;
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;

      const x = (element.transform!.x * scale) + paperRect.left - canvasRect.left + scrollLeft;
      const y = (element.transform!.y * scale) + paperRect.top - canvasRect.top + scrollTop;
      const width = element.transform!.width * scale;
      const height = element.transform!.height * scale;

      hoverRef.current.style.left = `${x}px`;
      hoverRef.current.style.top = `${y}px`;
      hoverRef.current.style.width = `${width}px`;
      hoverRef.current.style.height = `${height}px`;
    };

    updatePosition();

    // Update on scroll
    const handleScroll = () => updatePosition();
    canvasRef.current.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updatePosition);

    return () => {
      canvasRef.current?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updatePosition);
    };
  }, [elementId, layout, zoom, paperRef, canvasRef]);

  if (!elementId) return null;

  return (
    <div
      ref={hoverRef}
      className={cn(
        "zd:absolute zd:pointer-events-none zd:z-[200] zd:rounded-lg zd:bg-green-500/10 zd:transition-all zd:shadow-lg"
      )}
      style={{
        display: elementId ? 'block' : 'none',
      }}
    />
  );
}

