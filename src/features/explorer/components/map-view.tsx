import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useUrlState } from "@/features/url-state";
import { type CinemaScreen } from "@/features/database";
import { resolveCollisions, type CollisionBoxType } from "../utils/map-collision";
import { useTheme } from "@/features/theme";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TheatreSheet } from "@/features/theatre-sheet";

const LEADER_LINE_STROKE_DARK = "rgba(138, 179, 255, 0.6)";
const LEADER_LINE_STROKE_LIGHT = "rgba(28, 98, 239, 0.6)";

interface MapViewProps {
  screens: CinemaScreen[];
}

export function MapView({ screens }: MapViewProps) {
  const [state, setState] = useUrlState();
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);

  const [shiftedBoxes, setShiftedBoxes] = useState<
    (CollisionBoxType & { px: number; py: number })[]
  >([]);

  // Determine Map Style based on theme
  const mapStyle = useMemo(() => {
    return resolvedTheme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  }, [resolvedTheme]);

  // Initial view state centered on Europe
  const initialViewState = {
    latitude: 50,
    longitude: 10,
    zoom: 3.5,
  };

  const handleToggleSelect = (id: string) => {
    const isSelected = state.selected.includes(id);
    const nextSelected = isSelected
      ? state.selected.filter((x) => x !== id)
      : [...state.selected, id];
    setState({ selected: nextSelected });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          bubbles: true,
          cancelable: true,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        }),
      );
    }
  };

  // Calculate pixel coordinates and resolve collisions
  const updateOverlays = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || state.mapRects === "none") {
      setShiftedBoxes([]);
      return;
    }

    const scale = 4.8; // Pixels per meter

    // Filter screens based on mapRects selection and coordinate availability
    const screensToDraw = (
      state.mapRects === "selected" ? screens.filter((s) => state.selected.includes(s.id)) : screens
    ).filter(
      (s) => s.venue.location.latitude !== undefined && s.venue.location.longitude !== undefined,
    );

    const boxes: (CollisionBoxType & { px: number; py: number })[] = screensToDraw.map((s) => {
      const pos = map.project([s.venue.location.longitude!, s.venue.location.latitude!]);
      const w = s.dimensions.widthMeters * scale;
      const h = s.dimensions.heightMeters * scale;
      const paddingOffset = h / 2 + 15; // Offset box upwards initially so it rests above standard marker
      return {
        id: s.id,
        x: pos.x,
        y: pos.y - paddingOffset,
        ox: pos.x,
        oy: pos.y - paddingOffset * 1.3, // Pull gravity to the floating center position, not the marker center
        width: w,
        height: h,
        px: pos.x,
        py: pos.y,
      };
    });

    // Resolve overlaps
    const solved = resolveCollisions(boxes);
    setShiftedBoxes(solved as (CollisionBoxType & { px: number; py: number })[]);
  }, [screens, state.mapRects, state.selected]);

  // Update box coordinates on map movement, zoom, or render
  useEffect(() => {
    updateOverlays();
  }, [updateOverlays]);

  return (
    <div className="relative w-full h-full min-h-[350px] overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        onMove={updateOverlays}
        onZoom={updateOverlays}
        onLoad={updateOverlays}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-right" />

        {/* Standard Geographic Markers */}
        {screens
          .filter(
            (s) =>
              s.venue.location.latitude !== undefined && s.venue.location.longitude !== undefined,
          )
          .map((s) => {
            const isSelected = state.selected.includes(s.id);
            return (
              <Marker
                key={s.id}
                latitude={s.venue.location.latitude!}
                longitude={s.venue.location.longitude!}
                anchor="center"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(s.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-all cursor-pointer ${
                        isSelected
                          ? "bg-brand border-white text-white scale-110 ring-2 ring-brand/30"
                          : "bg-app-surface border-app-border-strong text-text-secondary hover:scale-105"
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="p-3 z-50">
                    <TheatreSheet screen={s} />
                  </TooltipContent>
                </Tooltip>
              </Marker>
            );
          })}
      </Map>

      {/* Collision-Avoided HTML Overlays Container */}
      {state.mapRects !== "none" && shiftedBoxes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Render Leader Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {shiftedBoxes.map((box) => {
              const screen = screens.find((s) => s.id === box.id);
              if (!screen) return null;

              // Draw line from box center (offset to bottom border) to geographic coordinate
              const startX = box.x;
              const startY = box.y + box.height / 2;
              const endX = box.px;
              const endY = box.py;

              // Only draw line if the box has moved sufficiently far from its original spot
              const distance = Math.hypot(startX - endX, startY - endY);
              if (distance < 10) return null;

              return (
                <line
                  key={`line-${box.id}`}
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={
                    resolvedTheme === "dark" ? LEADER_LINE_STROKE_DARK : LEADER_LINE_STROKE_LIGHT
                  }
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
              );
            })}
          </svg>

          {/* Render Screen Detail Cards */}
          {shiftedBoxes.map((box) => {
            const screen = screens.find((s) => s.id === box.id);
            if (!screen) return null;

            const isSelected = state.selected.includes(screen.id);

            const w = box.width;
            const h = box.height;

            // Determine if the card is large enough to show text/checkbox inside
            const showContent = w >= 70 && h >= 32;

            const card = (
              <div
                key={`box-${box.id}`}
                onClick={() => handleToggleSelect(screen.id)}
                onWheel={handleWheel}
                className={`absolute border rounded shadow-md pointer-events-auto p-1.5 flex flex-col gap-0.5 overflow-hidden select-none transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand-muted border-brand text-brand"
                    : "bg-app-surface border-app-border text-text-primary hover:border-app-border-strong"
                }`}
                style={{
                  left: box.x - box.width / 2,
                  top: box.y - box.height / 2,
                  width: box.width,
                  height: box.height,
                }}
              >
                {showContent ? (
                  <>
                    {/* Top Group: Name and Dimensions stacked */}
                    <div className="flex flex-col gap-0.5 w-full">
                      <div
                        className="text-[9px] font-bold leading-tight truncate"
                        title={screen.venue.name}
                      >
                        {screen.venue.name}
                      </div>
                      <div className="text-[8px] font-mono font-semibold text-text-muted leading-none">
                        {screen.dimensions.widthMeters.toFixed(1)} ×{" "}
                        {screen.dimensions.heightMeters.toFixed(1)}m
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            );

            if (!showContent) {
              return (
                <Tooltip key={`tooltip-${box.id}`}>
                  <TooltipTrigger asChild>{card}</TooltipTrigger>
                  <TooltipContent side="top" className="flex flex-col gap-0.5">
                    <span className="font-bold">{screen.venue.name}</span>
                    <span className="font-mono text-[10px] text-text-muted">
                      {screen.dimensions.widthMeters.toFixed(1)}m ×{" "}
                      {screen.dimensions.heightMeters.toFixed(1)}m
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return card;
          })}
        </div>
      )}
    </div>
  );
}
