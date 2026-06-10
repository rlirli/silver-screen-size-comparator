import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { ThemeProvider, type Theme } from "@/features/theme";
import { useUrlState } from "@/features/url-state";
import { Comparator } from "@/features/comparator";
import { Explorer } from "@/features/explorer";
import { Sun, Moon, SunMoon, Map, Tv } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

/**
 * ThemeToggle — single icon that cycles Light → Dark → System.
 * Replaces the old labeled 3-button segmented control.
 */
function ThemeToggle() {
  const [state, setState] = useUrlState();
  const theme = (state.theme as string) || "system";

  const options = [
    { value: "light", icon: Sun, title: "Light" },
    { value: "dark", icon: Moon, title: "Dark" },
    { value: "system", icon: SunMoon, title: "System" },
  ];

  const cycle = () => {
    const idx = options.findIndex((o) => o.value === theme);
    const next = options[(idx + 1) % options.length];
    setState({ theme: next.value });
  };

  const current = options.find((o) => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.title}`}
      className="p-2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer rounded"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function MainLayout() {
  const [state, setState] = useUrlState();

  // Custom height/width for Comparator docked modes
  const [compHeight, setCompHeight] = useState(400);
  const [compWidth, setCompWidth] = useState(450);
  const [isResizingComp, setIsResizingComp] = useState(false);

  const compState = state.compState || "small";
  const compPlacement = state.compPlacement || "bottom";
  const mobileTab = state.mobileTab || "explore";
  const selectedCount = state.selected.length + state.custom.length;

  const startResizingComp = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingComp(true);

    const startX = mouseDownEvent.clientX;
    const startY = mouseDownEvent.clientY;
    const startHeight = compHeight;
    const startWidth = compWidth;

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (compPlacement === "bottom") {
        const deltaY = mouseMoveEvent.clientY - startY;
        const newHeight = startHeight - deltaY;
        const maxH = window.innerHeight * 0.75;
        setCompHeight(Math.max(250, Math.min(maxH, newHeight)));
      } else if (compPlacement === "right") {
        const deltaX = mouseMoveEvent.clientX - startX;
        const newWidth = startWidth - deltaX;
        const maxW = window.innerWidth * 0.6;
        setCompWidth(Math.max(300, Math.min(maxW, newWidth)));
      } else {
        // left
        const deltaX = mouseMoveEvent.clientX - startX;
        const newWidth = startWidth + deltaX;
        const maxW = window.innerWidth * 0.6;
        setCompWidth(Math.max(300, Math.min(maxW, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingComp(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col bg-app-bg text-text-primary transition-colors duration-200 ${
        isResizingComp ? "select-none" : ""
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="hidden md:block h-14 border-b border-app-border bg-app-surface/85 backdrop-blur-md flex-shrink-0 z-40">
        <div className="h-full px-4 lg:px-8 flex items-center justify-between">
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <h1 className="label-caps text-text-primary tracking-[0.20em]">Silver Screen</h1>
            <span className="h-3.5 w-px bg-app-border shrink-0" />
            <span className="label-caps text-text-muted hidden sm:block">Size Comparator</span>
          </div>
          {/* Single-icon theme toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main Layout Body ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        {/* DESKTOP VIEWPORT LAYOUT */}
        <div className="hidden md:flex flex-1 overflow-hidden relative w-full h-full">
          {compState === "fullscreen" ? (
            <div className="absolute inset-0 z-30 bg-app-bg overflow-hidden">
              <Comparator />
            </div>
          ) : (
            <div
              className={`flex-1 flex overflow-hidden w-full h-full ${
                compPlacement === "bottom"
                  ? "flex-col"
                  : compPlacement === "right"
                    ? "flex-row"
                    : "flex-row-reverse"
              }`}
            >
              {/* Explorer Panel */}
              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <Explorer />
              </div>

              {/* Draggable Divider Line / Resizer */}
              {compState !== "hidden" && (
                <div
                  onMouseDown={startResizingComp}
                  className={`bg-app-border shrink-0 hover:bg-brand/50 active:bg-brand transition-colors z-10 ${
                    compPlacement === "bottom"
                      ? "h-1.5 w-full cursor-row-resize"
                      : "w-1.5 h-full cursor-col-resize"
                  }`}
                />
              )}

              {/* Comparator Panel */}
              {compState !== "hidden" && (
                <div
                  style={{
                    height: compPlacement === "bottom" ? `${compHeight}px` : "100%",
                    width: compPlacement !== "bottom" ? `${compWidth}px` : "100%",
                  }}
                  className="shrink-0 bg-app-surface overflow-hidden"
                >
                  <div className="w-full h-full overflow-hidden">
                    <Comparator />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop Restore Handles when Hidden (Square corners, prestige design) */}
          {compState === "hidden" && (
            <>
              {compPlacement === "bottom" && (
                <button
                  onClick={() => setState({ compState: "small" })}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-brand text-white px-4 py-2 shadow-lg hover:bg-brand/90 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer border border-brand"
                >
                  <Tv className="w-4 h-4" />
                  Show Comparator ({selectedCount})
                </button>
              )}
              {compPlacement === "right" && (
                <button
                  onClick={() => setState({ compState: "small" })}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-brand text-white px-2 py-4 shadow-lg hover:bg-brand/90 transition-all flex flex-row items-center gap-2 text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] cursor-pointer border-t border-b border-l border-brand"
                >
                  <Tv className="w-3.5 h-3.5 rotate-90" />
                  <span>Show Comparator ({selectedCount})</span>
                </button>
              )}
              {compPlacement === "left" && (
                <button
                  onClick={() => setState({ compState: "small" })}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-brand text-white px-2 py-4 shadow-lg hover:bg-brand/90 transition-all flex flex-row-reverse items-center gap-2 text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] cursor-pointer border-t border-b border-r border-brand"
                >
                  <Tv className="w-3.5 h-3.5 text-white -rotate-90" />
                  <span className="rotate-180">Show Comparator ({selectedCount})</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* MOBILE VIEWPORT LAYOUT */}
        <div className="flex md:hidden flex-1 flex-col overflow-hidden w-full h-full pb-12">
          <div className="flex-1 overflow-y-auto min-h-0">
            {mobileTab === "explore" ? (
              <Explorer />
            ) : (
              <div className="w-full h-full overflow-hidden">
                <Comparator />
              </div>
            )}
          </div>

          {/* Sticky bottom mobile navigation */}
          <nav className="fixed bottom-0 left-0 right-0 h-12 border-t border-app-border bg-app-surface/90 backdrop-blur-md flex items-center justify-between px-4 z-45">
            <div className="w-8 shrink-0" />
            <div className="flex items-center gap-6 h-full justify-center">
              <button
                onClick={() => setState({ mobileTab: "explore" })}
                className={`flex flex-row items-center justify-center gap-2 h-full cursor-pointer transition-all ${
                  mobileTab === "explore"
                    ? "text-brand"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Map className="w-[16px] h-[16px]" strokeWidth={1.25} />
                <span className="label-caps text-[10px] tracking-[0.18em] font-medium">
                  Explore
                </span>
              </button>
              <button
                onClick={() => setState({ mobileTab: "compare" })}
                className={`flex flex-row items-center justify-center gap-2 h-full cursor-pointer transition-all ${
                  mobileTab === "compare"
                    ? "text-brand"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Tv className="w-[16px] h-[16px]" strokeWidth={1.25} />
                <span className="label-caps text-[10px] tracking-[0.18em] font-medium">
                  Compare{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </span>
              </button>
            </div>
            <div className="flex items-center justify-end w-8 shrink-0">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <TooltipProvider delayDuration={150}>
          <AppWithTheme />
        </TooltipProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}

function AppWithTheme() {
  const [state] = useUrlState();
  return (
    <ThemeProvider theme={(state.theme as Theme) || "system"}>
      <MainLayout />
    </ThemeProvider>
  );
}
