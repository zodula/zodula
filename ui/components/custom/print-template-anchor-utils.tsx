import { useCallback } from "react";
import type { PrintTemplateElement } from "./print-template-types";

// Check if setting anchorTo would create a loop
export function wouldCreateLoop(
  elementId: string,
  anchorToId: string,
  allElements: PrintTemplateElement[]
): boolean {
  if (elementId === anchorToId) return true; // Can't anchor to itself
  
  // Build dependency graph
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  const hasCycle = (currentId: string): boolean => {
    if (visiting.has(currentId)) return true; // Cycle detected
    if (visited.has(currentId)) return false; // Already processed
    
    visiting.add(currentId);
    
    const element = allElements.find(el => el.id === currentId);
    if (element?.anchorTo) {
      // Check if this would create a cycle
      if (element.anchorTo === elementId) return true; // Would create cycle
      if (hasCycle(element.anchorTo)) return true;
    }
    
    // Also check the potential new anchor
    if (currentId === anchorToId) {
      const anchorElement = allElements.find(el => el.id === anchorToId);
      if (anchorElement?.anchorTo === elementId) return true; // Would create cycle
      if (anchorElement?.anchorTo && hasCycle(anchorElement.anchorTo)) return true;
    }
    
    visiting.delete(currentId);
    visited.add(currentId);
    return false;
  };
  
  return hasCycle(anchorToId);
}

// Calculate anchor position for an element (recursive for nested anchors)
export function calculateAnchorPosition(
  element: PrintTemplateElement,
  allElements: PrintTemplateElement[],
  visited: Set<string> = new Set()
): { x: number; y: number } {
  if (!element.anchorTo || element.anchorTo === null) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }
  
  // Prevent infinite loops
  if (visited.has(element.id)) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }
  visited.add(element.id);
  
  const anchorElement = allElements.find(el => el.id === element.anchorTo);
  if (!anchorElement) {
    return { x: element.transform?.x || 0, y: element.transform?.y || 0 };
  }
  
  // Recursively calculate anchor position (support nested anchors)
  const anchorPos = calculateAnchorPosition(anchorElement, allElements, visited);
  const anchorX = anchorPos.x;
  const anchorY = anchorPos.y;
  const anchorWidth = anchorElement.transform?.width || 0;
  const anchorHeight = anchorElement.transform?.height || 0;
  const offset = element.anchorOffset || 0;
  const position = element.anchorPosition || "bottom";
  
  let newX = element.transform?.x || 0;
  let newY = element.transform?.y || 0;
  
  switch (position) {
    case "top":
      newX = anchorX;
      newY = anchorY - (element.transform?.height || 0) - (typeof offset === "number" ? offset : 0);
      break;
    case "bottom":
      newX = anchorX;
      newY = anchorY + anchorHeight + (typeof offset === "number" ? offset : 0);
      break;
    case "left":
      newX = anchorX - (element.transform?.width || 0) - (typeof offset === "number" ? offset : 0);
      newY = anchorY;
      break;
    case "right":
      newX = anchorX + anchorWidth + (typeof offset === "number" ? offset : 0);
      newY = anchorY;
      break;
    case "inside":
    case "top-left": // "top-left" is treated as "inside" with offset
      const offsetX = typeof offset === "object" ? offset.x : 0;
      const offsetY = typeof offset === "object" ? offset.y : 0;
      newX = anchorX + offsetX;
      newY = anchorY + offsetY;
      break;
  }
  
  return { x: newX, y: newY };
}

// Update all anchored elements when layout changes
export function updateAnchoredElements(
  elements: PrintTemplateElement[],
  calculateAnchorPosition: (element: PrintTemplateElement, allElements: PrintTemplateElement[], visited?: Set<string>) => { x: number; y: number }
): PrintTemplateElement[] {
  // Build dependency graph to process anchors in correct order (topological sort)
  const elementMap = new Map<string, PrintTemplateElement>();
  const dependencies = new Map<string, string[]>();
  
  elements.forEach(el => {
    elementMap.set(el.id, el);
    if (el.anchorTo) {
      if (!dependencies.has(el.id)) {
        dependencies.set(el.id, []);
      }
      dependencies.get(el.id)!.push(el.anchorTo);
    }
  });
  
  // Topological sort: process elements that don't have anchors first, then those that anchor to them
  const processed = new Set<string>();
  const result: PrintTemplateElement[] = [];
  const queue: PrintTemplateElement[] = elements.filter(el => !el.anchorTo || el.anchorTo === null);
  
  // Process elements without anchors first
  queue.forEach(el => {
    processed.add(el.id);
    result.push(el);
  });
  
  // Process anchored elements in dependency order
  let changed = true;
  while (changed) {
    changed = false;
    elements.forEach(el => {
      if (processed.has(el.id)) return;
      
      const deps = dependencies.get(el.id) || [];
      const allDepsProcessed = deps.every(depId => processed.has(depId));
      
      if (allDepsProcessed) {
        // Calculate anchor position
        const newPos = calculateAnchorPosition(el, result);
        const updated = {
          ...el,
          transform: {
            ...(el.transform || { x: 0, y: 0, width: 200, height: 30 }),
            x: newPos.x,
            y: newPos.y,
          }
        };
        result.push(updated);
        processed.add(el.id);
        changed = true;
      }
    });
  }
  
  // Add any remaining elements (shouldn't happen if no circular dependencies)
  elements.forEach(el => {
    if (!processed.has(el.id)) {
      result.push(el);
    }
  });
  
  return result;
}

// Hook for anchor utilities
export function useAnchorUtils() {
  const checkWouldCreateLoop = useCallback((elementId: string, anchorToId: string, allElements: PrintTemplateElement[]): boolean => {
    return wouldCreateLoop(elementId, anchorToId, allElements);
  }, []);

  const calculateAnchorPos = useCallback((element: PrintTemplateElement, allElements: PrintTemplateElement[], visited: Set<string> = new Set()): { x: number; y: number } => {
    return calculateAnchorPosition(element, allElements, visited);
  }, []);

  const updateAnchored = useCallback((elements: PrintTemplateElement[]): PrintTemplateElement[] => {
    return updateAnchoredElements(elements, calculateAnchorPosition);
  }, []);

  return {
    wouldCreateLoop: checkWouldCreateLoop,
    calculateAnchorPosition: calculateAnchorPos,
    updateAnchoredElements: updateAnchored,
  };
}

