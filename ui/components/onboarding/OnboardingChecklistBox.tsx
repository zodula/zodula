import { useState, useEffect, useMemo, useRef } from "react";
import { useZui } from "@/zodula/ui/zui";
import { useParams, useLocation } from "react-router";
import { useRouter } from "@/zodula/ui/components/router";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { Button } from "@/zodula/ui/components/ui/button";
import { cn } from "@/zodula/ui/lib/utils";
import {
    Check,
    CheckCircle2,
    Circle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ListTodo,
    ExternalLink,
    Play,
    X,
} from "lucide-react";

type Step = {
    id: string;
    title: string;
    description: string | null;
    route: string | null;
    target_selector?: string | null;
    completion_mode?: string | null;
    completion_value?: string | null;
    done: boolean;
    idx: number;
};

type ChecklistItem = {
    onboarding: { id: string; name: string; mode: string };
    steps: Step[];
};

type TourState = {
    item: ChecklistItem;
    stepIndex: number;
};

/** Resolves step route: replaces {{org}} with current org; relative paths get /desk/{org}/ prefix. */
function getStepHref(route: string | null, org: string | undefined): string | null {
    if (!route || !org) return null;
    const withOrg = route.replace(/\{\{org\}\}/gi, org);
    const path = withOrg.startsWith("/") ? withOrg : `/desk/${org}/${withOrg}`;
    return path.replace(/\/Sheet$/i, "/sheet");
}

/** Escape string for use inside a RegExp (so literal chars don't act as regex). */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if pathname matches completion_value: empty = any path; else regex ({{org}} replaced with escaped org). */
function pathnameMatches(pattern: string | null | undefined, pathname: string, org: string | undefined): boolean {
    if (!pattern?.trim()) return true;
    const source = org != null ? pattern.replace(/\{\{org\}\}/gi, escapeRegex(org)) : pattern;
    const pathDecoded = (() => {
        try {
            return decodeURIComponent(pathname);
        } catch {
            return pathname;
        }
    })();
    try {
        return new RegExp(source).test(pathDecoded);
    } catch {
        return false;
    }
}

/** True if text matches completion_value: empty = any non-empty text; else regex. */
function valueMatchesPattern(text: string, pattern: string | null | undefined): boolean {
    if (!pattern?.trim()) return text !== "";
    try {
        return new RegExp(pattern).test(text);
    } catch {
        return false;
    }
}

/** Get current org from route params or pathname (e.g. /desk/MyOrg/... -> MyOrg). */
function useOrgFromDesk(): string | undefined {
    const params = useParams();
    const location = useLocation();
    const pathname = location?.pathname ?? "";
    if (params?.org) return params.org as string;
    if (!pathname.startsWith("/desk/")) return undefined;
    const segments = pathname.split("/").filter(Boolean);
    return segments.length >= 2 ? decodeURIComponent(segments[1] as string) : undefined;
}

export function OnboardingChecklistBox() {
    const { t } = useTranslation();
    const org = useOrgFromDesk();
    const location = useLocation();
    const pathname = location?.pathname ?? "";
    const router = useRouter();
    const zui = useZui();
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [boxCollapsed, setBoxCollapsed] = useState(true);
    const [showCompleted, setShowCompleted] = useState(false);
    const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set());
    const [tour, setTour] = useState<TourState | null>(null);
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
    const [requireValueHasValue, setRequireValueHasValue] = useState(false);
    const pathStepMarkedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!org) {
            setChecklist([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        zui.onboarding
            .getChecklist()
            .then((res) => {
                setChecklist(res.checklist || []);
            })
            .catch(() => setChecklist([]))
            .finally(() => setLoading(false));
    }, [org]);

    const itemsWithPending = useMemo(
        () =>
            checklist.filter((c) => c.steps.some((s) => !s.done)),
        [checklist]
    );
    const totalPending = useMemo(
        () => itemsWithPending.reduce((acc, c) => acc + c.steps.filter((s) => !s.done).length, 0),
        [itemsWithPending]
    );
    // the number of onboarding not the steps
    const toalOnboardingThatHavePendingSteps = useMemo(
        () => checklist.filter((c) => c.steps.some((s) => !s.done)).length,
        [checklist]
    );
    const hasAnyOnboarding = checklist.length > 0;
    const itemsToShow = showCompleted ? checklist : itemsWithPending;
    const hasCompletedGroups = checklist.length > itemsWithPending.length;
    const showCard = !loading && !!org;

    const toggleGroup = (id: string) => {
        setOpenGroupIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const markDone = (stepId: string) => {
        zui.onboarding.markStepDone(stepId).then(() => {
            setChecklist((prev) =>
                prev.map((c) => ({
                    ...c,
                    steps: c.steps.map((s) =>
                        s.id === stepId ? { ...s, done: true } : s
                    ),
                }))
            );
        });
    };

    const startTour = (item: ChecklistItem) => {
        if (item.steps.length === 0) return;
        setBoxCollapsed(true);
        setTour({ item, stepIndex: 0 });
    };

    const tourSteps = tour ? tour.item.steps : [];
    const currentTourStep =
        tour && tourSteps[tour.stepIndex]
            ? tourSteps[tour.stepIndex]
            : null;

    const closeTour = () => {
        setTour(null);
        setSpotlightRect(null);
    };

    const openInAppHref = currentTourStep?.route && org
        ? getStepHref(currentTourStep.route, org)
        : null;

    const openInApp = () => {
        if (!openInAppHref) return;
        closeTour();
        router.push(openInAppHref);
    };

    // Spotlight effect: track current step's target element (retry so element is found after paint)
    useEffect(() => {
        if (!tour || !currentTourStep?.target_selector) {
            setSpotlightRect(null);
            return;
        }
        if (currentTourStep.completion_mode === "require_value") setRequireValueHasValue(false);
        const selector = currentTourStep.target_selector;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let attachCleanup: (() => void) | null = null;
        const updateRect = () => {
            if (cancelled) return;
            const target = document.querySelector(selector);
            if (target) setSpotlightRect(target.getBoundingClientRect());
        };
        const getFieldValue = (el: Element): string => {
            const input =
                el instanceof HTMLInputElement || el instanceof HTMLSelectElement
                    ? el
                    : el.querySelector("input, select");
            if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
                return (input.value ?? "").trim();
            }
            return (el.getAttribute("value") ?? "").trim();
        };
        const tryFind = (attempt = 0) => {
            if (cancelled) return;
            const el = document.querySelector(selector) as HTMLElement | null;
            if (el) {
                let observer: MutationObserver | null = null;
                attachCleanup = () => {
                    window.removeEventListener("click", updateRect);
                    window.removeEventListener("resize", updateRect);
                    window.removeEventListener("scroll", updateRect, true);
                    if (observer) observer.disconnect();
                };
                updateRect();
                window.addEventListener("click", updateRect);
                window.addEventListener("resize", updateRect);
                window.addEventListener("scroll", updateRect, true);
                el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
                if (currentTourStep.completion_mode === "auto_on_click") {
                    const checkOpen = () => {
                        const state = el.getAttribute("data-state");
                        const expanded = el.getAttribute("aria-expanded");
                        const isOpen = state === "open" || expanded === "true";
                        if (isOpen) {
                            markDoneAndNext();
                            if (observer) observer.disconnect();
                        }
                    };
                    checkOpen();
                    observer = new MutationObserver(() => checkOpen());
                    observer.observe(el, { attributes: true, attributeFilter: ["data-state", "aria-expanded"] });
                } else if (currentTourStep.completion_mode === "require_value") {
                    const completionValue = currentTourStep.completion_value ?? "";
                    const checkValue = () => {
                        if (cancelled) return;
                        setRequireValueHasValue(valueMatchesPattern(getFieldValue(el), completionValue));
                    };
                    checkValue();
                    el.addEventListener("input", checkValue);
                    el.addEventListener("change", checkValue);
                    const prevCleanup = attachCleanup;
                    attachCleanup = () => {
                        prevCleanup?.();
                        el.removeEventListener("input", checkValue);
                        el.removeEventListener("change", checkValue);
                    };
                }
                return;
            }
            if (attempt < 10) {
                timeoutId = setTimeout(() => tryFind(attempt + 1), 500);
            }
        };
        tryFind();
        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
            attachCleanup?.();
        };
    }, [tour, currentTourStep?.id, currentTourStep?.target_selector, currentTourStep?.completion_mode, currentTourStep?.completion_value]);

    const markDoneAndNext = () => {
        if (!tour || !currentTourStep) return;
        markDone(currentTourStep.id);
        const lastIndex = tour.item.steps.length - 1;
        if (tour.stepIndex >= lastIndex) {
            closeTour();
        } else {
            setTour((prev) => prev && { ...prev, stepIndex: prev.stepIndex + 1 });
        }
    };

    // Auto-advance when pathname matches step's completion_value pattern (e.g. Organization form)
    useEffect(() => {
        if (!tour || !currentTourStep || currentTourStep.completion_mode !== "auto_on_path") return;
        const pattern = currentTourStep.completion_value;
        if (!pathnameMatches(pattern, pathname, org)) return;
        if (pathStepMarkedRef.current === currentTourStep.id) return;
        pathStepMarkedRef.current = currentTourStep.id;
        markDoneAndNext();
    }, [tour, currentTourStep?.id, currentTourStep?.completion_mode, currentTourStep?.completion_value, pathname, org]);

    // Auto-advance when form is not dirty (completion_value = doctype name, e.g. Organization)
    useEffect(() => {
        if (!tour || !currentTourStep || currentTourStep.completion_mode !== "auto_when_not_dirty") return;
        const doctypeMatch = (currentTourStep.completion_value ?? "").trim();
        if (!doctypeMatch) return;
        const check = () => {
            const el = document.querySelector(
                `[data-form-doctype="${doctypeMatch}"][data-form-is-dirty="false"]`
            );
            if (el) {
                if (pathStepMarkedRef.current === currentTourStep.id) return;
                pathStepMarkedRef.current = currentTourStep.id;
                markDoneAndNext();
            }
        };
        check();
        const intervalId = setInterval(check, 300);
        return () => clearInterval(intervalId);
    }, [tour, currentTourStep?.id, currentTourStep?.completion_mode, currentTourStep?.completion_value]);

    if (!showCard) return null;
    if (totalPending === 0) return null;

    return (
        <>
            {/* Floating checklist card - always show on desk when org is set */}
            <div
                className={cn(
                    "zd:fixed zd:bottom-6 zd:right-6 zd:z-50 zd:rounded-lg zd:border zd:bg-background zd:shadow-lg zd:overflow-hidden zd:max-w-[280px] zd:w-[90vw]"
                )}
            >
                <button
                    type="button"
                    onClick={() => setBoxCollapsed((c) => !c)}
                    className="zd:w-full zd:flex zd:items-center zd:gap-2 zd:px-3 zd:py-2 zd:bg-muted/50 zd:hover:bg-muted"
                >
                    <ListTodo className="zd:h-5 zd:w-5" />
                    <span className="zd:font-medium zd:flex-1 zd:text-left zd:text-sm">
                        {t("Onboarding")} {toalOnboardingThatHavePendingSteps > 0 ? `(${toalOnboardingThatHavePendingSteps})` : ""}
                    </span>
                    {boxCollapsed ? (
                        <ChevronUp className="zd:h-4 zd:w-4" />
                    ) : (
                        <ChevronDown className="zd:h-4 zd:w-4" />
                    )}
                </button>
                {!boxCollapsed && (
                    <div className="zd:max-h-64 zd:overflow-y-auto zd:p-1.5 zd:flex zd:flex-col zd:gap-1">
                        {!hasAnyOnboarding ? (
                            <p className="zd:text-xs zd:text-muted-foreground zd:py-2 zd:text-center">
                                {t("You're all set")}
                            </p>
                        ) : (
                            <>
                                {itemsToShow.map((item) => {
                                    const pendingCount = item.steps.filter((s) => !s.done).length;
                                    const isOpen = openGroupIds.has(item.onboarding.id);
                                    return (
                                        <div
                                            key={item.onboarding.id}
                                            className="zd:rounded zd:border zd:overflow-hidden zd:mb-1.5 zd:last:mb-0"
                                        >
                                            <div className="zd:flex zd:items-center zd:gap-1 zd:bg-muted/40">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(item.onboarding.id)}
                                                    className="zd:flex zd:items-center zd:gap-1.5 zd:flex-1 zd:min-w-0 zd:px-2 zd:py-1.5 zd:text-left zd:hover:bg-muted/60"
                                                >
                                                    {pendingCount === 0 ? (
                                                        <CheckCircle2 className="zd:h-3.5 zd:w-3.5 zd:shrink-0 zd:text-green-600" />
                                                    ) : (
                                                        <Circle className="zd:h-3 zd:w-3 zd:shrink-0 zd:text-muted-foreground" />
                                                    )}
                                                    {isOpen ? (
                                                        <ChevronDown className="zd:h-3.5 zd:w-3.5 zd:shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="zd:h-3.5 zd:w-3.5 zd:shrink-0" />
                                                    )}
                                                    <span className={cn("zd:font-medium zd:text-xs zd:truncate", pendingCount === 0 && "zd:text-muted-foreground")}>
                                                        {t(item.onboarding.name)}
                                                    </span>
                                                    {pendingCount > 0 && (
                                                        <span className="zd:text-muted-foreground zd:text-[10px] zd:shrink-0">
                                                            {pendingCount}/{item.steps.length}
                                                        </span>
                                                    )}
                                                </button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="zd:shrink-0 zd:h-7 zd:px-1.5 zd:text-[10px]"
                                                    onClick={() => startTour(item)}
                                                >
                                                    <Play className="zd:h-3 zd:w-3 zd:mr-0.5" />
                                                    {t("Tour")}
                                                </Button>
                                            </div>
                                            {isOpen && (
                                                <div className="zd:border-t zd:divide-y zd:divide-border/80">
                                                    {item.steps.map((step) => (
                                                        <div
                                                            key={step.id}
                                                            className={cn(
                                                                "zd:flex zd:items-center zd:gap-2 zd:px-2 zd:py-1.5 zd:min-h-0",
                                                                step.done && "zd:opacity-70"
                                                            )}
                                                        >
                                                            {step.done ? (
                                                                <CheckCircle2 className="zd:h-3.5 zd:w-3.5 zd:shrink-0 zd:text-green-600" />
                                                            ) : (
                                                                <Circle className="zd:h-3 zd:w-3 zd:shrink-0 zd:text-muted-foreground" />
                                                            )}
                                                            <span
                                                                className={cn(
                                                                    "zd:text-xs zd:flex-1 zd:min-w-0 zd:truncate",
                                                                    step.done && "zd:line-through zd:text-muted-foreground"
                                                                )}
                                                            >
                                                                {t(step.title)}
                                                            </span>
                                                            {getStepHref(step.route, org) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="zd:shrink-0 zd:h-6 zd:px-1.5 zd:min-w-0"
                                                                    onClick={() => {
                                                                        const href = getStepHref(step.route, org);
                                                                        if (href) router.push(href);
                                                                    }}
                                                                >
                                                                    <ExternalLink className="zd:h-3 zd:w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {(hasCompletedGroups || showCompleted) && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCompleted((s) => !s)}
                                        className="zd:text-[10px] zd:text-muted-foreground zd:hover:text-foreground zd:py-1 zd:text-left"
                                    >
                                        {showCompleted ? t("Hide completed") : t("Show completed")}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
            {/* Spotlight (visual only) and tour popover when touring. No overlay blocking – user can click anywhere; checklist stays collapsible. */}
            {tour && spotlightRect && currentTourStep && (
                <>
                    <div
                        className="zd:fixed zd:inset-0 zd:z-[100] zd:pointer-events-none"
                        data-onboarding-tour-layer
                    >
                        <div
                            className="zd:absolute zd:rounded-xl zd:shadow-[0_0_0_9999px_rgba(0,0,0,0.05)] zd:bg-transparent"
                            style={{
                                top: spotlightRect.top - 8,
                                left: spotlightRect.left - 8,
                                width: spotlightRect.width + 16,
                                height: spotlightRect.height + 16,
                            }}
                        />
                    </div>
                    <div
                        className="zd:fixed zd:z-[110] zd:max-w-sm zd:w-full zd:pointer-events-auto"
                        data-onboarding-tour-layer
                        style={{
                            top: (() => {
                                const viewportHeight = window.innerHeight || 0;
                                const estHeight = 220; // approximate popover height
                                const margin = 16;
                                const belowTop = spotlightRect.bottom + margin;
                                const aboveTop = spotlightRect.top - estHeight - margin;
                                const canPlaceBelow = belowTop + estHeight <= viewportHeight - margin;
                                if (canPlaceBelow) {
                                    return Math.max(belowTop, margin);
                                }
                                return Math.max(Math.min(aboveTop, viewportHeight - estHeight - margin), margin);
                            })(),
                            left: (() => {
                                const viewportWidth = window.innerWidth || 0;
                                const estWidth = 320;
                                const margin = 16;
                                const ideal = spotlightRect.left;
                                const clampedLeft = Math.max(ideal, margin);
                                return Math.min(clampedLeft, viewportWidth - estWidth - margin);
                            })(),
                        }}
                    >
                        <div className="zd:rounded-xl zd:border zd:bg-background zd:shadow-xl zd:p-4">
                            {tourSteps.length > 1 && (
                                <div className="zd:flex zd:gap-1 zd:mb-3">
                                    {tourSteps.map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "zd:h-1 zd:flex-1 zd:rounded-full zd:transition-colors",
                                                i <= tour.stepIndex
                                                    ? "zd:bg-primary"
                                                    : "zd:bg-muted"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="zd:flex zd:items-start zd:justify-between zd:gap-3">
                                <div>
                                    <div className="zd:text-sm zd:font-medium">
                                        {t(currentTourStep.title)}
                                    </div>
                                    {currentTourStep.description && (
                                        <p className="zd:text-xs zd:text-muted-foreground zd:mt-1">
                                            {t(currentTourStep.description)}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="zd:shrink-0 zd:-mt-1 zd:rounded-full zd:hover:bg-muted"
                                    onClick={closeTour}
                                    aria-label={t("Close")}
                                >
                                    <X className="zd:h-4 zd:w-4" />
                                </Button>
                            </div>
                            <div className="zd:flex zd:items-center zd:justify-between zd:mt-4 zd:gap-2">
                                <div className="zd:flex zd:items-center zd:gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={tour.stepIndex === 0}
                                        onClick={() => {
                                            if (tour.stepIndex === 0) return;
                                            setTour((prev) =>
                                                prev && { ...prev, stepIndex: prev.stepIndex - 1 }
                                            );
                                        }}
                                    >
                                        {t("Back")}
                                    </Button>
                                    {openInAppHref && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={openInApp}
                                        >
                                            <ExternalLink className="zd:mr-1 zd:h-3 zd:w-3" />
                                            {t("Open")}
                                        </Button>
                                    )}
                                </div>
                                {currentTourStep?.completion_mode !== "auto_on_click" &&
                                    currentTourStep?.completion_mode !== "auto_when_not_dirty" &&
                                    (currentTourStep?.completion_mode !== "require_value" ||
                                        requireValueHasValue) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={markDoneAndNext}
                                        >
                                            <Check className="zd:mr-1 zd:h-3 zd:w-3" />
                                            {tour && tour.stepIndex + 1 >= tourSteps.length
                                                ? t("Done")
                                                : t("Next")}
                                        </Button>
                                    )}
                            </div>
                            {tourSteps.length > 1 && (
                                <p className="zd:text-muted-foreground zd:text-xs zd:mt-2 zd:text-right">
                                    {t("Step")} {tour.stepIndex + 1} {t("of")}{" "}
                                    {tourSteps.length}
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
