import { useState, useMemo, useRef, useEffect } from "react";
import { useScreens } from "@/features/database";
import { useUrlState } from "@/features/url-state";
import { FilterPanel } from "./components/filter-panel";
import { ListView } from "./components/list-view";
import { MapView } from "./components/map-view";
import {
  List,
  Map as MapIcon,
  Columns,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function Explorer() {
  const { data: screens = [], isLoading, error } = useScreens();
  const [state, setState] = useUrlState();

  // Mobile filter accordion collapse state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Custom split view percentage width for ListView on desktop (default 50%)
  const [splitPercent, setSplitPercent] = useState(50);
  const [isResizing, setIsResizing] = useState(false);

  const splitContainerRef = useRef<HTMLDivElement>(null);

  const activeTab =
    state.explorerTab === "map" || state.explorerTab === "split" ? state.explorerTab : "list";
  const setActiveTab = (newTab: "list" | "map" | "split") => setState({ explorerTab: newTab });

  // Draggable Split Divider Logic
  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newPercent = ((mouseMoveEvent.clientX - rect.left) / rect.width) * 100;
      // Lock bounds between 20% and 80%
      setSplitPercent(Math.max(20, Math.min(80, newPercent)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Get unique available standards from the loaded screens
  const availableStandards = useMemo(() => {
    const stds = new Set<string>();
    screens.forEach((s) => {
      s.tech.standards.forEach((std) => stds.add(std));
    });
    return Array.from(stds).sort();
  }, [screens]);

  // Filter and Sort screens based on active query params
  const filteredAndSortedScreens = useMemo(() => {
    let result = [...screens];

    // 1. Search Query
    if (state.search.trim() !== "") {
      const q = state.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.venue.name.toLowerCase().includes(q) ||
          s.venue.location.city.toLowerCase().includes(q) ||
          s.venue.location.country.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      );
    }

    // 2. Standards Filter
    if (state.standards.length > 0) {
      result = result.filter((s) => state.standards.some((std) => s.tech.standards.includes(std)));
    }

    // 3. Movies Profile Filter
    if (state.movies !== "both") {
      result = result.filter((s) => s.moviesType === state.movies || s.moviesType === "both");
    }

    // 4. Sorting
    result.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      // Access nested keys
      if (state.sortBy === "screen.widthMeters") {
        valA = a.dimensions.widthMeters;
        valB = b.dimensions.widthMeters;
      } else if (state.sortBy === "screen.heightMeters") {
        valA = a.dimensions.heightMeters;
        valB = b.dimensions.heightMeters;
      } else if (state.sortBy === "screen.area") {
        valA = a.dimensions.widthMeters * a.dimensions.heightMeters;
        valB = b.dimensions.widthMeters * b.dimensions.heightMeters;
      } else if (state.sortBy === "location.country") {
        valA = a.venue.location.country;
        valB = b.venue.location.country;
      } else {
        // Default to cinemaName
        valA = a.venue.name;
        valB = b.venue.name;
      }

      // Comparison logic
      if (typeof valA === "string" && typeof valB === "string") {
        return state.sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      } else if (typeof valA === "number" && typeof valB === "number") {
        // Numbers
        return state.sortDesc ? valB - valA : valA - valB;
      }
      return 0;
    });

    return result;
  }, [screens, state.search, state.standards, state.movies, state.sortBy, state.sortDesc]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-3 bg-app-bg text-text-primary">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="label-caps text-text-muted">Loading Cinema Database…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-3 p-6 text-center bg-app-bg text-text-primary">
        <div className="text-red-500 font-semibold text-lg">Failed to Load Database</div>
        <p className="text-sm text-text-muted max-w-sm">
          There was an error retrieving the screen size records. Please check your network
          connection and reload.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col md:flex-row overflow-hidden bg-app-bg ${isResizing ? "select-none" : ""}`}
    >
      {/* Desktop Filters Sidebar (Left Column) */}
      <div className="hidden md:block w-72 flex-shrink-0 h-full overflow-y-auto border-r border-app-border p-6 bg-app-surface/20">
        <FilterPanel
          availableStandards={availableStandards}
          filteredScreens={filteredAndSortedScreens}
        />
      </div>

      {/* Explorer Content Column */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        {/* Header Section (Title + Tabs) */}
        <div className="flex flex-col gap-4 p-4 md:px-6 md:py-4 md:pb-3 border-b border-app-border flex-shrink-0 bg-app-surface/10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="label-caps text-text-primary tracking-[0.18em]">Screen Explorer</h2>
              <p className="text-xs text-text-muted mt-1">
                Filter, locate and select cinema screens to compare
              </p>
            </div>

            {/* Underline-style view tabs */}
            <div className="flex items-end gap-0 h-8">
              <button
                onClick={() => setActiveTab("list")}
                className={`flex items-center gap-1.5 px-3 h-full text-xs font-semibold uppercase tracking-[0.10em] cursor-pointer transition-all border-b-2 ${
                  activeTab === "list"
                    ? "border-brand text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setActiveTab("map")}
                className={`flex items-center gap-1.5 px-3 h-full text-xs font-semibold uppercase tracking-[0.10em] cursor-pointer transition-all border-b-2 ${
                  activeTab === "map"
                    ? "border-brand text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map
              </button>
              <button
                onClick={() => setActiveTab("split")}
                className={`hidden md:flex items-center gap-1.5 px-3 h-full text-xs font-semibold uppercase tracking-[0.10em] cursor-pointer transition-all border-b-2 ${
                  activeTab === "split"
                    ? "border-brand text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Split View
              </button>
            </div>
          </div>

          {/* Mobile Collapsible Accordion Filters */}
          <div className="block md:hidden">
            <button
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="w-full flex items-center justify-between px-3 py-2 border border-app-border bg-app-surface text-xs font-semibold uppercase tracking-wider text-text-secondary rounded-none cursor-pointer transition-all"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-brand" />
                Filters
                {(state.standards.length > 0 ||
                  state.search.trim() !== "" ||
                  state.movies !== "both") && (
                  <span className="bg-brand text-white text-[9px] rounded-none w-4 h-4 flex items-center justify-center font-bold">
                    !
                  </span>
                )}
              </span>
              {mobileFiltersOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {mobileFiltersOpen && (
              <div className="mt-2.5 p-4 border border-app-border rounded-none bg-app-surface max-h-[350px] overflow-y-auto">
                <FilterPanel
                  availableStandards={availableStandards}
                  filteredScreens={filteredAndSortedScreens}
                />
              </div>
            )}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 min-h-0 overflow-hidden relative p-4 md:p-6">
          {activeTab === "list" && (
            <div className="h-full w-full overflow-hidden">
              <ListView screens={filteredAndSortedScreens} />
            </div>
          )}
          {activeTab === "map" && (
            <div className="h-full w-full overflow-hidden rounded-none border border-app-border">
              <MapView screens={filteredAndSortedScreens} />
            </div>
          )}
          {activeTab === "split" && (
            <div
              ref={splitContainerRef}
              className="hidden md:flex flex-row h-full w-full relative overflow-hidden rounded-none border border-app-border bg-app-bg"
            >
              {/* Left Side: ListView */}
              <div
                style={{ width: `${splitPercent}%` }}
                className="h-full min-w-[20%] max-w-[80%] overflow-hidden flex flex-col p-4 bg-app-bg"
              >
                <ListView screens={filteredAndSortedScreens} />
              </div>

              {/* Draggable Divider Line */}
              <div
                onMouseDown={startResizing}
                className={`w-1.5 h-full cursor-col-resize hover:bg-brand/50 active:bg-brand transition-colors bg-app-border shrink-0 flex items-center justify-center relative group z-10 ${
                  isResizing ? "bg-brand" : ""
                }`}
              >
                {/* Visual Drag Handle */}
                <div className="w-0.5 h-8 bg-text-disabled rounded-none group-hover:bg-white group-active:bg-white transition-colors" />
              </div>

              {/* Right Side: MapView */}
              <div className="flex-1 h-full overflow-hidden relative">
                <MapView screens={filteredAndSortedScreens} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
