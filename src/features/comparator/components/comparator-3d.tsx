import { useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { type CinemaScreen } from "@/features/database";
import { type CustomScreen } from "@/features/url-state";
import { calculateMaskedDimensions } from "../utils/mask-calc";
import { Mannequin3D } from "./mannequin-3d";
import { Button } from "@/components/ui/button";
import { Compass, Rotate3d } from "lucide-react";
import * as THREE from "three";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TheatreSheet } from "@/features/theatre-sheet";
import { useTheme } from "@/features/theme";

const FLOOR_COLOR_DARK = "#0b0f19";
const FLOOR_COLOR_LIGHT = "#f1f5f9";
const GRID_COLOR_CENTER_DARK = "#4a8dff";
const GRID_COLOR_CENTER_LIGHT = "#0047bb";
const GRID_COLOR_GRID_DARK = "#1e293b";
const GRID_COLOR_GRID_LIGHT = "#cbd5e1";
const SCREEN_FRAME_COLOR = "#1f2937";
const SCREEN_CANVAS_COLOR = "#f8fafc";
const CROP_MASK_OVERLAY_COLOR = "#1c62ef";
const CROP_MASK_BORDER_COLOR = "#4a8dff";

interface Comparator3DProps {
  selectedDbScreens: CinemaScreen[];
  customScreens: CustomScreen[];
  layout: "horizontal" | "vertical" | "stacked";
  mask: string;
  maskMode: string;
  showLabels: boolean;
  showArea: boolean;
  showMannequin: boolean;
}

interface Render3DItem {
  id: string;
  name: string;
  width: number;
  height: number;
  isCustom: boolean;
}

// Device orientation controller that updates camera rotation based on gyro data
function DeviceOrientationControls({ active }: { active: boolean }) {
  const { camera } = useThree();
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 90, gamma: 0 });

  useEffect(() => {
    if (!active) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        setOrientation({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [active]);

  useFrame(() => {
    if (!active) return;

    // Convert angles to radians
    const pitch = (orientation.beta - 90) * (Math.PI / 180); // Rotate Y
    const yaw = -orientation.alpha * (Math.PI / 180); // Rotate X
    const roll = orientation.gamma * (Math.PI / 180); // Rotate Z

    // Interpolate camera rotation for smooth look-around
    const targetEuler = new THREE.Euler(pitch, yaw, roll, "YXZ");
    const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
    camera.quaternion.slerp(targetQuaternion, 0.1);
  });

  return null;
}

export function Comparator3D({
  selectedDbScreens,
  customScreens,
  layout,
  mask,
  maskMode,
  showLabels,
  showArea,
  showMannequin,
}: Comparator3DProps) {
  const { resolvedTheme } = useTheme();
  const [gyroActive, setGyroActive] = useState(false);
  const [gyroSupported] = useState(() => {
    return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  });

  // Combine screens into unified lists
  const activeItems: Render3DItem[] = useMemo(() => {
    const dbItems = selectedDbScreens.map((s) => ({
      id: s.id,
      name: `${s.venue.name} (${s.name})`,
      width: s.dimensions.widthMeters,
      height: s.dimensions.heightMeters,
      isCustom: false,
    }));

    const customItems = customScreens.map((s) => ({
      id: s.id,
      name: s.name || "Custom Screen",
      width: s.width,
      height: s.height,
      isCustom: true,
    }));

    return [...dbItems, ...customItems];
  }, [selectedDbScreens, customScreens]);

  const handleToggleGyro = async () => {
    // iOS permission flow
    const GyroEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof GyroEvent !== "undefined" && typeof GyroEvent.requestPermission === "function") {
      try {
        const permissionState = await GyroEvent.requestPermission();
        if (permissionState === "granted") {
          setGyroActive(!gyroActive);
        } else {
          alert("Sensor permission denied. Fallback to mouse drag.");
        }
      } catch (err) {
        console.error("Sensor permission error:", err);
      }
    } else {
      // Android / Desktop standard listener
      setGyroActive(!gyroActive);
    }
  };

  // Calculate coordinates for 3D boxes
  const boxes3D = useMemo(() => {
    if (activeItems.length === 0) return [];

    const spacing = 4; // meters between screens
    const depthSpacing = 2.5; // meters separation in stacked Z-depth

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

    // Sort by area descending for stacked view (largest screen at the very back)
    const sortedItems =
      layout === "stacked"
        ? [...activeItemsWithCrops].sort(
            (a, b) => b.effectiveW * b.effectiveH - a.effectiveW * a.effectiveH,
          )
        : activeItemsWithCrops;

    let totalWidth = 0;
    sortedItems.forEach((item) => {
      totalWidth += item.effectiveW + spacing;
    });
    totalWidth -= spacing; // strip last spacer

    let currentX = -totalWidth / 2;

    return sortedItems.map((item, index) => {
      let x: number;
      let y: number;
      let z: number;

      if (layout === "horizontal") {
        // Left-to-right on X-axis, resting on floor (Y = 0)
        x = currentX + item.effectiveW / 2;
        y = item.effectiveH / 2;
        z = 0;
        currentX += item.effectiveW + spacing;
      } else if (layout === "vertical") {
        // Stacked vertically on Y-axis
        x = 0;
        y =
          sortedItems.slice(0, index).reduce((sum, s) => sum + s.effectiveH + spacing, 0) +
          item.effectiveH / 2;
        z = 0;
      } else {
        // Stacked arrangement: layered along the Z-axis (front-to-back depth)
        // Largest in back (z = -max), smallest in front (z = 0)
        x = 0;
        y = item.effectiveH / 2;
        z = -index * depthSpacing;
      }

      return {
        ...item,
        x,
        y,
        z,
      };
    });
  }, [activeItems, layout, mask, maskMode]);

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-app-border h-full min-h-[300px] p-6 text-center bg-app-bg">
        <span className="font-semibold text-text-primary">No Screens Selected</span>
        <p className="text-xs text-text-muted max-w-xs mt-1">
          Select screens in the Explorer below to compare them in 3D.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-0 bg-app-bg overflow-hidden">
      {/* 3D R3F Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 6, 22], fov: 55 }}
        gl={{ logarithmicDepthBuffer: true }}
      >
        {/* Lights */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[10, 25, 10]}
          intensity={0.95}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={45}
          shadow-camera-bottom={-10}
          shadow-camera-near={0.5}
          shadow-camera-far={100}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.25} />

        {/* Floor and scale markings */}
        <gridHelper
          args={[
            120,
            24,
            resolvedTheme === "dark" ? GRID_COLOR_CENTER_DARK : GRID_COLOR_CENTER_LIGHT,
            resolvedTheme === "dark" ? GRID_COLOR_GRID_DARK : GRID_COLOR_GRID_LIGHT,
          ]}
          position={[0, -0.01, 0]}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial
            color={resolvedTheme === "dark" ? FLOOR_COLOR_DARK : FLOOR_COLOR_LIGHT}
            roughness={0.9}
          />
        </mesh>

        {/* Render 3D Screens */}
        {boxes3D.map((box) => {
          const thickness = 0.12;
          const nativeRatio = box.width / box.height;

          return (
            <group key={box.id} position={[box.x, box.y, box.z]}>
              {/* Outer Screen Frame Box */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[box.effectiveW, box.effectiveH, thickness]} />
                <meshStandardMaterial color={SCREEN_FRAME_COLOR} roughness={0.7} metalness={0.2} />
              </mesh>

              {/* Physical Screen White Canvas (Drawn slightly forward to prevent z-fighting) */}
              <mesh position={[0, 0, thickness / 2 + 0.002]} receiveShadow>
                <planeGeometry args={[box.effectiveW - 0.1, box.effectiveH - 0.1]} />
                <meshStandardMaterial
                  color={SCREEN_CANVAS_COLOR}
                  roughness={0.9}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>

              {/* Active Picture Crop Mask Area Overlay (cobalt blue highlight plane) */}
              {box.maskCalc.isMasked && maskMode === "darken" && (
                <mesh position={[0, 0, thickness / 2 + 0.004]}>
                  <planeGeometry args={[box.maskCalc.width - 0.08, box.maskCalc.height - 0.08]} />
                  <meshStandardMaterial
                    color={CROP_MASK_OVERLAY_COLOR}
                    opacity={0.25}
                    transparent
                    roughness={0.5}
                    polygonOffset
                    polygonOffsetFactor={-2}
                    polygonOffsetUnits={-2}
                  />
                  {/* Border line around active crop */}
                  <lineSegments>
                    <edgesGeometry
                      args={[new THREE.PlaneGeometry(box.maskCalc.width, box.maskCalc.height)]}
                    />
                    <lineBasicMaterial
                      color={CROP_MASK_BORDER_COLOR}
                      linewidth={2}
                      polygonOffset
                      polygonOffsetFactor={-3}
                      polygonOffsetUnits={-3}
                    />
                  </lineSegments>
                </mesh>
              )}

              {/* HTML Annotation Labels (Top Left of Screen with Tooltips) */}
              {showLabels && (
                <Html
                  position={[-box.effectiveW / 2, box.effectiveH / 2 + 0.35, 0]}
                  center
                  distanceFactor={15}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-app-surface border border-app-border text-text-primary px-2.5 py-1.5 text-left shadow-lg backdrop-blur-sm max-w-[220px] leading-tight cursor-help pointer-events-auto transition-colors group">
                        <div className="font-bold text-xs truncate max-w-[200px] group-hover:text-brand transition-colors select-text">
                          {box.name}
                        </div>
                        <div className="text-[10px] font-mono text-text-muted mt-0.5 select-none truncate leading-normal">
                          {box.width.toFixed(1)}m x {box.height.toFixed(1)}m ·{" "}
                          {nativeRatio.toFixed(2)}:1 · {(box.width * box.height).toFixed(0)}m²
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
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
                        <TheatreSheet screen={selectedDbScreens.find((s) => s.id === box.id)} />
                      )}
                    </TooltipContent>
                  </Tooltip>
                </Html>
              )}

              {/* Center Area Label */}
              {showArea && (
                <Html
                  position={[0, 0, thickness / 2 + 0.02]}
                  center
                  distanceFactor={18}
                  className="pointer-events-none select-none"
                >
                  <div className="flex flex-col items-center justify-center text-center whitespace-nowrap">
                    {!box.maskCalc.isMasked ? (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] font-bold text-brand">
                          {(box.width * box.height).toFixed(0)} m²
                        </span>
                        <span className="text-[8.5px] font-medium text-text-muted mt-0.5">
                          {nativeRatio.toFixed(2)}:1 aspect ratio
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] font-bold text-brand">
                          {box.maskCalc.area.toFixed(0)} m²
                        </span>
                        <span className="text-[8.5px] font-medium text-text-muted mt-0.5">
                          (in {parseFloat(mask).toFixed(2)}:1 aspect ratio)
                        </span>
                      </div>
                    )}
                  </div>
                </Html>
              )}
            </group>
          );
        })}

        {/* 3D Scale Mannequin (resting at Y = 0) */}
        {showMannequin && (
          <Mannequin3D
            position={
              layout === "horizontal"
                ? [boxes3D[0].x - boxes3D[0].effectiveW / 2 - 2.5, 0, 0]
                : layout === "vertical"
                  ? [boxes3D[0].effectiveW / 2 + 2, 0, 0]
                  : [boxes3D[0].effectiveW / 2 + 1.8, 0, 0]
            }
          />
        )}

        {/* Gyro Sensor controls */}
        <DeviceOrientationControls active={gyroActive} />

        {/* Standard Orbit Drag Controls (Only active when gyro controls are disabled) */}
        {!gyroActive && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={4}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2 - 0.05} // prevent going underneath ground plane
          />
        )}
      </Canvas>

      {/* Gyro toggle button for mobile/Vision Pro overlays */}
      {gyroSupported && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <Button
            variant={gyroActive ? "primary" : "secondary"}
            size="sm"
            onClick={handleToggleGyro}
            className="flex items-center gap-1.5 shadow-md"
          >
            {gyroActive ? (
              <>
                <Rotate3d className="w-3.5 h-3.5" /> Orbit Mode
              </>
            ) : (
              <>
                <Compass className="w-3.5 h-3.5" /> Gyro Look
              </>
            )}
          </Button>
        </div>
      )}

      {/* Controls Overlay Legend */}
      <div className="absolute bottom-4 left-4 pointer-events-none bg-black/60 px-3 py-1.5 text-[10px] text-text-muted font-mono flex flex-col">
        <span>Mouse Drag: Rotate Camera</span>
        <span>Mouse Scroll: Zoom</span>
        <span>Grid squares: 5m × 5m</span>
      </div>
    </div>
  );
}
