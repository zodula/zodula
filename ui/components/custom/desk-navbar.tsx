import { Link } from "react-router";
import { Select, type SelectOption } from "../ui/select";
import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { zodula } from "@/zodula/client";
import { useRouter } from "../router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { UserIcon, PanelLeftOpen, Search, X, ScanLine } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useTranslation } from "../../hooks/use-translation";
import { AboutZodulaDialog } from "../dialogs/about-zodula-dialog";
import { confirm, popup } from "../ui/popit";
import { useNavbar } from "../../hooks/use-navbar";
import { LanguageSelection } from "./language-selection";
import { Breadcrumb } from "./breadcrumb";
import { useIsTabletOrUp } from "../../hooks/use-media-query";
import { ScannerDialog } from "../form/plugins/scanner";
import { useDocListAll } from "../../hooks/use-doc-list-all";
import { toast } from "../ui/toast";

export interface DeskNavbarProps {
  children?: React.ReactNode;
  /** Panel toggle button rendered on the right side next to user button, injected by DeskNavbarLayout */
  panelToggle?: React.ReactNode;
}

type DeskSearchPayload = {
  doctypes: { name: string; label: string; listHref: string }[];
  pages: { name: string; href: string }[];
  docs: {
    doctype: string;
    doctypeLabel: string;
    name: string;
    formHref: string;
  }[];
};

const DESK_SEARCH_EMPTY_DOCS: DeskSearchPayload["docs"] = [];

/** Wait after last keystroke before doc-id search (empty query clears immediately). */
const DESK_SEARCH_DEBOUNCE_MS = 500;

function isCheckOn(v: unknown): boolean {
  return v === 1 || v === "1" || v === true;
}

function isChildDoctypeRow(d: Record<string, unknown>): boolean {
  const v = d.is_child_doctype;
  return v === 1 || v === "1" || v === true;
}

/**
 * Fuzzy score for ranking: lower is better. POSITIVE_INFINITY = no match.
 * Prefers contiguous substring, then subsequence (characters of q in order, gaps allowed).
 */
function deskSearchFuzzyScore(qRaw: string, text: string): number {
  const q = qRaw.trim().toLowerCase();
  const hay = String(text).toLowerCase();
  if (!q) return 0;
  const idx = hay.indexOf(q);
  if (idx >= 0) return idx;
  let qi = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      qi++;
    }
  }
  if (qi < q.length) return Number.POSITIVE_INFINITY;
  return 1000 + gaps;
}

function deskSearchBestFuzzyScore(qRaw: string, parts: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const p of parts) {
    const s = deskSearchFuzzyScore(qRaw, p);
    if (s < best) best = s;
  }
  return best;
}

/** True if `q` is empty, or fuzzy-matches any candidate (substring or subsequence). */
function deskSearchMatchesQuery(qRaw: string, parts: string[]): boolean {
  if (!qRaw.trim()) return true;
  return deskSearchBestFuzzyScore(qRaw, parts) < Number.POSITIVE_INFINITY;
}

/** Code-unit indices in `text` matching the query (substring or fuzzy subsequence). */
function deskSearchHighlightIndices(query: string, text: string): Set<number> {
  const q = query.trim();
  const set = new Set<number>();
  if (!q || !text) return set;
  const hay = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = hay.indexOf(ql);
  if (idx >= 0) {
    for (let i = 0; i < ql.length; i++) set.add(idx + i);
    return set;
  }
  let qi = 0;
  for (let i = 0; i < hay.length && qi < ql.length; i++) {
    if (hay[i] === ql[qi]) {
      set.add(i);
      qi++;
    }
  }
  return set;
}

/** Include any code unit that shares a grapheme cluster with a highlighted unit (fixes split surrogate pairs). */
function expandHighlightIndicesToGraphemeClusters(text: string, indices: Set<number>): Set<number> {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return new Set(indices);
  }
  const out = new Set<number>();
  indices.forEach((i) => out.add(i));
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (const data of segmenter.segment(text) as Iterable<Intl.SegmentData>) {
    const start = data.index;
    const end = start + data.segment.length;
    let touched = false;
    for (let i = start; i < end; i++) {
      if (indices.has(i)) touched = true;
    }
    if (touched) {
      for (let i = start; i < end; i++) out.add(i);
    }
  }
  return out;
}

/** Thai: vowel/tone after a consonant must stay with it — wrapping only part breaks shaping. */
function isThaiFollowingVowelOrTone(code: number): boolean {
  return (
    (code >= 0x0e31 && code <= 0x0e3a) ||
    (code >= 0x0e47 && code <= 0x0e4e)
  );
}

function isThaiPreposedVowel(code: number): boolean {
  return code >= 0x0e40 && code <= 0x0e44;
}

/** Extend highlights so Thai vowels/tone marks are not split from their consonant. */
function mergeThaiVowelsWithHighlightedConsonants(text: string, indices: Set<number>): Set<number> {
  const out = new Set(indices);
  const n = text.length;
  let changed = true;
  while (changed) {
    changed = false;
    for (let j = 1; j < n; j++) {
      if (out.has(j)) continue;
      const c = text.charCodeAt(j);
      if (!isThaiFollowingVowelOrTone(c)) continue;
      if (out.has(j - 1)) {
        out.add(j);
        changed = true;
      }
    }
    for (let j = 1; j < n; j++) {
      if (!out.has(j)) continue;
      const c = text.charCodeAt(j - 1);
      if (!isThaiPreposedVowel(c)) continue;
      if (!out.has(j - 1)) {
        out.add(j - 1);
        changed = true;
      }
    }
  }
  return out;
}

function deskSearchHighlightLabel(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  let indices = deskSearchHighlightIndices(q, text);
  indices = expandHighlightIndicesToGraphemeClusters(text, indices);
  indices = mergeThaiVowelsWithHighlightedConsonants(text, indices);
  if (indices.size === 0) return text;
  const n = text.length;
  const out: ReactNode[] = [];
  let key = 0;
  let i = 0;
  while (i < n) {
    if (indices.has(i)) {
      let j = i + 1;
      while (j < n && indices.has(j)) j++;
      out.push(
        <mark
          key={key++}
          className="zd:m-0 zd:inline zd:p-0 zd:bg-yellow-200 zd:text-inherit zd:rounded-none zd:box-decoration-clone dark:zd:bg-yellow-500/35"
        >
          {text.slice(i, j)}
        </mark>
      );
      i = j;
    } else {
      let j = i + 1;
      while (j < n && !indices.has(j)) j++;
      out.push(text.slice(i, j));
      i = j;
    }
  }
  return <>{out}</>;
}

/** Mirrors `runDeskSearch` doctype/page filtering using `useDocListAll` data + Doctype Permission. `t` includes current-language labels. */
function buildDeskOmniboxDoctypesAndPages(
  doctypeRows: Record<string, unknown>[],
  pageRows: Array<Record<string, unknown>>,
  permRows: Record<string, unknown>[],
  roles: string[],
  qRaw: string,
  t: (key: string) => string
): { doctypes: DeskSearchPayload["doctypes"]; pages: DeskSearchPayload["pages"] } {
  const isSystemAdmin = roles.includes("System Admin");

  const allowedDoctypes = new Set<string>();
  if (!isSystemAdmin) {
    for (const p of permRows) {
      if (String(p.perm_level ?? "") !== "0") continue;
      const role = String(p.role ?? "");
      if (!roles.includes(role)) continue;
      if (isCheckOn(p.can_select) || isCheckOn(p.can_own_select)) {
        const dt = String(p.doctype ?? "").trim();
        if (dt) allowedDoctypes.add(dt);
      }
    }
  }

  const qTrim = qRaw.trim();
  const doctypeRanked: {
    item: DeskSearchPayload["doctypes"][number];
    rank: number;
  }[] = [];
  for (const row of doctypeRows) {
    const name = String(row.name ?? "");
    if (!name || isChildDoctypeRow(row)) continue;
    if (!isSystemAdmin && !allowedDoctypes.has(name)) continue;
    const label = String(row.label ?? name);
    const labelKey = label || name;
    const parts = [name, label, t(labelKey), t(name)];
    if (!deskSearchMatchesQuery(qRaw, parts)) continue;
    const rank = deskSearchBestFuzzyScore(qRaw, parts);
    doctypeRanked.push({
      item: {
        name,
        label,
        listHref: `/desk/doctypes/${name}/list`,
      },
      rank,
    });
  }
  if (qTrim) {
    doctypeRanked.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return (a.item.label || a.item.name).localeCompare(b.item.label || b.item.name);
    });
  } else {
    doctypeRanked.sort((a, b) =>
      (a.item.label || a.item.name).localeCompare(b.item.label || b.item.name)
    );
  }
  const doctypes = doctypeRanked.map((x) => x.item);

  const pageRanked: { item: DeskSearchPayload["pages"][number]; rank: number }[] = [];
  for (const row of pageRows) {
    const name = String(row.name ?? "");
    const href = String(row.href ?? "");
    if (!name || !href) continue;
    const parts = [name, href, t(name)];
    if (!deskSearchMatchesQuery(qRaw, parts)) continue;
    const rank = deskSearchBestFuzzyScore(qRaw, parts);
    pageRanked.push({ item: { name, href }, rank });
  }
  if (qTrim) {
    pageRanked.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.item.name.localeCompare(b.item.name);
    });
  } else {
    pageRanked.sort((a, b) => a.item.name.localeCompare(b.item.name));
  }
  const pages = pageRanked.map((x) => x.item);

  return { doctypes, pages };
}

function DeskSearchOmnibox(props: {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  docHits: DeskSearchPayload["docs"];
  setDocHits: React.Dispatch<React.SetStateAction<DeskSearchPayload["docs"]>>;
  onClose: () => void;
  searchOverlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const router = useRouter();
  const { docs: doctypeRows } = useDocListAll({ doctype: "Doctype" });
  const { docs: pageRows } = useDocListAll({ doctype: "Page" });
  const { docs: permRows } = useDocListAll({ doctype: "Doctype Permission" });

  const { doctypes: filteredDoctypes, pages: filteredPages } = useMemo(
    () =>
      buildDeskOmniboxDoctypesAndPages(
        doctypeRows as unknown as Record<string, unknown>[],
        pageRows as unknown as Record<string, unknown>[],
        permRows as unknown as Record<string, unknown>[],
        roles,
        props.searchTerm.trim(),
        t
      ),
    [doctypeRows, pageRows, permRows, roles, props.searchTerm, t]
  );

  const options = useMemo(() => {
    const q = props.searchTerm.trim();
    const combined: SelectOption[] = [];
    for (const d of filteredDoctypes) {
      const label = t(d.label || d.name);
      combined.push({
        label,
        labelContent: q ? deskSearchHighlightLabel(label, q) : undefined,
        value: d.listHref,
        icon: "BookIcon",
      });
    }
    for (const p of filteredPages) {
      const label = t(p.name);
      combined.push({
        label,
        labelContent: q ? deskSearchHighlightLabel(label, q) : undefined,
        value: p.href,
        icon: "FileIcon",
      });
    }
    for (const d of props.docHits) {
      const label = `${t(d.doctypeLabel)} > ${d.name}`;
      combined.push({
        label,
        labelContent: q ? deskSearchHighlightLabel(label, q) : undefined,
        value: d.formHref,
        icon: "BookIcon",
      });
    }
    return combined;
  }, [filteredDoctypes, filteredPages, props.docHits, props.searchTerm, t]);

  useEffect(() => {
    const debounceMs =
      props.searchTerm.trim() === "" ? 0 : DESK_SEARCH_DEBOUNCE_MS;
    const id = window.setTimeout(() => {
      const q = props.searchTerm.trim();
      if (!q) {
        props.setDocHits(DESK_SEARCH_EMPTY_DOCS);
        return;
      }
      zodula
        .action("zodula.core.search", { data: { q, docsOnly: true } })
        .then((r) => {
          if (r && typeof r === "object" && Array.isArray((r as DeskSearchPayload).docs)) {
            props.setDocHits((r as DeskSearchPayload).docs);
          }
        })
        .catch(() => {
          props.setDocHits(DESK_SEARCH_EMPTY_DOCS);
        });
    }, debounceMs);
    return () => clearTimeout(id);
  }, [props.searchTerm, props.setDocHits]);

  return (
    <div ref={props.searchOverlayRef} className="zd:w-full zd:max-w-xl zd:px-4">
      <Select
        className="zd:w-full"
        value={props.searchTerm}
        onChange={(value) => props.setSearchTerm(value)}
        searchable
        serverFiltered
        validate
        allowFreeText
        options={options}
        displayMode="label"
        placeholder={t("Search doctypes and pages...")}
        onSelect={(option) => {
          props.onClose();
          router.push(option.value);
        }}
      />
    </div>
  );
}

export const DeskNavbar = ({ children, panelToggle }: DeskNavbarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [docHits, setDocHits] = useState<DeskSearchPayload["docs"]>(DESK_SEARCH_EMPTY_DOCS);
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const {
    leftSidebarOpenDesktop,
    leftSidebarOpenMobile,
    toggleLeftSidebarDesktop,
    toggleLeftSidebarMobile,
  } = useNavbar();
  const isTabletOrUp = useIsTabletOrUp();
  const leftSidebarOpen = isTabletOrUp ? leftSidebarOpenDesktop : leftSidebarOpenMobile;
  const toggleLeftSidebar = isTabletOrUp ? toggleLeftSidebarDesktop : toggleLeftSidebarMobile;
  const { t } = useTranslation();

  // Close overlay on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchTerm("");
        setDocHits(DESK_SEARCH_EMPTY_DOCS);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const handleLogout = async () => {
    const con = await confirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      variant: "destructive",
    });
    if (!con) return;
    await logout();
    router.push("/login");
  };

  const handleAboutZodula = async () => {
    await popup(AboutZodulaDialog, {
      title: "Zodula Framework",
      description:
        "Modern, flexible framework for building web applications with a focus on developer experience and scalability.",
      showCloseButton: true,
    });
  };

  const searchOverlayRef = useRef<HTMLDivElement>(null);

  // Auto-focus the search input when overlay opens
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => {
      const input = searchOverlayRef.current?.querySelector("input");
      if (input) input.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
    setDocHits(DESK_SEARCH_EMPTY_DOCS);
  };

  const openDeskScanner = async () => {
    if (!isAuthenticated) return;
    const result = await popup(ScannerDialog, {
      title: t("Scan QR / Barcode"),
      maxWidth: "720px",
      width: "90vw",
    });
    const q = String(result ?? "").trim();
    if (!q) return;
    try {
      const r = await zodula.action("zodula.core.search", { data: { q, docsOnly: true } });
      const docs =
        r && typeof r === "object" && Array.isArray((r as DeskSearchPayload).docs)
          ? (r as DeskSearchPayload).docs
          : [];
      if (docs.length === 0) {
        toast.error(t("No matching document"));
        return;
      }
      if (docs.length === 1) {
        const only = docs[0];
        if (only) router.push(only.formHref);
        return;
      }
      const exact = docs.find((d) => d.name === q);
      if (exact) {
        router.push(exact.formHref);
        return;
      }
      toast.error(t("Multiple documents match; try a more specific code"));
    } catch {
      toast.error(t("Search failed"));
    }
  };

  return (
    <>
      {/* Slim top bar */}
      <header className="zd:h-12 zd:flex zd:w-full zd:items-center zd:justify-between zd:px-3 zd:py-2 zd:border-b zd:border-border zd:bg-background zd:shrink-0 no-print">
        {/* Left: sidebar toggle (when collapsed) + breadcrumb */}
        <div className="zd:flex zd:items-center zd:gap-2 zd:flex-1 zd:min-w-0">
          {!leftSidebarOpen && (
            <Button
              variant="ghost"
              onClick={toggleLeftSidebar}
              className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0"
              title="Open sidebar"
            >
              <PanelLeftOpen className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
            </Button>
          )}
          <Breadcrumb showHome={false} className="zd:min-w-0" />
        </div>

        {/* Right: search + language + panel toggle + user */}
        <div className="zd:flex zd:items-center zd:gap-1 zd:shrink-0">
          {/* Search button */}
          <Button
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0"
            title="Search"
          >
            <Search className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
          </Button>
          {isAuthenticated ? (
            <Button
              type="button"
              variant="ghost"
              className="zd:h-8 zd:w-8 zd:p-0! zd:shrink-0"
              title={t("Scan QR / Barcode")}
              aria-label={t("Scan QR / Barcode")}
              onClick={openDeskScanner}
            >
              <ScanLine className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
            </Button>
          ) : null}

          {/* Language */}
          <LanguageSelection />

          {/* User */}
          {!isAuthenticated ? (
            <Link to="/login">
              <Button size="sm">Login</Button>
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="zd:h-8 zd:w-8 zd:p-0! zd:rounded-full zd:shrink-0"
                >
                  <div className="zd:w-7 zd:h-7 zd:rounded-full zd:bg-primary/10 zd:flex zd:items-center zd:justify-center">
                    <UserIcon className="zd:w-3.5 zd:h-3.5 zd:text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="zd:min-w-52">
                <div className="zd:px-2.5 zd:py-2 zd:border-b zd:border-border zd:mb-1">
                  <p className="zd:text-sm zd:font-medium zd:text-foreground zd:truncate">
                    {user?.name || user?.email}
                  </p>
                  <p className="zd:text-xs zd:text-muted-foreground zd:truncate zd:max-w-44">
                    {user?.id}
                  </p>
                </div>
                <DropdownMenuItem
                  href={`/desk/doctypes/Global Setting`}
                >
                  {t("Global Setting")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={zodula.theme.toggleTheme}>
                  {t("Toggle Theme")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAboutZodula}>
                  {t("About")}
                </DropdownMenuItem>
                <DropdownMenuItem href="/">
                  {t("Go To Website")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="zd:text-destructive zd:focus:text-destructive zd:hover:bg-destructive/10"
                >
                  {t("Logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Panel toggle (right sidebar open/close) */}
          {panelToggle}
        </div>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="zd:fixed zd:inset-0 zd:z-50 zd:flex zd:flex-col zd:items-center zd:pt-20 zd:backdrop-blur-xs zd:bg-background/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSearch();
          }}
        >
          {/* Close button */}
          <button
            className="zd:absolute zd:top-4 zd:right-4 zd:p-2 zd:rounded-full zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-accent zd:transition-colors"
            onClick={closeSearch}
            title="Close search"
          >
            <X className="zd:w-5 zd:h-5" />
          </button>

          {isAuthenticated ? (
            <DeskSearchOmnibox
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              docHits={docHits}
              setDocHits={setDocHits}
              onClose={closeSearch}
              searchOverlayRef={searchOverlayRef}
            />
          ) : (
            <div ref={searchOverlayRef} className="zd:w-full zd:max-w-xl zd:px-4">
              <Select
                className="zd:w-full"
                value={searchTerm}
                onChange={(value) => setSearchTerm(value)}
                searchable
                serverFiltered
                validate
                allowFreeText
                options={[]}
                displayMode="label"
                placeholder={t("Search doctypes and pages...")}
                onSelect={(option) => {
                  closeSearch();
                  router.push(option.value);
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};
