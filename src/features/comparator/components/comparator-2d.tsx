import { useMemo, useState, useRef, useEffect } from "react";
import { type CinemaScreen } from "@/features/database";
import { type CustomScreen } from "@/features/url-state";
import { calculateMaskedDimensions } from "../utils/mask-calc";
import { Mannequin2D } from "./mannequin-2d";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TheatreSheet } from "@/features/theatre-sheet";
import { RefreshCw, Move } from "lucide-react";
import { useTheme } from "@/features/theme";

const SCREEN_FILL_DARK = "rgba(255, 255, 255, 0.055)";
const SCREEN_FILL_LIGHT = "rgba(0, 0, 0, 0.02)";
const SCREEN_STROKE_STACK_DARK = "rgba(255, 255, 255, 0.30)";
const SCREEN_STROKE_NORMAL_DARK = "rgba(255, 255, 255, 0.48)";
const SCREEN_STROKE_STACK_LIGHT = "rgba(0, 0, 0, 0.15)";
const SCREEN_STROKE_NORMAL_LIGHT = "rgba(0, 0, 0, 0.35)";

interface Comparator2DProps {
  selectedDbScreens: CinemaScreen[];
  customScreens: CustomScreen[];
  order?: string[];
  layout: "horizontal" | "vertical" | "stacked";
  mask: string;
  maskMode: string;
  showLabels: boolean;
  showArea: boolean;
  showMannequin: boolean;
}

interface RenderItem {
  id: string;
  name: string;
  width: number;
  height: number;
  isCustom: boolean;
  originalWidth: number;
  originalHeight: number;
}

export function Comparator2D({
  selectedDbScreens,
  customScreens,
  order,
  layout,
  mask,
  maskMode,
  showLabels,
  showArea,
  showMannequin,
}: Comparator2DProps) {
  const { resolvedTheme } = useTheme();
  // SVG Workspace dimensions
  const svgWidth = 1000;
  const svgHeight = 550;
  const margin = 50;
  const spacingMeters = 4; // 4 meters spacing between screens

  // Minimum sizes to keep labels readable without overlapping (in pixels/SVG units)
  const LAYOUT_MIN_WIDTH_HORIZONTAL = 70;
  const LAYOUT_MIN_HEIGHT_VERTICAL = 20;
  const LAYOUT_MIN_WIDTH_STACKED_INNER = 120;

  // Floor level vertical adjustment (shift up in horizontal/stacked layouts)
  const FLOOR_SHIFT_Y = 30;

  // Minimum screen dimensions required to render the area text inside the screen box.
  // Screens smaller than these dimensions will render the area text outside with a leader pointer line.
  const MIN_WIDTH_FOR_INSIDE_AREA = 110;
  const MIN_HEIGHT_FOR_INSIDE_AREA = 60;

  // Pan and Zoom States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDist, setTouchDist] = useState(0);

  const [prevLayout, setPrevLayout] = useState(layout);
  if (layout !== prevLayout) {
    setPrevLayout(layout);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Mouse Handlers for Pan
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Native Wheel Handler Ref to avoid stale closures while keeping the listener non-passive
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(undefined);

  useEffect(() => {
    wheelHandlerRef.current = (e: WheelEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      e.preventDefault(); // Block browser page-scrolling while mouse is over comparator

      if (e.ctrlKey) {
        // Trackpad pinch-zoom or Ctrl+scroll: Zoom relative to pointer position
        const zoomFactor = 1.08;
        let nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        nextZoom = Math.max(0.15, Math.min(12, nextZoom));

        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const targetX = (mouseX - pan.x) / zoom;
        const targetY = (mouseY - pan.y) / zoom;

        const nextPanX = mouseX - targetX * nextZoom;
        const nextPanY = mouseY - targetY * nextZoom;

        setZoom(nextZoom);
        setPan({ x: nextPanX, y: nextPanY });
      } else {
        // 2-finger trackpad swipe or mouse wheel scroll: Pan canvas X and Y
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
  }, [zoom, pan]);

  const hasActiveScreens = selectedDbScreens.length + customScreens.length > 0;

  // Bind native non-passive wheel and gesture listeners to the container when it mounts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const listener = (e: WheelEvent) => {
      if (wheelHandlerRef.current) {
        wheelHandlerRef.current(e);
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener("wheel", listener, { passive: false });
    container.addEventListener("gesturestart", preventGesture);
    container.addEventListener("gesturechange", preventGesture);

    return () => {
      container.removeEventListener("wheel", listener);
      container.removeEventListener("gesturestart", preventGesture);
      container.removeEventListener("gesturechange", preventGesture);
    };
  }, [hasActiveScreens]);

  // Touch Handlers for Pinch & Zoom (Mobile, Tablets, Vision Pro)
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const t = e.touches[0];
      setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      setTouchDist(dist);

      // Touch gesture coordinates initialized
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      setPan({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (touchDist === 0) return;

      const factor = dist / touchDist;
      let nextZoom = zoom * factor;
      nextZoom = Math.max(0.15, Math.min(12, nextZoom));

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const targetX = (midX - pan.x) / zoom;
      const targetY = (midY - pan.y) / zoom;

      const nextPanX = midX - targetX * nextZoom;
      const nextPanY = midY - targetY * nextZoom;

      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
      setTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDist(0);
  };

  // Combine database screens and custom screens into a unified list
  const activeItems: RenderItem[] = useMemo(() => {
    const dbItems = selectedDbScreens.map((s) => ({
      id: s.id,
      name: `${s.venue.name} (${s.name})`,
      width: s.dimensions.widthMeters,
      height: s.dimensions.heightMeters,
      isCustom: false,
      originalWidth: s.dimensions.widthMeters,
      originalHeight: s.dimensions.heightMeters,
    }));

    const customItems = customScreens.map((s) => ({
      id: s.id,
      name: s.name || "Custom Screen",
      width: s.width,
      height: s.height,
      isCustom: true,
      originalWidth: s.width,
      originalHeight: s.height,
    }));

    const combined = [...dbItems, ...customItems];

    if (order && order.length > 0) {
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
  }, [selectedDbScreens, customScreens, order]);

  // Scale factor and coordinates calculation based on layout
  const layoutData = useMemo(() => {
    if (activeItems.length === 0) return null;

    // Determine total physical footprint
    let totalPhysicalW: number;
    let totalPhysicalH: number;
    let maxPhysicalW = 0;
    let maxPhysicalH = 0;

    const activeItemsWithCrops = activeItems.map((item) => {
      const maskCalc = calculateMaskedDimensions(item.width, item.height, mask);
      const effectiveW = maskMode === "crop" ? maskCalc.width : item.width;
      const effectiveH = maskMode === "crop" ? maskCalc.height : item.height;
      return {
        ...item,
        effectiveW,
        effectiveH,
        maskCalc,
      };
    });

    activeItemsWithCrops.forEach((item) => {
      maxPhysicalW = Math.max(maxPhysicalW, item.effectiveW);
      maxPhysicalH = Math.max(maxPhysicalH, item.effectiveH);
    });

    // Stacked layout: Sort by area descending so largest renders in background
    const itemsToRender =
      layout === "stacked"
        ? [...activeItemsWithCrops].sort(
            (a, b) => b.effectiveW * b.effectiveH - a.effectiveW * a.effectiveH,
          )
        : activeItemsWithCrops;

    if (layout === "horizontal") {
      // Sum widths + spacing
      totalPhysicalW =
        itemsToRender.reduce((sum, item) => sum + item.effectiveW, 0) +
        spacingMeters * (itemsToRender.length - 1);
      totalPhysicalH = maxPhysicalH;

      // Reserve space for mannequin on the left if toggled
      if (showMannequin) {
        totalPhysicalW += 1.5 + spacingMeters; // 1.5m mannequin envelope
      }
    } else if (layout === "vertical") {
      // Sum heights + spacing
      totalPhysicalW = maxPhysicalW;
      totalPhysicalH =
        itemsToRender.reduce((sum, item) => sum + item.effectiveH, 0) +
        spacingMeters * (itemsToRender.length - 1);

      if (showMannequin) {
        totalPhysicalH += 2 + spacingMeters; // reserve 2m at the bottom
      }
    } else {
      // Stacked: Overlayed on top of each other, anchored at bottom center
      totalPhysicalW = maxPhysicalW;
      totalPhysicalH = maxPhysicalH;

      if (showMannequin) {
        totalPhysicalW += 3; // padding at side for mannequin
      }
    }

    // Calculate available height (reduced for floor shifting in horizontal/stacked layouts)
    const availableHeight =
      layout === "vertical" ? svgHeight - margin * 2 : svgHeight - margin * 2 - FLOOR_SHIFT_Y;

    // Calculate scale factor (pixels per meter)
    let pxPerMeter = Math.min(
      (svgWidth - margin * 2) / totalPhysicalW,
      availableHeight / totalPhysicalH,
    );

    // Adjust scale factor if the minimum label width on Horizontal layout exceeds available space
    if (layout === "horizontal" && showLabels) {
      const spacingPx = spacingMeters * pxPerMeter;
      const mannequinAlloc = showMannequin ? (1.5 + spacingMeters) * pxPerMeter : 0;
      const totalWidthPx =
        itemsToRender.reduce(
          (sum, item) => sum + Math.max(LAYOUT_MIN_WIDTH_HORIZONTAL, item.effectiveW * pxPerMeter),
          0,
        ) +
        spacingPx * (itemsToRender.length - 1) +
        mannequinAlloc;
      const availableWidthPx = svgWidth - margin * 2;
      if (totalWidthPx > availableWidthPx) {
        const adjustment = availableWidthPx / totalWidthPx;
        pxPerMeter = pxPerMeter * adjustment;
      }
    }

    // Adjust scale factor if the minimum label height on Vertical layout exceeds available space
    if (layout === "vertical" && showLabels) {
      const spacingPx = spacingMeters * pxPerMeter;
      const mannequinAlloc = showMannequin ? (2 + spacingMeters) * pxPerMeter : 0;
      const totalHeightPx =
        itemsToRender.reduce(
          (sum, item) => sum + Math.max(LAYOUT_MIN_HEIGHT_VERTICAL, item.effectiveH * pxPerMeter),
          0,
        ) +
        spacingPx * (itemsToRender.length - 1) +
        mannequinAlloc;
      const availableHeightPx = svgHeight - margin * 2;
      if (totalHeightPx > availableHeightPx) {
        const adjustment = availableHeightPx / totalHeightPx;
        pxPerMeter = pxPerMeter * adjustment;
      }
    }

    let currentX = showMannequin ? margin + (1.5 + spacingMeters) * pxPerMeter : margin;
    let currentY = margin;
    const spacingPx = spacingMeters * pxPerMeter;

    const renderedBoxes = itemsToRender.map((item) => {
      const wPx = item.effectiveW * pxPerMeter;
      const hPx = item.effectiveH * pxPerMeter;

      let x: number;
      let y: number;
      let labelWidth: number;
      let labelX: number;

      if (layout === "horizontal") {
        const allocatedWPx = showLabels ? Math.max(LAYOUT_MIN_WIDTH_HORIZONTAL, wPx) : wPx;
        labelX = currentX;
        x = currentX;
        y = svgHeight - margin - hPx - FLOOR_SHIFT_Y; // Shifted up to make space for leader line callouts
        labelWidth = allocatedWPx;
        currentX += allocatedWPx + spacingPx;
      } else if (layout === "vertical") {
        const allocatedHPx = showLabels ? Math.max(LAYOUT_MIN_HEIGHT_VERTICAL, hPx) : hPx;
        x = (svgWidth - wPx) / 2;
        y = currentY;
        labelX = x + wPx + 12;
        labelWidth = 600;
        currentY += allocatedHPx + spacingPx;
      } else {
        x = (svgWidth - wPx) / 2;
        y = svgHeight - margin - hPx - FLOOR_SHIFT_Y; // Shifted up to make space for leader line callouts
        labelX = x + 8;
        labelWidth = Math.max(LAYOUT_MIN_WIDTH_STACKED_INNER, wPx - 16);
      }

      return {
        ...item,
        x,
        y,
        wPx,
        hPx,
        labelWidth,
        labelX,
      };
    });

    // Compute mannequin coordinates
    let mannequinX: number;
    let mannequinY: number;

    if (layout === "horizontal") {
      mannequinX = margin + 0.75 * pxPerMeter;
      mannequinY = svgHeight - margin - FLOOR_SHIFT_Y; // Shifted up to match shifted screen floor
    } else if (layout === "vertical") {
      mannequinX = svgWidth / 2;
      mannequinY = svgHeight - margin + 20; // placed at bottom
    } else {
      // Stacked: place mannequin to the right of the stacked boxes
      mannequinX = (svgWidth + maxPhysicalW * pxPerMeter) / 2 + 1.2 * pxPerMeter;
      mannequinY = svgHeight - margin - FLOOR_SHIFT_Y; // Shifted up to match shifted screen floor
    }

    return {
      pxPerMeter,
      renderedBoxes,
      mannequin: { x: mannequinX, y: mannequinY },
    };
  }, [activeItems, layout, showMannequin, mask, maskMode, showLabels]);

  const isAnyScreenVisible = useMemo(() => {
    if (!layoutData || layoutData.renderedBoxes.length === 0) return false;
    return layoutData.renderedBoxes.some((box) => {
      const screenX1 = pan.x + box.x * zoom;
      const screenX2 = screenX1 + box.wPx * zoom;
      const screenY1 = pan.y + box.y * zoom;
      const screenY2 = screenY1 + box.hPx * zoom;
      return screenX1 < svgWidth && screenX2 > 0 && screenY1 < svgHeight && screenY2 > 0;
    });
  }, [layoutData, pan, zoom, svgWidth, svgHeight]);

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-app-border h-full min-h-[300px] p-6 text-center bg-app-bg">
        {/* Minimal screen icon */}
        <svg
          className="w-10 h-10 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="2" y="3" width="20" height="14" rx="1" strokeWidth="1.2" />
          <path d="M8 21h8M12 17v4" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="label-caps text-text-muted">No Screens Selected</span>
        <p className="text-xs text-text-muted/70 max-w-xs mt-2">
          Search and select screens in the Explorer below to visualise them here.
        </p>
      </div>
    );
  }

  if (!layoutData) return null;

  const { pxPerMeter, renderedBoxes, mannequin } = layoutData;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col min-h-0 bg-app-bg overflow-hidden"
    >
      {/* Zoom / Pan Action Overlays */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={handleResetView}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="absolute top-3 left-3 z-10 pointer-events-none px-2 py-1 text-[10px] text-text-muted flex items-center gap-1.5 font-medium">
        <Move className="w-3 h-3" /> Drag to pan · Scroll to zoom
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full flex-1 min-h-0 select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Defs for Grid Pattern */}
        <defs>
          <pattern
            id="grid2d"
            width={pxPerMeter * 5}
            height={pxPerMeter * 5}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${pxPerMeter * 5} 0 L 0 0 0 ${pxPerMeter * 5}`}
              fill="none"
              className="stroke-black/[0.04] dark:stroke-white/[0.025]"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Outer Grid (placed inside pan group so it scales with boxes) */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Huge canvas rectangle filled with grid */}
          <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid2d)" />

          {/* Render Screens */}
          {renderedBoxes.map((box) => {
            // Calculate aspect ratio crop math
            const maskCalc = box.maskCalc;
            const cropWPx = maskCalc.width * pxPerMeter;
            const cropHPx = maskCalc.height * pxPerMeter;

            // Calculate offsets for drawing masks
            const dxPx = maskMode === "crop" ? 0 : (box.wPx - cropWPx) / 2;
            const dyPx = maskMode === "crop" ? 0 : (box.hPx - cropHPx) / 2;

            const isSelectedInStack = layout === "stacked";

            // Native and Target Aspect Ratio calculations
            const nativeRatio = box.width / box.height;

            return (
              <g key={box.id} className="transition-all duration-300">
                {/* Outer screen shell */}
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.wPx}
                  height={box.hPx}
                  fill={resolvedTheme === "dark" ? SCREEN_FILL_DARK : SCREEN_FILL_LIGHT}
                  stroke={
                    resolvedTheme === "dark"
                      ? isSelectedInStack
                        ? SCREEN_STROKE_STACK_DARK
                        : SCREEN_STROKE_NORMAL_DARK
                      : isSelectedInStack
                        ? SCREEN_STROKE_STACK_LIGHT
                        : SCREEN_STROKE_NORMAL_LIGHT
                  }
                  strokeWidth="1"
                  className="transition-all"
                />

                {/* Aspect Ratio Cropping Dark Overlay Panels */}
                {maskCalc.isMasked && maskMode === "darken" && (
                  <>
                    {/* If Screen is wider than mask -> Pillarbox (Left/Right overlay) */}
                    {nativeRatio > parseFloat(mask) ? (
                      <>
                        {/* Left Pillar */}
                        <rect
                          x={box.x}
                          y={box.y}
                          width={dxPx}
                          height={box.hPx}
                          className="fill-screen-crop-overlay"
                        />
                        {/* Right Pillar */}
                        <rect
                          x={box.x + box.wPx - dxPx}
                          y={box.y}
                          width={dxPx}
                          height={box.hPx}
                          className="fill-screen-crop-overlay"
                        />
                      </>
                    ) : (
                      <>
                        {/* If Screen is taller than mask -> Letterbox (Top/Bottom overlay) */}
                        <rect
                          x={box.x}
                          y={box.y}
                          width={box.wPx}
                          height={dyPx}
                          className="fill-screen-crop-overlay"
                        />
                        {/* Bottom Letterbox */}
                        <rect
                          x={box.x}
                          y={box.y + box.hPx - dyPx}
                          width={box.wPx}
                          height={dyPx}
                          className="fill-screen-crop-overlay"
                        />
                      </>
                    )}

                    {/* Cropped Active Area Border Outline */}
                    <rect
                      x={box.x + dxPx}
                      y={box.y + dyPx}
                      width={cropWPx}
                      height={cropHPx}
                      className="fill-transparent stroke-brand stroke-1.5 stroke-dasharray-[4,2]"
                    />
                  </>
                )}

                {/* Outside Labels with Tooltip (Horizontal, Vertical, Stacked) */}
                {showLabels && (
                  <>
                    {layout === "horizontal" && (
                      <foreignObject
                        x={box.labelX}
                        y={box.y - 50}
                        width={box.labelWidth}
                        height={46}
                        className="overflow-visible"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="w-fit h-full text-left flex flex-col justify-end pointer-events-auto leading-tight cursor-help group"
                              style={{ maxWidth: `${box.labelWidth}px` }}
                            >
                              <span className="font-bold text-[10px] text-text-primary group-hover:text-brand transition-colors line-clamp-2 select-text">
                                {box.name}
                              </span>
                              <div className="font-mono text-[9px] text-text-secondary mt-0.5 select-none truncate leading-normal">
                                {box.width.toFixed(1)}m × {box.height.toFixed(1)}m ·{" "}
                                {(box.width / box.height).toFixed(2)}:1 ·{" "}
                                {(box.width * box.height).toFixed(0)}m²
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {box.isCustom ? (
                              <TheatreSheet
                                customScreen={{
                                  id: box.id,
                                  name: box.name,
                                  width: box.width,
                                  height: box.height,
                                }}
                              />
                            ) : (
                              <TheatreSheet
                                screen={selectedDbScreens.find((s) => s.id === box.id)}
                              />
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </foreignObject>
                    )}

                    {layout === "vertical" && (
                      <foreignObject
                        x={box.labelX}
                        y={box.y - 3}
                        width={box.labelWidth}
                        height={50}
                        className="overflow-visible"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-max text-left flex flex-col pointer-events-auto leading-tight cursor-help group">
                              <span className="font-bold text-[10px] text-text-primary group-hover:text-brand transition-colors whitespace-nowrap select-text">
                                {box.name}
                              </span>
                              <div className="font-mono text-[9px] text-text-secondary mt-0.5 select-none whitespace-nowrap leading-normal">
                                {box.width.toFixed(1)}m × {box.height.toFixed(1)}m ·{" "}
                                {(box.width / box.height).toFixed(2)}:1 ·{" "}
                                {(box.width * box.height).toFixed(0)}m²
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" align="start">
                            {box.isCustom ? (
                              <TheatreSheet
                                customScreen={{
                                  id: box.id,
                                  name: box.name,
                                  width: box.width,
                                  height: box.height,
                                }}
                              />
                            ) : (
                              <TheatreSheet
                                screen={selectedDbScreens.find((s) => s.id === box.id)}
                              />
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </foreignObject>
                    )}

                    {layout === "stacked" && (
                      <foreignObject
                        x={box.labelX}
                        y={box.y + 8}
                        width={box.labelWidth}
                        height={55}
                        className="overflow-visible"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="w-fit text-left flex flex-col pointer-events-auto leading-tight cursor-help group"
                              style={{ maxWidth: `${box.labelWidth}px` }}
                            >
                              <span className="font-bold text-[10px] text-text-primary group-hover:text-brand transition-colors line-clamp-2 select-text">
                                {box.name}
                              </span>
                              <div className="font-mono text-[9px] text-text-secondary mt-1 select-none truncate leading-normal">
                                {box.width.toFixed(1)}m × {box.height.toFixed(1)}m ·{" "}
                                {(box.width / box.height).toFixed(2)}:1 ·{" "}
                                {(box.width * box.height).toFixed(0)}m²
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {box.isCustom ? (
                              <TheatreSheet
                                customScreen={{
                                  id: box.id,
                                  name: box.name,
                                  width: box.width,
                                  height: box.height,
                                }}
                              />
                            ) : (
                              <TheatreSheet
                                screen={selectedDbScreens.find((s) => s.id === box.id)}
                              />
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </foreignObject>
                    )}
                  </>
                )}

                {/* Center Badge (Aspect Ratio & Area Display) */}
                {showArea &&
                  (() => {
                    const isTinyScreen =
                      box.wPx < MIN_WIDTH_FOR_INSIDE_AREA || box.hPx < MIN_HEIGHT_FOR_INSIDE_AREA;
                    const centerX = box.x + box.wPx / 2;
                    const centerY = box.y + box.hPx / 2;
                    const isMasked = maskCalc.isMasked;
                    const areaText = isMasked
                      ? maskCalc.area.toFixed(0)
                      : (box.width * box.height).toFixed(0);
                    const ratioText = isMasked
                      ? `in ${parseFloat(mask).toFixed(2)}:1`
                      : `${nativeRatio.toFixed(2)}:1`;

                    if (isTinyScreen) {
                      // Determine leader line target coordinates based on layout
                      let endX = centerX;
                      let endY = centerY;
                      let calloutX = centerX;
                      let calloutY = centerY;
                      let calloutW = 120;
                      const calloutH = 40;
                      let alignClass = "items-center text-center";

                      if (layout === "horizontal" || layout === "stacked") {
                        endY = box.y + box.hPx + 15;
                        calloutX = centerX - 60;
                        calloutY = box.y + box.hPx + 16;
                      } else if (layout === "vertical") {
                        endX = box.x - 15;
                        calloutX = box.x - 118;
                        calloutY = centerY - 15;
                        calloutW = 100;
                        alignClass = "items-end text-right pr-1";
                      }

                      return (
                        <>
                          {/* Schematics-style Leader Line */}
                          <line
                            x1={centerX}
                            y1={centerY}
                            x2={endX}
                            y2={endY}
                            className="stroke-brand/50 stroke-[1]"
                          />
                          {/* Anchor Dot */}
                          <circle cx={centerX} cy={centerY} r="2" className="fill-brand" />
                          {/* Floating Callout Badge */}
                          <foreignObject
                            x={calloutX}
                            y={calloutY}
                            width={calloutW}
                            height={calloutH}
                            className="overflow-visible pointer-events-none"
                          >
                            <div
                              className={`w-full h-full flex flex-col ${alignClass} pointer-events-none`}
                            >
                              <div className="flex flex-col leading-tight">
                                <span className="text-[9px] font-bold text-brand">
                                  {areaText} m²
                                </span>
                                <span className="text-[8px] font-medium text-text-muted mt-0.5">
                                  {ratioText}
                                </span>
                              </div>
                            </div>
                          </foreignObject>
                        </>
                      );
                    } else {
                      // Regular centered inside area display
                      return (
                        <foreignObject
                          x={box.x + box.wPx / 2 - 90}
                          y={box.y + box.hPx / 2 - 25}
                          width={180}
                          height={50}
                          className="overflow-visible pointer-events-none"
                        >
                          <div className="w-full h-full flex items-center justify-center pointer-events-none">
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="flex flex-col items-center leading-tight">
                                <span className="text-[10px] font-bold text-brand">
                                  {areaText} m²
                                </span>
                                <span className="text-[8.5px] font-medium text-text-muted mt-0.5">
                                  {ratioText}
                                </span>
                              </div>
                            </div>
                          </div>
                        </foreignObject>
                      );
                    }
                  })()}
              </g>
            );
          })}

          {/* Reference Mannequin */}
          {showMannequin && (
            <g transform={`translate(${mannequin.x}, ${mannequin.y})`}>
              <Mannequin2D pxPerMeter={pxPerMeter} />
            </g>
          )}
        </g>
      </svg>

      {/* Grid scale legend */}
      <div className="absolute bottom-3 right-3 px-2 py-1 text-[10px] font-mono text-text-muted">
        Grid = 5m × 5m
      </div>

      {!isAnyScreenVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <button
            type="button"
            onClick={handleResetView}
            className="pointer-events-auto bg-brand hover:bg-brand-hover text-white px-4 py-2.5 font-semibold text-xs tracking-wider uppercase  shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Screens Out of View — Reset View
          </button>
        </div>
      )}
    </div>
  );
}
