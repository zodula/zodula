import { useState, useEffect } from "react";

/**
 * Hook that returns whether the given media query matches.
 * @param query - CSS media query string (e.g. "(min-width: 768px)")
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * Returns true when viewport is at least tablet size (768px).
 * Use for responsive behavior: below tablet = show drawer, tablet+ = show sidebar.
 */
export function useIsTabletOrUp(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
