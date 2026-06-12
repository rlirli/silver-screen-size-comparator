import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { type CinemaScreen } from "@/features/database";
import { type CustomScreen } from "@/features/url-state";
import { calculateMaskedDimensions } from "../utils/mask-calc";
import { Mannequin3D } from "./mannequin-3d";
import { Button } from "@/components/ui/button";
import { Compass, Rotate3d } from "lucide-react";
import * as THREE from "three";
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
const CROP_MASK_BORDER_COLOR = "#4a8dff";
const COLOR_LABEL_RECT_BACKGROUND = ""; // use e.g. "yellow" to debug sizing, or transparent for production

interface Comparator3DProps {
  selectedDbScreens: CinemaScreen[];
  customScreens: CustomScreen[];
  order?: string[];
  layout: "horizontal" | "vertical" | "stacked" | "surround";
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
function DeviceOrientationControls({
  active,
  controlsRef,
}: {
  active: boolean;
  controlsRef: React.RefObject<any>;
}) {
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
    const pitch = (orientation.beta - 90) * (Math.PI / 180); // Rotate X (Pitch)
    const yaw = orientation.alpha * (Math.PI / 180); // Rotate Y (Yaw)
    const roll = -orientation.gamma * (Math.PI / 180); // Rotate Z (Roll)

    // Interpolate camera rotation for smooth look-around
    const targetEuler = new THREE.Euler(pitch, yaw, roll, "YXZ");
    const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
    camera.quaternion.slerp(targetQuaternion, 0.1);

    if (controlsRef.current) {
      const target = controlsRef.current.target;
      const distance = camera.position.distanceTo(target);
      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      camera.position.copy(target).addScaledVector(lookDir, -distance);
    }
  });

  return null;
}

// Camera controller that manages camera position and target based on layout and active controls
function CameraPositioner({
  layout,
  gyroActive,
  surroundRadius,
}: {
  layout: string;
  gyroActive: boolean;
  surroundRadius: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (gyroActive) {
      if (layout === "surround") {
        camera.position.set(0, 1.55, 0);
      } else {
        camera.position.set(0, 1.55, 12);
      }
    } else {
      if (layout === "horizontal") {
        camera.position.set(0, 6, 22);
      } else if (layout === "vertical") {
        camera.position.set(0, 15, 30);
      } else if (layout === "stacked") {
        camera.position.set(0, 6, 20);
      } else if (layout === "surround") {
        camera.position.set(0, surroundRadius * 0.6 + 4, surroundRadius * 1.6 + 8);
      }
    }
  }, [layout, gyroActive, surroundRadius, camera]);

  return null;
}

export function Comparator3D({
  selectedDbScreens,
  customScreens,
  order,
  layout,
  mask,
  maskMode,
  showLabels,
  showArea,
  showMannequin,
}: Comparator3DProps) {
  const { resolvedTheme } = useTheme();
  const [gyroActive, setGyroActive] = useState(false);
  const controlsRef = useRef<any>(null);
  const [gyroSupported] = useState(() => {
    return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  });
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);

  const controlsTarget = useMemo(() => {
    if (layout === "vertical") return [0, 10, 0] as [number, number, number];
    return [0, 2, 0] as [number, number, number];
  }, [layout]);

  // Combine screens into unified lists
  const activeItems: Render3DItem[] = useMemo(() => {
    const dbItems = selectedDbScreens.map((s) => ({
      id: s.id,
      name: `${s.venue.name} (${s.venue.location.city})`,
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

  // Calculate radius for surround layout (at least 10m for N=1,2, or dynamically computed for N>=3)
  const surroundRadius = useMemo(() => {
    if (activeItems.length === 0) return 10;
    if (activeItems.length === 1 || activeItems.length === 2) return 10;

    const activeItemsWithCrops = activeItems.map((item) => {
      const maskCalc = calculateMaskedDimensions(item.width, item.height, mask);
      const effectiveW = maskMode === "crop" ? maskCalc.width : item.width;
      return effectiveW;
    });

    const totalPaddedWidth = activeItemsWithCrops.reduce((sum, w) => sum + w + 2, 0);
    return totalPaddedWidth / (2 * Math.PI);
  }, [activeItems, mask, maskMode]);

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
    let currentTheta = Math.PI;

    return sortedItems.map((item, index) => {
      let x: number;
      let y: number;
      let z: number;
      let rotationY = 0;

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
      } else if (layout === "stacked") {
        // Stacked arrangement: layered along the Z-axis (front-to-back depth)
        // Largest in back (z = -max), smallest in front (z = 0)
        x = 0;
        y = item.effectiveH / 2;
        z = -(sortedItems.length - 1 - index) * depthSpacing;
      } else {
        // layout === "surround"
        if (sortedItems.length === 1) {
          x = 0;
          y = item.effectiveH / 2;
          z = -10;
          rotationY = 0;
        } else if (sortedItems.length === 2) {
          x = 0;
          y = item.effectiveH / 2;
          z = index === 0 ? -10 : 10;
          rotationY = index === 0 ? 0 : Math.PI;
        } else {
          // N >= 3
          x = surroundRadius * Math.sin(currentTheta);
          y = item.effectiveH / 2;
          z = surroundRadius * Math.cos(currentTheta);
          rotationY = currentTheta - Math.PI;

          // Prepare theta for the next screen
          if (index < sortedItems.length - 1) {
            const nextItem = sortedItems[index + 1];
            const angularSpacing =
              (item.effectiveW + nextItem.effectiveW + 4) / (2 * surroundRadius);
            currentTheta += angularSpacing;
          }
        }
      }

      return {
        ...item,
        x,
        y,
        z,
        rotationY,
      };
    });
  }, [activeItems, layout, mask, maskMode, surroundRadius]);

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-app-border h-full min-h-[300px] p-6 text-center bg-app-bg">
        <span className="font-semibold text-text-primary">No Screens Selected</span>
        <p className="text-xs text-text-muted max-w-sm mt-1">
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
        gl={{ logarithmicDepthBuffer: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => setActiveScreenId(null)}
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
            <group
              key={box.id}
              position={[box.x, box.y, box.z]}
              rotation={[0, box.rotationY || 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                setActiveScreenId(box.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "auto";
              }}
            >
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

              {/* Active Picture Crop Mask Area Overlay (darken areas outside crop, outline inside) */}
              {box.maskCalc.isMasked &&
                maskMode === "darken" &&
                (() => {
                  const innerW = box.effectiveW - 0.1;
                  const innerH = box.effectiveH - 0.1;
                  const maskRatio = parseFloat(mask);
                  const isPillarbox = nativeRatio > maskRatio;

                  const cropW = isPillarbox ? innerH * maskRatio : innerW;
                  const cropH = isPillarbox ? innerH : innerW / maskRatio;

                  const overlayColor = resolvedTheme === "dark" ? "#080810" : "#0f172a";
                  const overlayOpacity = resolvedTheme === "dark" ? 0.7 : 0.6;

                  return (
                    <group>
                      {/* Darkened overlays outside active crop */}
                      {isPillarbox ? (
                        <>
                          {/* Left Pillar */}
                          <mesh
                            position={[-(innerW + cropW) / 4, 0, thickness / 2 + 0.004]}
                            receiveShadow
                          >
                            <planeGeometry args={[(innerW - cropW) / 2, innerH]} />
                            <meshStandardMaterial
                              color={overlayColor}
                              opacity={overlayOpacity}
                              transparent
                              roughness={0.9}
                              polygonOffset
                              polygonOffsetFactor={-2}
                              polygonOffsetUnits={-2}
                            />
                          </mesh>
                          {/* Right Pillar */}
                          <mesh
                            position={[(innerW + cropW) / 4, 0, thickness / 2 + 0.004]}
                            receiveShadow
                          >
                            <planeGeometry args={[(innerW - cropW) / 2, innerH]} />
                            <meshStandardMaterial
                              color={overlayColor}
                              opacity={overlayOpacity}
                              transparent
                              roughness={0.9}
                              polygonOffset
                              polygonOffsetFactor={-2}
                              polygonOffsetUnits={-2}
                            />
                          </mesh>
                        </>
                      ) : (
                        <>
                          {/* Top Letterbox */}
                          <mesh
                            position={[0, (innerH + cropH) / 4, thickness / 2 + 0.004]}
                            receiveShadow
                          >
                            <planeGeometry args={[innerW, (innerH - cropH) / 2]} />
                            <meshStandardMaterial
                              color={overlayColor}
                              opacity={overlayOpacity}
                              transparent
                              roughness={0.9}
                              polygonOffset
                              polygonOffsetFactor={-2}
                              polygonOffsetUnits={-2}
                            />
                          </mesh>
                          {/* Bottom Letterbox */}
                          <mesh
                            position={[0, -(innerH + cropH) / 4, thickness / 2 + 0.004]}
                            receiveShadow
                          >
                            <planeGeometry args={[innerW, (innerH - cropH) / 2]} />
                            <meshStandardMaterial
                              color={overlayColor}
                              opacity={overlayOpacity}
                              transparent
                              roughness={0.9}
                              polygonOffset
                              polygonOffsetFactor={-2}
                              polygonOffsetUnits={-2}
                            />
                          </mesh>
                        </>
                      )}

                      {/* Border line around active crop */}
                      <group position={[0, 0, thickness / 2 + 0.005]}>
                        <lineSegments>
                          <edgesGeometry args={[new THREE.PlaneGeometry(cropW, cropH)]} />
                          <lineBasicMaterial
                            color={CROP_MASK_BORDER_COLOR}
                            linewidth={2}
                            polygonOffset
                            polygonOffsetFactor={-3}
                            polygonOffsetUnits={-3}
                          />
                        </lineSegments>
                      </group>
                    </group>
                  );
                })()}

              {/* HTML Annotation Labels */}
              {showLabels &&
                (() => {
                  let labelPos: [number, number, number];
                  let innerStyle: React.CSSProperties = {};
                  const df = 15;
                  const scaleFactor = 400 / df;

                  if (layout === "horizontal" || layout === "vertical") {
                    labelPos = [
                      -box.effectiveW / 2,
                      box.effectiveH / 2 + 0.1,
                      thickness / 2 + 0.01,
                    ];
                    innerStyle = {
                      transform: "translate(50%, -50%)",
                      width: `${box.effectiveW * scaleFactor}px`,
                    };
                  } else {
                    // stacked
                    labelPos = [
                      -box.effectiveW / 2 + 0.15,
                      box.effectiveH / 2 - 0.15,
                      thickness / 2 + 0.01,
                    ];
                    innerStyle = {
                      transform: "translate(50%, 50%)",
                      width: `${(box.effectiveW - 0.3) * scaleFactor}px`,
                    };
                  }

                  return (
                    <Html
                      position={labelPos}
                      transform
                      distanceFactor={df}
                      occlude
                      className="pointer-events-none select-none"
                    >
                      <div
                        style={{
                          ...innerStyle,
                          backgroundColor: COLOR_LABEL_RECT_BACKGROUND,
                        }}
                        className="r3f-label-overlay text-left leading-tight pointer-events-auto transition-colors group"
                      >
                        <div className="font-bold text-xs text-text-primary group-hover:text-brand transition-colors select-text">
                          {box.name}
                        </div>
                        <div className="text-[10px] font-mono text-text-secondary mt-0.5 select-none leading-normal">
                          {box.width.toFixed(1)}m x {box.height.toFixed(1)}m ·{" "}
                          {nativeRatio.toFixed(2)}:1 · {(box.width * box.height).toFixed(0)}m²
                        </div>
                      </div>
                    </Html>
                  );
                })()}

              {/* Screen-Space Click Tooltip */}
              {activeScreenId === box.id && (
                <Html
                  position={[0, -box.effectiveH / 2, thickness / 2 + 0.05]}
                  center={false}
                  zIndexRange={[20000000, 20000000]}
                  className="pointer-events-none select-none"
                >
                  <div
                    style={{
                      transform: "translate(-50%, 24px)",
                      position: "relative",
                    }}
                    className="pointer-events-auto bg-app-surface border border-app-border p-3 shadow-xl backdrop-blur-md rounded-[4px] w-[306px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Connector Line to screen bottom-middle border */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "-24px",
                        width: "2px",
                        height: "24px",
                      }}
                      className="bg-brand/70 -translate-x-1/2"
                    />

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
                  </div>
                </Html>
              )}

              {/* Center Area Label */}
              {showArea && (
                <Html
                  position={[0, 0, thickness / 2 + 0.01]}
                  center
                  transform
                  distanceFactor={18}
                  occlude
                  className="pointer-events-none select-none"
                >
                  <div className="r3f-area-overlay flex flex-col items-center justify-center text-center whitespace-nowrap">
                    {!box.maskCalc.isMasked ? (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] font-bold text-brand">
                          {(box.width * box.height).toFixed(0)} m²
                        </span>
                        <span className="text-[8.5px] font-medium text-text-secondary mt-0.5">
                          {nativeRatio.toFixed(2)}:1 aspect ratio
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] font-bold text-brand">
                          {box.maskCalc.area.toFixed(0)} m²
                        </span>
                        <span className="text-[8.5px] font-medium text-text-secondary mt-0.5">
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

        {/* Camera position and transition manager */}
        <CameraPositioner layout={layout} gyroActive={gyroActive} surroundRadius={surroundRadius} />

        {/* 3D Scale Mannequin (resting at Y = 0) */}
        {showMannequin && !gyroActive && (
          <Mannequin3D
            position={
              layout === "surround"
                ? [0, 0, 0]
                : layout === "horizontal"
                  ? [boxes3D[0].x - boxes3D[0].effectiveW / 2 - 2.5, 0, 0]
                  : layout === "vertical"
                    ? [boxes3D[0].effectiveW / 2 + 2, 0, 0]
                    : [boxes3D[0].effectiveW / 2 + 1.8, 0, 0]
            }
          />
        )}

        {/* Gyro Sensor controls */}
        <DeviceOrientationControls active={gyroActive} controlsRef={controlsRef} />

        {/* Standard Orbit Drag Controls */}
        <OrbitControls
          ref={controlsRef}
          target={controlsTarget}
          enableDamping
          dampingFactor={0.05}
          minDistance={4}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2 - 0.05} // prevent going underneath ground plane
          enableRotate={!gyroActive}
        />
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
