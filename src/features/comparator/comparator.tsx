import { useState, useEffect, useRef, useMemo } from "react";
import { useScreens } from "@/features/database";
import { useUrlState, type CustomScreen as CustomScreenType } from "@/features/url-state";
import { Comparator2DCanvas } from "./components/comparator-2d-canvas";
import { Comparator3D } from "./components/comparator-3d";
import { CustomScreen } from "./components/custom-screen";
import {
  Plus,
  X,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Camera,
} from "lucide-react";

export function Comparator() {
  const { data: screens = [] } = useScreens();
  const [state, setState] = useUrlState();
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const wasNarrowRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set initial width
    const rect = containerRef.current.getBoundingClientRect();
    setWidth(rect.width);
    const isNarrow = rect.width < 600;
    setIsMinimized(isNarrow);
    wasNarrowRef.current = isNarrow;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (width === null) return;
    const isNarrow = width < 600;
    if (wasNarrowRef.current !== isNarrow) {
      setIsMinimized(isNarrow);
      wasNarrowRef.current = isNarrow;
    }
  }, [width]);

  const compState = state.compState || "small";
  const compPlacement = state.compPlacement || "bottom";

  // Map selected IDs to screen objects
  const selectedDbScreens = screens.filter((s) => state.selected.includes(s.id));

  // Sync state.order with state.selected and state.custom
  useEffect(() => {
    const currentOrder = state.order || [];
    const allSelectedIds = [...state.selected, ...state.custom.map((s) => s.id)];

    // 1. Remove IDs from order that are no longer in allSelectedIds
    let newOrder = currentOrder.filter((id) => allSelectedIds.includes(id));

    // 2. Add IDs to order that are in allSelectedIds but not in order
    const missingIds = allSelectedIds.filter((id) => !newOrder.includes(id));
    if (missingIds.length > 0) {
      newOrder = [...newOrder, ...missingIds];
    }

    // Only update if there is a difference to avoid infinite loop
    const hasChanged =
      newOrder.length !== currentOrder.length ||
      newOrder.some((val, idx) => val !== currentOrder[idx]);

    if (hasChanged) {
      setState({ order: newOrder });
    }
  }, [state.selected, state.custom, state.order, setState]);

  // Combine database screens and custom screens into a unified, ordered list
  const activeItems = useMemo(() => {
    const dbItems = selectedDbScreens.map((s) => ({
      id: s.id,
      name: s.venue.name,
      fullName: `${s.venue.name} (${s.name})`,
      isCustom: false,
      width: s.dimensions.widthMeters,
      height: s.dimensions.heightMeters,
    }));

    const customItems = state.custom.map((s) => ({
      id: s.id,
      name: s.name || "Custom Screen",
      fullName: s.name || "Custom Screen",
      isCustom: true,
      width: s.width,
      height: s.height,
    }));

    const combined = [...dbItems, ...customItems];

    // Sort according to state.order
    const order = state.order || [];
    if (order.length > 0) {
      combined.sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }
    return combined;
  }, [selectedDbScreens, state.custom, state.order]);

  // Drag and drop states & handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newItems = [...activeItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    // Update state.order with the new sequence of IDs
    const newOrder = newItems.map((item) => item.id);
    setState({ order: newOrder });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Synchronise layout with placement changes
  const lastPlacement = useRef(compPlacement);
  const lastState = useRef(compState);

  useEffect(() => {
    const prevPlacement = lastPlacement.current;
    const prevState = lastState.current;

    const wasFullscreen = prevState === "fullscreen";
    const wasBottom = !wasFullscreen && prevPlacement === "bottom";
    const wasLeftRight = !wasFullscreen && (prevPlacement === "left" || prevPlacement === "right");

    const isFullscreen = compState === "fullscreen";
    const isBottom = !isFullscreen && compPlacement === "bottom";
    const isLeftRight = !isFullscreen && (compPlacement === "left" || compPlacement === "right");

    // Transition from fullscreen or bottom to left/right dock
    if ((wasFullscreen || wasBottom) && isLeftRight) {
      if (state.layout === "horizontal") {
        setState({ layout: "vertical" });
      }
    }
    // Transition from fullscreen or left/right to bottom dock
    else if ((wasFullscreen || wasLeftRight) && isBottom) {
      if (state.layout === "vertical") {
        setState({ layout: "horizontal" });
      }
    }

    lastPlacement.current = compPlacement;
    lastState.current = compState;
  }, [compPlacement, compState, state.layout, setState]);

  const handleAddCustomScreen = (name: string, width: number, height: number) => {
    const newScreen: CustomScreenType = {
      id: `custom-${Date.now()}`,
      name,
      width,
      height,
    };
    setState({ custom: [...state.custom, newScreen] });
  };

  const handleRemoveCustomScreen = (id: string) => {
    setState({ custom: state.custom.filter((x) => x.id !== id) });
  };

  const handleRemoveDbScreen = (id: string) => {
    setState({ selected: state.selected.filter((x) => x !== id) });
  };

  const handleRemoveAll = () => {
    setState({ selected: [], custom: [], order: [] });
  };

  const handleExportImage = async () => {
    if (!containerRef.current) return;

    const viewport = containerRef.current.querySelector(".canvas-viewport");
    if (!viewport) {
      alert("Canvas viewport container not found");
      return;
    }

    const getTransformScale = (el: HTMLElement | null) => {
      if (!el) return 1;
      const style = window.getComputedStyle(el);
      const transform = style.transform || style.webkitTransform;
      if (!transform || transform === "none") return 1;

      const matrix = transform.match(/^matrix\((.+)\)$/);
      if (matrix) {
        const values = matrix[1].split(",");
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        return Math.sqrt(a * a + b * b);
      }

      const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
      if (matrix3d) {
        const values = matrix3d[1].split(",");
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        const c = parseFloat(values[2]);
        return Math.sqrt(a * a + b * b + c * c);
      }

      return 1;
    };

    if (state.view === "3d") {
      // 3D Canvas export
      const canvas = viewport.querySelector("canvas");
      if (!canvas) {
        alert("3D visualizer canvas not found");
        return;
      }
      try {
        const canvasRect = canvas.getBoundingClientRect();
        const width = canvas.clientWidth || 1000;
        const height = canvas.clientHeight || 550;

        // Render at 2x resolution for high-DPI display quality
        const scale = 2;

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = width * scale;
        exportCanvas.height = height * scale;

        const ctx = exportCanvas.getContext("2d");
        if (ctx) {
          ctx.scale(scale, scale);

          // Draw solid background color (matching the current theme background)
          const isDark = document.documentElement.classList.contains("dark");
          ctx.fillStyle = isDark ? "#080810" : "#f4f4f6";
          ctx.fillRect(0, 0, width, height);

          // Draw the WebGL canvas content
          ctx.drawImage(canvas, 0, 0, width, height);

          // Draw HTML Labels if enabled
          if (state.showLabels) {
            const labelDivs = viewport.querySelectorAll(
              ".r3f-label-overlay",
            ) as NodeListOf<HTMLElement>;
            labelDivs.forEach((labelDiv) => {
              const rect = labelDiv.getBoundingClientRect();
              const x = rect.left - canvasRect.left;
              const y = rect.top - canvasRect.top;

              // Parse parent's perspective zoom transform scale
              const tScale = getTransformScale(labelDiv.parentElement);

              const titleEl = labelDiv.querySelector(".text-text-primary") as HTMLElement | null;
              const descEl = labelDiv.querySelector(".text-text-secondary") as HTMLElement | null;

              if (titleEl) {
                const titleStyle = window.getComputedStyle(titleEl);
                const fontSize = parseFloat(titleStyle.fontSize) || 12;
                ctx.font = `${titleStyle.fontWeight} ${fontSize * tScale}px ${titleStyle.fontFamily}`;
                ctx.fillStyle = titleStyle.color;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(titleEl.textContent || "", x, y);
              }

              if (descEl) {
                const descStyle = window.getComputedStyle(descEl);
                const fontSize = parseFloat(descStyle.fontSize) || 10;
                ctx.font = `${descStyle.fontWeight} ${fontSize * tScale}px ${descStyle.fontFamily}`;
                ctx.fillStyle = descStyle.color;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(descEl.textContent || "", x, y + 16 * tScale);
              }
            });
          }

          // Draw Area overlays if enabled
          if (state.showArea) {
            const areaDivs = viewport.querySelectorAll(
              ".r3f-area-overlay",
            ) as NodeListOf<HTMLElement>;
            areaDivs.forEach((areaDiv) => {
              const rect = areaDiv.getBoundingClientRect();
              const x = rect.left - canvasRect.left;
              const y = rect.top - canvasRect.top;
              const w = rect.width;

              const tScale = getTransformScale(areaDiv.parentElement);

              const areaEl = areaDiv.querySelector(".text-brand") as HTMLElement | null;
              const ratioEl = areaDiv.querySelector(".text-text-secondary") as HTMLElement | null;

              if (areaEl) {
                const areaStyle = window.getComputedStyle(areaEl);
                const fontSize = parseFloat(areaStyle.fontSize) || 10;
                ctx.font = `${areaStyle.fontWeight} ${fontSize * tScale}px ${areaStyle.fontFamily}`;
                ctx.fillStyle = areaStyle.color;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(areaEl.textContent || "", x + w / 2, y);
              }

              if (ratioEl) {
                const ratioStyle = window.getComputedStyle(ratioEl);
                const fontSize = parseFloat(ratioStyle.fontSize) || 8.5;
                ctx.font = `${ratioStyle.fontWeight} ${fontSize * tScale}px ${ratioStyle.fontFamily}`;
                ctx.fillStyle = ratioStyle.color;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(ratioEl.textContent || "", x + w / 2, y + 14 * tScale);
              }
            });
          }

          const url = exportCanvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.download = `comparator-3d-${Date.now()}.png`;
          link.href = url;
          link.click();
        }
      } catch (err) {
        console.error("Failed to export 3D view:", err);
        alert("Could not export 3D view as image.");
      }
    } else {
      // 2D Canvas export
      const canvas = viewport.querySelector("canvas");
      if (!canvas) {
        alert("2D visualizer canvas not found");
        return;
      }
      try {
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `comparator-2d-${Date.now()}.png`;
        link.href = url;
        link.click();
      } catch (err) {
        console.error("Failed to export 2D canvas:", err);
        alert("Could not export 2D canvas as image.");
      }
    }
  };

  const aspectMaskOptions = [
    { value: "none", label: "None" },
    { value: "1.43", label: "1.43:1 (IMAX GT / Film)" },
    { value: "1.89", label: "1.89:1 (IMAX Digital)" },
    { value: "2.39", label: "2.39:1 (CinemaScope)" },
    { value: "1.85", label: "1.85:1 (Standard Flat)" },
    { value: "1.777", label: "16:9 (HDTV)" },
  ];

  const totalItemsCount = selectedDbScreens.length + state.custom.length;

  // ── Shared active / inactive class sets for command-strip buttons ──
  const cmdActive = "bg-brand text-white";
  const cmdInactive = "text-text-muted hover:text-text-secondary hover:bg-text-primary/5";
  const cmdBase =
    "px-2 h-6 text-[10px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-all rounded-sm";

  return (
    <div
      ref={containerRef}
      className="@container flex flex-col gap-0 h-full w-full overflow-hidden bg-app-surface text-text-primary pt-4 md:pt-6"
    >
      {/* ── Section header ───────────────────────────────────────── */}
      <div className="flex flex-col @sm:flex-row @sm:items-start @sm:justify-between gap-4 pb-5 flex-shrink-0 px-4 md:px-6">
        <div>
          <h2 className="label-caps text-text-primary tracking-[0.18em]">
            Cinema Screen Comparator
          </h2>
          <p className="text-xs text-text-muted mt-1.5">
            Compare proportions · Apply aspect-ratio masks · Reference scale
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Controls Toggle (Square button) */}
          <button
            type="button"
            title={isMinimized ? "Show Controls" : "Hide Controls"}
            onClick={() => setIsMinimized(!isMinimized)}
            className={`w-8 h-8 flex items-center justify-center border rounded-none cursor-pointer transition-all ${
              !isMinimized
                ? "bg-brand border-brand text-white hover:bg-brand-hover hover:border-brand-hover"
                : "border-app-border-strong bg-transparent text-text-secondary hover:bg-text-primary/4"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Export View Button */}
          {totalItemsCount > 0 && (
            <button
              type="button"
              onClick={handleExportImage}
              title="Export View as Image"
              className="h-8 px-3 flex items-center gap-1.5 border border-app-border-strong bg-transparent text-xs font-semibold text-text-secondary hover:bg-text-primary/4 cursor-pointer transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}

          {/* Desktop Only Dock Controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Placement Selectors */}
            <div className="flex items-stretch h-8 border border-app-border-strong rounded-none overflow-hidden">
              <button
                type="button"
                title="Dock Left"
                onClick={() => setState({ compPlacement: "left", compState: "small" })}
                className={`px-2 flex items-center justify-center cursor-pointer transition-all ${
                  compPlacement === "left" && compState !== "fullscreen"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-text-primary/4"
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
              <div className="w-px bg-app-border-strong shrink-0" />
              <button
                type="button"
                title="Dock Bottom"
                onClick={() => setState({ compPlacement: "bottom", compState: "small" })}
                className={`px-2 flex items-center justify-center cursor-pointer transition-all ${
                  compPlacement === "bottom" && compState !== "fullscreen"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-text-primary/4"
                }`}
              >
                <PanelBottom className="w-3.5 h-3.5" />
              </button>
              <div className="w-px bg-app-border-strong shrink-0" />
              <button
                type="button"
                title="Dock Right"
                onClick={() => setState({ compPlacement: "right", compState: "small" })}
                className={`px-2 flex items-center justify-center cursor-pointer transition-all ${
                  compPlacement === "right" && compState !== "fullscreen"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-text-primary/4"
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Size Selectors */}
            <div className="flex items-stretch h-8 border border-app-border-strong rounded-none overflow-hidden">
              <button
                type="button"
                title={compState === "fullscreen" ? "Exit Fullscreen" : "Fullscreen"}
                onClick={() =>
                  setState({ compState: compState === "fullscreen" ? "small" : "fullscreen" })
                }
                className={`px-2.5 flex items-center justify-center cursor-pointer transition-all ${
                  compState === "fullscreen"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-text-primary/4"
                }`}
              >
                {compState === "fullscreen" ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <div className="w-px bg-app-border-strong shrink-0" />
              <button
                type="button"
                title="Hide Comparator"
                onClick={() => setState({ compState: "hidden" })}
                className="px-2.5 flex items-center justify-center text-text-secondary hover:bg-text-primary/4 cursor-pointer transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Command strip (Flex-wrap layout for narrow container widths) ── */}
      {!isMinimized && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3 border-t border-b border-app-border flex-shrink-0 px-4 md:px-6 bg-app-surface/10">
          {/* Layout Mode */}
          <div className="flex items-center gap-0.5 h-8">
            <span className="label-caps text-text-muted mr-1.5 shrink-0">Layout</span>
            {(state.view === "3d"
              ? (["horizontal", "vertical", "stacked", "surround"] as const)
              : (["horizontal", "vertical", "stacked"] as const)
            ).map((lay) => (
              <button
                key={lay}
                title={lay.charAt(0).toUpperCase() + lay.slice(1)}
                onClick={() => setState({ layout: lay })}
                className={`${cmdBase} ${state.layout === lay ? cmdActive : cmdInactive}`}
              >
                {lay === "horizontal"
                  ? "H"
                  : lay === "vertical"
                    ? "V"
                    : lay === "stacked"
                      ? "S"
                      : "O"}
              </button>
            ))}
          </div>

          {/* View Mode (2D / 3D Toggle) */}
          <div className="flex items-center gap-0.5 h-8">
            <span className="label-caps text-text-muted mr-1.5 shrink-0">View</span>
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  const updates: any = { view: v };
                  if (v === "2d" && state.layout === "surround") {
                    updates.layout = "horizontal";
                  }
                  setState(updates);
                }}
                className={`${cmdBase} ${state.view === v ? cmdActive : cmdInactive}`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Visual Overlays */}
          <div className="flex items-center gap-0.5 h-8">
            <span className="label-caps text-text-muted mr-1.5 shrink-0">Show</span>
            {(
              [
                { key: "showLabels", label: "Labels" },
                { key: "showArea", label: "Area" },
                { key: "showMannequin", label: "Figure" },
              ] as const
            ).map(({ key, label }) => {
              const isOn = state[key] as boolean;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setState({ [key]: !isOn } as Parameters<typeof setState>[0])}
                  className={`${cmdBase} ${isOn ? cmdActive : cmdInactive}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Aspect Ratio Mask */}
          <div className="flex items-center gap-1.5 h-8">
            <span className="label-caps text-text-muted shrink-0 mr-0.5">Mask</span>
            <select
              value={state.mask}
              onChange={(e) => setState({ mask: e.target.value })}
              className="bg-transparent text-xs font-medium text-text-secondary focus:outline-none cursor-pointer max-w-[160px]"
            >
              {aspectMaskOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-app-surface text-text-primary"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Masking Mode */}
          <div className="flex items-center gap-0.5 h-8">
            <span className="label-caps text-text-muted mr-1.5 shrink-0">Mode</span>
            {(
              [
                { value: "darken", label: "Darken" },
                { value: "crop", label: "Crop" },
              ] as const
            ).map((m) => {
              const isSelected = (state.maskMode || "darken") === m.value;
              const isDisabled = state.mask === "none";
              return (
                <button
                  key={m.value}
                  disabled={isDisabled}
                  onClick={() => setState({ maskMode: m.value })}
                  className={`${cmdBase} disabled:opacity-25 disabled:cursor-not-allowed ${
                    isSelected && !isDisabled ? cmdActive : cmdInactive
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected screen chips ────────────────────────────────── */}
      <div
        className={`flex items-center gap-1.5 py-2.5 overflow-x-auto border-b border-app-border px-4 md:px-6 ${isMinimized ? "border-t" : ""}`}
      >
        <span className="label-caps text-text-muted mr-1 shrink-0 flex items-center gap-2">
          Comparing ({totalItemsCount}):
          {totalItemsCount > 3 && (
            <button
              type="button"
              onClick={handleRemoveAll}
              className="text-[10px] font-semibold text-muted-foreground hover:text-red-600 transition-colors uppercase tracking-wider cursor-pointer px-1.5 py-0.5 hover:bg-red-500/10 rounded-none"
            >
              Remove all
            </button>
          )}
        </span>

        {/* "+ Custom" button as the first badge */}
        <button
          type="button"
          onClick={() => setIsCustomDialogOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 border border-brand text-[10px] font-bold text-brand uppercase tracking-[0.12em] hover:bg-brand hover:text-white transition-all cursor-pointer rounded-none shrink-0"
        >
          <Plus className="w-2.5 h-2.5" />
          Custom
        </button>

        {/* Unified draggable chips list */}
        {activeItems.map((s, index) => {
          const isDragged = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const showLeftIndicator = isDragOver && draggedIndex !== null && draggedIndex > index;
          const showRightIndicator = isDragOver && draggedIndex !== null && draggedIndex < index;

          return (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              className={`relative inline-flex items-center gap-1.5 px-2.5 py-0.5 border text-xs font-medium transition-all duration-200 cursor-grab active:cursor-grabbing select-none shrink-0 ${
                isDragged
                  ? "border-brand/40 bg-brand/5 opacity-40 scale-95 border-dashed"
                  : s.isCustom
                    ? "border-brand/35 text-brand bg-brand/5 hover:bg-brand/10"
                    : "border-app-border text-text-secondary bg-text-primary/5 hover:bg-text-primary/10"
              }`}
            >
              {showLeftIndicator && (
                <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-brand animate-pulse" />
              )}
              {showRightIndicator && (
                <div className="absolute -right-1 top-0 bottom-0 w-0.5 bg-brand animate-pulse" />
              )}

              {s.isCustom && (
                <span className="label-caps text-[8px] bg-brand text-white px-1 py-0.5 shrink-0">
                  C
                </span>
              )}
              <span className="truncate max-w-[140px]">{s.name}</span>
              <button
                type="button"
                onClick={() =>
                  s.isCustom ? handleRemoveCustomScreen(s.id) : handleRemoveDbScreen(s.id)
                }
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Primary display canvas (Viewport flexible, no double scrollbars, edge-to-edge) ── */}
      <div className="flex-1 min-h-[200px] overflow-hidden relative border-t border-app-border bg-app-bg canvas-viewport">
        {state.view === "3d" ? (
          <Comparator3D
            selectedDbScreens={selectedDbScreens}
            customScreens={state.custom}
            order={state.order}
            layout={state.layout as "horizontal" | "vertical" | "stacked" | "surround"}
            mask={state.mask}
            maskMode={state.maskMode || "darken"}
            showLabels={state.showLabels}
            showArea={state.showArea}
            showMannequin={state.showMannequin}
          />
        ) : (
          <Comparator2DCanvas
            selectedDbScreens={selectedDbScreens}
            customScreens={state.custom}
            order={state.order}
            layout={
              (state.layout === "surround" ? "horizontal" : state.layout) as
                | "horizontal"
                | "vertical"
                | "stacked"
            }
            mask={state.mask}
            maskMode={state.maskMode || "darken"}
            showLabels={state.showLabels}
            showArea={state.showArea}
            showMannequin={state.showMannequin}
          />
        )}
      </div>

      {/* Custom Dimension Dialog */}
      <CustomScreen
        isOpen={isCustomDialogOpen}
        onClose={() => setIsCustomDialogOpen(false)}
        onAdd={handleAddCustomScreen}
      />
    </div>
  );
}
