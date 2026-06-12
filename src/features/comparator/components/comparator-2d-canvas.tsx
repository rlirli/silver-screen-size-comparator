import { useMemo, useState, useRef, useEffect } from "react";
import { type CinemaScreen } from "@/features/database";
import { type CustomScreen } from "@/features/url-state";
import { calculateMaskedDimensions } from "../utils/mask-calc";
import { TheatreSheet } from "@/features/theatre-sheet";
import { RefreshCw, Move } from "lucide-react";
import { useTheme } from "@/features/theme";

interface Comparator2DCanvasProps {
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

export function Comparator2DCanvas({
  selectedDbScreens,
  customScreens,
  order,
  layout,
  mask,
  maskMode,
  showLabels,
  showArea,
  showMannequin,
}: Comparator2DCanvasProps) {
  const { resolvedTheme } = useTheme();

  // Virtual coordinate boundaries
  const virtualWidth = 1000;
  const virtualHeight = 550;
  const margin = 50;
  const spacingMeters = 4;
  const FLOOR_SHIFT_Y = 30;

  const LAYOUT_MIN_WIDTH_HORIZONTAL = 70;
  const LAYOUT_MIN_HEIGHT_VERTICAL = 20;
  const LAYOUT_MIN_WIDTH_STACKED_INNER = 120;

  const MIN_WIDTH_FOR_INSIDE_AREA = 110;
  const MIN_HEIGHT_FOR_INSIDE_AREA = 60;

  // Pan and Zoom States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDist, setTouchDist] = useState(0);

  // Tooltip hover states
  const [hoveredScreenId, setHoveredScreenId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Whether at least one screen box is within the visible canvas area.
  // Initialised to true so there is no false flash on mount.
  const [screensInView, setScreensInView] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A tick that increments whenever the container is resized, triggering a redraw.
  // We deliberately do NOT store dimensions in state — instead the draw loop reads
  // canvas.clientWidth / canvas.clientHeight directly, so there is no stale initial
  // value that could mismatch the real CSS layout size on first render.
  const [redrawTick, setRedrawTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => setRedrawTick((t) => t + 1));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Reset viewport when layout changes
  const [prevLayout, setPrevLayout] = useState(layout);
  if (layout !== prevLayout) {
    setPrevLayout(layout);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Combine database screens and custom screens into a unified list
  const activeItems: RenderItem[] = useMemo(() => {
    const dbItems = selectedDbScreens.map((s) => ({
      id: s.id,
      name: `${s.venue.name} (${s.venue.location.city})`,
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

    const itemsToRender =
      layout === "stacked"
        ? [...activeItemsWithCrops].sort(
            (a, b) => b.effectiveW * b.effectiveH - a.effectiveW * a.effectiveH,
          )
        : activeItemsWithCrops;

    if (layout === "horizontal") {
      totalPhysicalW =
        itemsToRender.reduce((sum, item) => sum + item.effectiveW, 0) +
        spacingMeters * (itemsToRender.length - 1);
      totalPhysicalH = maxPhysicalH;
      if (showMannequin) {
        totalPhysicalW += 1.5 + spacingMeters;
      }
    } else if (layout === "vertical") {
      totalPhysicalW = maxPhysicalW;
      totalPhysicalH =
        itemsToRender.reduce((sum, item) => sum + item.effectiveH, 0) +
        spacingMeters * (itemsToRender.length - 1);
      if (showMannequin) {
        totalPhysicalH += 2 + spacingMeters;
      }
    } else {
      totalPhysicalW = maxPhysicalW;
      totalPhysicalH = maxPhysicalH;
      if (showMannequin) {
        totalPhysicalW += 3;
      }
    }

    const availableHeight =
      layout === "vertical"
        ? virtualHeight - margin * 2
        : virtualHeight - margin * 2 - FLOOR_SHIFT_Y;

    let pxPerMeter = Math.min(
      (virtualWidth - margin * 2) / totalPhysicalW,
      availableHeight / totalPhysicalH,
    );

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
      const availableWidthPx = virtualWidth - margin * 2;
      if (totalWidthPx > availableWidthPx) {
        pxPerMeter = pxPerMeter * (availableWidthPx / totalWidthPx);
      }
    }

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
      const availableHeightPx = virtualHeight - margin * 2;
      if (totalHeightPx > availableHeightPx) {
        pxPerMeter = pxPerMeter * (availableHeightPx / totalHeightPx);
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
        y = virtualHeight - margin - hPx - FLOOR_SHIFT_Y;
        labelWidth = allocatedWPx;
        currentX += allocatedWPx + spacingPx;
      } else if (layout === "vertical") {
        const allocatedHPx = showLabels ? Math.max(LAYOUT_MIN_HEIGHT_VERTICAL, hPx) : hPx;
        x = (virtualWidth - wPx) / 2;
        y = currentY;
        labelX = x + wPx + 12;
        labelWidth = 600;
        currentY += allocatedHPx + spacingPx;
      } else {
        x = (virtualWidth - wPx) / 2;
        y = virtualHeight - margin - hPx - FLOOR_SHIFT_Y;
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

    let mannequinX: number;
    let mannequinY: number;

    if (layout === "horizontal") {
      mannequinX = margin + 0.75 * pxPerMeter;
      mannequinY = virtualHeight - margin - FLOOR_SHIFT_Y;
    } else if (layout === "vertical") {
      mannequinX = virtualWidth / 2;
      mannequinY = virtualHeight - margin + 20;
    } else {
      mannequinX = (virtualWidth + maxPhysicalW * pxPerMeter) / 2 + 1.2 * pxPerMeter;
      mannequinY = virtualHeight - margin - FLOOR_SHIFT_Y;
    }

    return {
      pxPerMeter,
      renderedBoxes,
      mannequin: { x: mannequinX, y: mannequinY },
    };
  }, [activeItems, layout, showMannequin, mask, maskMode, showLabels]);

  // Reset visibility flag whenever the screen selection / layout changes so the
  // overlay never shows stale state immediately after a selection update.
  useEffect(() => {
    setScreensInView(true);
  }, [layoutData]);

  // Convert mouse event coordinates to virtual space coordinates
  const getVirtualCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const scale = Math.min(w / virtualWidth, h / virtualHeight);
    const dx = (w - virtualWidth * scale) / 2;
    const dy = (h - virtualHeight * scale) / 2;

    const xInVirtual = (mouseX - dx) / scale;
    const yInVirtual = (mouseY - dy) / scale;

    const x = (xInVirtual - pan.x) / zoom;
    const y = (yInVirtual - pan.y) / zoom;

    return { x, y, clientX: mouseX, clientY: mouseY };
  };

  // Mouse Handlers for Pan & Hover details
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getVirtualCoords(e);
    if (!coords) return;

    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      setHoveredScreenId(null);
    } else if (layoutData) {
      // Find which screen box is hovered
      const hoveredBox = layoutData.renderedBoxes.find((box) => {
        return (
          coords.x >= box.x &&
          coords.x <= box.x + box.wPx &&
          coords.y >= box.y &&
          coords.y <= box.y + box.hPx
        );
      });

      if (hoveredBox) {
        setHoveredScreenId(hoveredBox.id);
        setTooltipPos({ x: coords.clientX, y: coords.clientY });
      } else {
        setHoveredScreenId(null);
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    setHoveredScreenId(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const t = e.touches[0];
      setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      setTouchDist(Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      setPan({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (touchDist === 0) return;

      const factor = dist / touchDist;
      const nextZoom = Math.max(0.15, Math.min(12, zoom * factor));

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = midX - rect.left;
        const mouseY = midY - rect.top;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const scale = Math.min(w / virtualWidth, h / virtualHeight);
        const dx = (w - virtualWidth * scale) / 2;
        const dy = (h - virtualHeight * scale) / 2;

        const xInVirtual = (mouseX - dx) / scale;
        const yInVirtual = (mouseY - dy) / scale;

        const targetX = (xInVirtual - pan.x) / zoom;
        const targetY = (yInVirtual - pan.y) / zoom;

        setZoom(nextZoom);
        setPan({
          x: xInVirtual - targetX * nextZoom,
          y: yInVirtual - targetY * nextZoom,
        });
      }
      setTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDist(0);
    setHoveredScreenId(null);
  };

  // Add non-passive wheel zoom/swipe pan listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        const zoomFactor = 1.08;
        let nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        nextZoom = Math.max(0.15, Math.min(12, nextZoom));

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const scale = Math.min(w / virtualWidth, h / virtualHeight);
        const dx = (w - virtualWidth * scale) / 2;
        const dy = (h - virtualHeight * scale) / 2;

        const xInVirtual = (mouseX - dx) / scale;
        const yInVirtual = (mouseY - dy) / scale;

        const targetX = (xInVirtual - pan.x) / zoom;
        const targetY = (yInVirtual - pan.y) / zoom;

        setZoom(nextZoom);
        setPan({
          x: xInVirtual - targetX * nextZoom,
          y: yInVirtual - targetY * nextZoom,
        });
      } else {
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [zoom, pan]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Read true CSS layout size directly from the element — never from stale state.
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    const isDark = resolvedTheme === "dark";
    ctx.fillStyle = isDark ? "#080810" : "#f4f4f6";
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    // Map container pixels to virtual coordinates (1000x550) preserving aspect ratio
    const scale = Math.min(w / virtualWidth, h / virtualHeight);
    const dx = (w - virtualWidth * scale) / 2;
    const dy = (h - virtualHeight * scale) / 2;

    ctx.translate(dx, dy);
    ctx.scale(scale, scale);

    // Apply User Pan & Zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // ── 1. Draw Grid ──
    const gridSpacing = layoutData.pxPerMeter * 5;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.04)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let gx = -5000; gx <= 5000; gx += gridSpacing) {
      ctx.moveTo(gx, -5000);
      ctx.lineTo(gx, 5000);
    }
    for (let gy = -5000; gy <= 5000; gy += gridSpacing) {
      ctx.moveTo(-5000, gy);
      ctx.lineTo(5000, gy);
    }
    ctx.stroke();

    // ── 2. Draw Mannequin Figure ──
    if (showMannequin && layoutData.mannequin) {
      const { x, y } = layoutData.mannequin;
      const heightPx = 1.75 * layoutData.pxPerMeter;
      const widthPx = 0.5 * layoutData.pxPerMeter;

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = isDark ? "#4a8dff" : "#0047bb";
      ctx.globalAlpha = 0.85;

      // Head
      ctx.beginPath();
      ctx.arc(
        0,
        -heightPx + 0.22 * layoutData.pxPerMeter,
        0.11 * layoutData.pxPerMeter,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Neck
      ctx.beginPath();
      ctx.roundRect(
        -0.03 * layoutData.pxPerMeter,
        -heightPx + 0.33 * layoutData.pxPerMeter,
        0.06 * layoutData.pxPerMeter,
        0.05 * layoutData.pxPerMeter,
        0.01 * layoutData.pxPerMeter,
      );
      ctx.fill();

      // Torso & Arms
      ctx.beginPath();
      ctx.moveTo(-widthPx / 2, -heightPx + 0.38 * layoutData.pxPerMeter);
      ctx.bezierCurveTo(
        -widthPx / 2,
        -heightPx + 0.38 * layoutData.pxPerMeter,
        -widthPx / 2 - 0.02 * layoutData.pxPerMeter,
        -heightPx + 0.45 * layoutData.pxPerMeter,
        -widthPx / 2,
        -heightPx + 0.75 * layoutData.pxPerMeter,
      );
      ctx.bezierCurveTo(
        -widthPx / 2 + 0.02 * layoutData.pxPerMeter,
        -heightPx + 0.9 * layoutData.pxPerMeter,
        -widthPx / 2 + 0.06 * layoutData.pxPerMeter,
        -heightPx + 0.9 * layoutData.pxPerMeter,
        -widthPx / 2 + 0.08 * layoutData.pxPerMeter,
        -heightPx + 0.75 * layoutData.pxPerMeter,
      );
      ctx.lineTo(
        -widthPx / 2 + 0.08 * layoutData.pxPerMeter,
        -heightPx + 0.95 * layoutData.pxPerMeter,
      );
      ctx.lineTo(-0.08 * layoutData.pxPerMeter, -heightPx + 0.95 * layoutData.pxPerMeter);
      ctx.lineTo(-0.08 * layoutData.pxPerMeter, -heightPx + 1.05 * layoutData.pxPerMeter);
      ctx.lineTo(-0.08 * layoutData.pxPerMeter, 0);
      ctx.lineTo(-0.01 * layoutData.pxPerMeter, 0);
      ctx.lineTo(-0.01 * layoutData.pxPerMeter, -heightPx + 1.05 * layoutData.pxPerMeter);
      ctx.lineTo(0.01 * layoutData.pxPerMeter, -heightPx + 1.05 * layoutData.pxPerMeter);
      ctx.lineTo(0.01 * layoutData.pxPerMeter, 0);
      ctx.lineTo(0.08 * layoutData.pxPerMeter, 0);
      ctx.lineTo(0.08 * layoutData.pxPerMeter, -heightPx + 1.05 * layoutData.pxPerMeter);
      ctx.lineTo(0.08 * layoutData.pxPerMeter, -heightPx + 0.95 * layoutData.pxPerMeter);
      ctx.lineTo(
        widthPx / 2 - 0.08 * layoutData.pxPerMeter,
        -heightPx + 0.95 * layoutData.pxPerMeter,
      );
      ctx.bezierCurveTo(
        widthPx / 2 - 0.06 * layoutData.pxPerMeter,
        -heightPx + 0.9 * layoutData.pxPerMeter,
        widthPx / 2 - 0.02 * layoutData.pxPerMeter,
        -heightPx + 0.9 * layoutData.pxPerMeter,
        widthPx / 2,
        -heightPx + 0.75 * layoutData.pxPerMeter,
      );
      ctx.bezierCurveTo(
        widthPx / 2 + 0.02 * layoutData.pxPerMeter,
        -heightPx + 0.45 * layoutData.pxPerMeter,
        widthPx / 2,
        -heightPx + 0.38 * layoutData.pxPerMeter,
        widthPx / 2,
        -heightPx + 0.38 * layoutData.pxPerMeter,
      );
      ctx.closePath();
      ctx.fill();

      // Ground Line
      ctx.strokeStyle = isDark ? "#4a8dff" : "#0047bb";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(-0.6 * layoutData.pxPerMeter, 0);
      ctx.lineTo(0.6 * layoutData.pxPerMeter, 0);
      ctx.stroke();

      // Text label
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.65)" : "#475569";
      ctx.globalAlpha = 1;
      ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Person (1.75m)", 0, 15);

      ctx.restore();
    }

    // ── 3. Draw Screens and Crops ──
    layoutData.renderedBoxes.forEach((box) => {
      const maskCalc = box.maskCalc;
      const cropWPx = maskCalc.width * layoutData.pxPerMeter;
      const cropHPx = maskCalc.height * layoutData.pxPerMeter;
      const dxPx = maskMode === "crop" ? 0 : (box.wPx - cropWPx) / 2;
      const dyPx = maskMode === "crop" ? 0 : (box.hPx - cropHPx) / 2;

      // Screen fill and outer shell borders
      const screenFill = isDark ? "rgba(255, 255, 255, 0.055)" : "rgba(0, 0, 0, 0.02)";
      const isSelectedInStack = layout === "stacked";
      const screenStroke = isDark
        ? isSelectedInStack
          ? "rgba(255, 255, 255, 0.30)"
          : "rgba(255, 255, 255, 0.48)"
        : isSelectedInStack
          ? "rgba(0, 0, 0, 0.15)"
          : "rgba(0, 0, 0, 0.35)";

      ctx.fillStyle = screenFill;
      ctx.strokeStyle = screenStroke;
      ctx.lineWidth = 1;
      ctx.fillRect(box.x, box.y, box.wPx, box.hPx);
      ctx.strokeRect(box.x, box.y, box.wPx, box.hPx);

      // Letterbox / Pillarbox masks
      if (maskCalc.isMasked && maskMode === "darken") {
        ctx.fillStyle = isDark ? "rgba(8, 8, 16, 0.7)" : "rgba(15, 23, 42, 0.6)";

        const nativeRatio = box.width / box.height;
        if (nativeRatio > parseFloat(mask)) {
          // Pillarbox (left & right bars)
          ctx.fillRect(box.x, box.y, dxPx, box.hPx);
          ctx.fillRect(box.x + box.wPx - dxPx, box.y, dxPx, box.hPx);
        } else {
          // Letterbox (top & bottom bars)
          ctx.fillRect(box.x, box.y, box.wPx, dyPx);
          ctx.fillRect(box.x, box.y + box.hPx - dyPx, box.wPx, dyPx);
        }

        // Active Crop solid outline
        ctx.strokeStyle = isDark ? "#4a8dff" : "#0047bb";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(box.x + dxPx, box.y + dyPx, cropWPx, cropHPx);
      }

      // Draw inside area details if showArea is active and screen is big enough
      if (showArea) {
        const isTinyScreen =
          box.wPx < MIN_WIDTH_FOR_INSIDE_AREA || box.hPx < MIN_HEIGHT_FOR_INSIDE_AREA;
        const nativeRatio = box.width / box.height;
        const areaText = maskCalc.isMasked
          ? maskCalc.area.toFixed(0)
          : (box.width * box.height).toFixed(0);
        const ratioText = maskCalc.isMasked
          ? `in ${parseFloat(mask).toFixed(2)}:1`
          : `${nativeRatio.toFixed(2)}:1`;

        if (!isTinyScreen) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // Area value
          ctx.fillStyle = isDark ? "#4a8dff" : "#0047bb";
          ctx.font =
            "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, ui-sans-serif, sans-serif";
          ctx.fillText(`${areaText} m²`, box.x + box.wPx / 2, box.y + box.hPx / 2 - 6);

          // Aspect Details
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)";
          ctx.font =
            "500 8.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, ui-sans-serif, sans-serif";
          ctx.fillText(ratioText, box.x + box.wPx / 2, box.y + box.hPx / 2 + 7);
        } else {
          // Small screens draw callout leader line + floating text
          const centerX = box.x + box.wPx / 2;
          const centerY = box.y + box.hPx / 2;

          let endX = centerX;
          let endY = centerY;
          let calloutX = centerX;
          let calloutY = centerY;
          let align: CanvasTextAlign = "center";

          if (layout === "horizontal" || layout === "stacked") {
            endY = box.y + box.hPx + 15;
            calloutX = centerX;
            calloutY = box.y + box.hPx + 18;
          } else if (layout === "vertical") {
            endX = box.x - 15;
            calloutX = box.x - 18;
            calloutY = centerY - 10;
            align = "right";
          }

          // Draw schematics-style pointer line
          ctx.strokeStyle = isDark ? "rgba(74, 141, 255, 0.5)" : "rgba(0, 71, 187, 0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Anchor center dot
          ctx.fillStyle = isDark ? "#4a8dff" : "#0047bb";
          ctx.beginPath();
          ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw callout labels
          ctx.fillStyle = isDark ? "#4a8dff" : "#0047bb";
          ctx.font =
            "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, ui-sans-serif, sans-serif";
          ctx.textAlign = align;
          ctx.textBaseline = "top";
          ctx.fillText(`${areaText} m²`, calloutX, calloutY);

          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)";
          ctx.font =
            "500 8px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, ui-sans-serif, sans-serif";
          ctx.fillText(ratioText, calloutX, calloutY + 12);
        }
      }

      // Draw Labels (Name + Size details)
      if (showLabels) {
        ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
        ctx.font =
          "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, ui-sans-serif, sans-serif";
        ctx.textBaseline = "top";

        const sizeDetailsText = `${box.width.toFixed(1)}m × ${box.height.toFixed(1)}m · ${(box.width / box.height).toFixed(2)}:1 · ${(box.width * box.height).toFixed(0)}m²`;

        if (layout === "horizontal") {
          ctx.textAlign = "left";
          // Draw text with name wrap if too long
          const name = box.name;
          ctx.fillText(name, box.labelX, box.y - 25, box.labelWidth);

          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.65)" : "#475569";
          ctx.font = "normal 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(sizeDetailsText, box.labelX, box.y - 12);
        } else if (layout === "vertical") {
          ctx.textAlign = "left";
          ctx.fillText(box.name, box.labelX, box.y - 3);

          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.65)" : "#475569";
          ctx.font = "normal 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(sizeDetailsText, box.labelX, box.y + 11);
        } else {
          // Stacked
          ctx.textAlign = "left";
          ctx.fillText(box.name, box.labelX, box.y + 8, box.labelWidth);

          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.65)" : "#475569";
          ctx.font = "normal 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(sizeDetailsText, box.labelX, box.y + 22);
        }
      }
    });

    ctx.restore();

    // ── Viewport visibility check ──
    // Runs as a natural byproduct of the draw pass: all transform values
    // (scale, dx, dy, pan, zoom, w, h) are already computed above.
    setScreensInView(isAnyBoxVisible(layoutData.renderedBoxes, w, h, scale, dx, dy, pan, zoom));
  }, [
    layoutData,
    redrawTick,
    pan,
    zoom,
    resolvedTheme,
    showArea,
    showLabels,
    showMannequin,
    maskMode,
    mask,
    layout,
  ]);

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-app-border h-full min-h-[300px] p-6 text-center bg-app-bg">
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

  const hoveredBox = layoutData?.renderedBoxes.find((b) => b.id === hoveredScreenId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col min-h-0 bg-app-bg overflow-hidden canvas-viewport"
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

      {/* Out-of-view reset overlay — shown when all screens have been panned off canvas */}
      {!screensInView && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <button
            id="comparator-2d-reset-view"
            type="button"
            onClick={handleResetView}
            className="pointer-events-auto bg-brand hover:bg-brand-hover text-white px-4 py-2.5 font-semibold text-xs tracking-wider uppercase shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Screens Out of View — Reset View
          </button>
        </div>
      )}

      <div className="absolute top-3 left-3 z-10 pointer-events-none px-2 py-1 text-[10px] text-text-muted flex items-center gap-1.5 font-medium">
        <Move className="w-3 h-3" /> Drag to pan · Scroll to zoom
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full h-full select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      />

      {/* Grid scale legend */}
      <div className="absolute bottom-3 right-3 px-2 py-1 text-[10px] font-mono text-text-muted pointer-events-none">
        Grid = 5m × 5m
      </div>

      {/* Absolute Tooltip Overlay */}
      {hoveredScreenId && hoveredBox && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translate(-50%, -100%) translateY(-12px)",
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="bg-app-surface border border-app-border p-3 shadow-xl backdrop-blur-md rounded-[4px] w-[306px]"
        >
          {hoveredBox.isCustom ? (
            <TheatreSheet
              customScreen={{
                id: hoveredBox.id,
                name: hoveredBox.name,
                width: hoveredBox.width,
                height: hoveredBox.height,
              }}
            />
          ) : (
            <TheatreSheet screen={selectedDbScreens.find((s) => s.id === hoveredBox.id)} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Returns true if at least one box in `renderedBoxes` overlaps the visible canvas
 * area [0, w] × [0, h], given the current coordinate transform.
 *
 * The full transform from virtual-space to canvas pixel is:
 *   canvas_x = dx + scale * (pan.x + zoom * vx)
 *   canvas_y = dy + scale * (pan.y + zoom * vy)
 *
 * A box with virtual-space rect (box.x, box.y, box.wPx, box.hPx) is visible when
 * its projected rect intersects the canvas area.
 */
function isAnyBoxVisible(
  renderedBoxes: ReadonlyArray<{ x: number; y: number; wPx: number; hPx: number }>,
  w: number,
  h: number,
  scale: number,
  dx: number,
  dy: number,
  pan: { x: number; y: number },
  zoom: number,
): boolean {
  for (const box of renderedBoxes) {
    const left = dx + scale * (pan.x + zoom * box.x);
    const top = dy + scale * (pan.y + zoom * box.y);
    const right = dx + scale * (pan.x + zoom * (box.x + box.wPx));
    const bottom = dy + scale * (pan.y + zoom * (box.y + box.hPx));

    // AABB overlap test: boxes overlap when neither is fully outside the other
    if (right > 0 && left < w && bottom > 0 && top < h) {
      return true;
    }
  }
  return false;
}
