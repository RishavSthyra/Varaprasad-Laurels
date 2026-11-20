"use client";

import { MasterPlanPreview } from "./MasterPlanPreview";
import viewportStyles from "./MasterPlanViewport.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import {
  PerspectiveCamera as DreiPerspectiveCamera,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import {
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getMasterPlanModelTargets, getVillaNumberForModelTarget, MASTERPLAN_CLUBHOUSE_HREF, VILLA_MASTERPLAN_MODEL_URL } from "@/lib/villa-masterplan-model";
import { VILLA_MASTERPLAN_VIDEO_URL, wrapVillaOrbitFrame, nearestVillaOrbitStop, type VillaOrbitMotion } from "@/lib/villa-masterplan-video";
import VillaMasterPlanVideo from "./VillaMasterPlanVideo";

import type { MasterPlanDeveloperConfig } from "@/types/developer-config";
import type {
  InventoryApartment,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";

const DEFAULT_MODEL_URL = VILLA_MASTERPLAN_MODEL_URL;
const SOURCE_FRAME_ASPECT = 16 / 9;
// GLTFLoader suffixes repeated mesh instances (`V05-G_1`, `V05-G_2`, ...).
// Accept the suffix so every placed villa—not only the first of each type—is
// included in the hover scene.
const VILLA_MESH_PATTERN = /^(V\d+)-(G|01|02)(?:_(\d+))?$/i;
const MAPPING_HELPER_MESH_PATTERN = /^(?:dummy0[1-3]|landscape)(?:_\d+)?$/i;
const EXCLUDED_VILLA_NUMBERS = new Set([21]);
const VILLA_STATUS_COLORS: Record<InventoryStatus, string> = {
  Available: "#62f59a",
  Reserved: "#f4c84b",
  Sold: "#ff5b5b",
};
const SELECTED_VILLA_HOVER_COLOR = "#4b8dff";
// Each flattened export has its own CAD-numbered root ranges. Some villa
// components in the new export are non-contiguous, so one old index list is unsafe.

function formatVillaLabel(villaNumber: number) {
  return `Villa ${villaNumber}`;
}

type VillasMasterPlanStageProps = {
  apartments: InventoryApartment[];
  currentFrame: number;
  dragEnabled?: boolean;
  containMedia?: boolean;
  responsiveLayout?: boolean;
  orbitMotion?: VillaOrbitMotion | null;
  filteredApartments: InventoryApartment[];
  inventoryError: string | null;
  inventoryState: "loading" | "ready" | "error";
  onApartmentSelect?: (
    apartment: InventoryApartment | null,
    apartmentId: string | null,
  ) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  onApartmentIntent?: (villaNumber: number) => void;
  onSetFrame: (frame: number) => void;
  selectedApartmentId: string | null;
  selectedTower: TowerType | null;
  touchHighlightProfile?: "desktop" | "tablet" | "mobile";
  config?: MasterPlanDeveloperConfig;
};

type PreparedHoverTarget = {
  disposeGeometry: boolean;
  id: string;
  label: string;
  kind: "villa" | "amenity";
  materials: MeshBasicMaterial[];
  meshes: Mesh[];
  meshScales: Vector3[];
  hoverOpacity: number;
  hoverScale: number;
};

type PreparedModel = {
  occlusionMaterial: MeshBasicMaterial;
  occlusionMeshes: Mesh[];
  occlusionScene: Group;
  scene: Group;
  targets: PreparedHoverTarget[];
};

function createOcclusionPass(scene: Group) {
  const occlusionScene = cloneSkeleton(scene) as Group;
  const occlusionMeshes: Mesh[] = [];
  const occlusionMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    side: FrontSide,
    toneMapped: false,
    transparent: false,
  });

  occlusionScene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.material = occlusionMaterial;
    object.renderOrder = -100;
    object.raycast = () => undefined;
    occlusionMeshes.push(object);
  });

  return { occlusionMaterial, occlusionMeshes, occlusionScene };
}

function resolveModelUrl(config?: MasterPlanDeveloperConfig) {
  const key = config?.towerAModelKey;

  if (!key) {
    return DEFAULT_MODEL_URL;
  }

  if (key.startsWith("local:")) {
    return encodeURI(`/${key.slice("local:".length).replace(/^\/+/, "")}`);
  }

  return encodeURI(key.startsWith("/") ? key : `/${key}`);
}

function prepareModel(sourceScene: Group): PreparedModel {
  const scene = cloneSkeleton(sourceScene) as Group;
  const targets: PreparedHoverTarget[] = [];
  const villasByInstance = new Map<string, PreparedHoverTarget | null>();
  const roots = scene.children.map((root) => {
    const meshes: Mesh[] = [];

    root.traverse((object) => {
      if (object instanceof Mesh) {
        meshes.push(object);
      }
    });

    return {
      root,
      meshes,
      villaMesh: meshes.find((mesh) => VILLA_MESH_PATTERN.test(mesh.name)),
    };
  });

  if (!roots.some(({ villaMesh }) => villaMesh)) {
    const optimizedScene = new Group();
    const modelTargets = getMasterPlanModelTargets(roots.length);

    scene.updateMatrixWorld(true);
    const sceneWorldInverse = scene.matrixWorld.clone().invert();

    modelTargets.forEach(({ id, label, kind, rootRanges }) => {
      const material = new MeshBasicMaterial({
        color: "#9af5a8",
        colorWrite: false,
        depthTest: true,
        depthWrite: true,
        opacity: 1,
        side: FrontSide,
        toneMapped: false,
        transparent: false,
      });
      const villa: PreparedHoverTarget = {
        disposeGeometry: true,
        id, label, kind,
        materials: [material],
        meshes: [],
        meshScales: [],
        hoverOpacity: 0.42,
        hoverScale: 1.015,
      };
      const sourceMeshes: Mesh[] = [];

      for (const [start, end] of rootRanges) for (let rootIndex = start; rootIndex <= end; rootIndex += 1) {
        const { meshes } = roots[rootIndex];
        const renderableMeshes = meshes.filter(
          (mesh) => !MAPPING_HELPER_MESH_PATTERN.test(mesh.name),
        );

        if (renderableMeshes.length === 0) {
          continue;
        }

        sourceMeshes.push(...renderableMeshes);
      }

      const geometries = sourceMeshes.map((mesh) => {
        const geometry = mesh.geometry.clone();
        const meshToScene = sceneWorldInverse
          .clone()
          .multiply(mesh.matrixWorld);

        geometry.applyMatrix4(meshToScene);
        return geometry;
      });
      const mergedGeometry = mergeGeometries(geometries, false);

      geometries.forEach((geometry) => geometry.dispose());

      if (!mergedGeometry) {
        material.dispose();
        return;
      }

      mergedGeometry.computeBoundingBox();
      const center = mergedGeometry.boundingBox?.getCenter(new Vector3()) ??
        new Vector3();

      mergedGeometry.translate(-center.x, -center.y, -center.z);
      mergedGeometry.computeBoundingBox();
      mergedGeometry.computeBoundingSphere();

      const villaMesh = new Mesh(mergedGeometry, material);

      villaMesh.name = kind === "villa" ? `MasterPlanVilla${getVillaNumberForModelTarget(id)}` : "MasterPlanClubhouse";
      villaMesh.position.copy(center);
      villaMesh.renderOrder = 0;
      villaMesh.userData.masterPlanTargetId = id;
      villaMesh.userData.masterPlanTargetLabel = label;
      if (kind === "villa") {
        villaMesh.userData.masterPlanVillaId = id;
        villaMesh.userData.masterPlanVillaLabel = label;
      }
      optimizedScene.add(villaMesh);
      villa.meshes.push(villaMesh);
      villa.meshScales.push(villaMesh.scale.clone());
      targets.push(villa);
    });

    return {
      ...createOcclusionPass(optimizedScene),
      scene: optimizedScene,
      targets,
    };
  }

  roots.forEach(({ root, villaMesh }) => {
    if (!villaMesh) {
      root.visible = false;
      return;
    }

    const match = villaMesh.name.match(VILLA_MESH_PATTERN);

    if (!match) {
      root.visible = false;
      return;
    }

    const villaType = match[1].toUpperCase();
    const instanceSuffix = match[3] ?? "0";
    const instanceKey = `${villaType}:${instanceSuffix}`;
    let villa = villasByInstance.get(instanceKey);

    if (!villasByInstance.has(instanceKey)) {
      const villaNumber = villasByInstance.size + 1;

      if (EXCLUDED_VILLA_NUMBERS.has(villaNumber)) {
        villasByInstance.set(instanceKey, null);
        root.visible = false;
        return;
      }

      villa = {
        disposeGeometry: false,
        id: `villa-${villaNumber}`,
        label: formatVillaLabel(villaNumber),
        kind: "villa",
        materials: [],
        meshes: [],
        meshScales: [],
        hoverOpacity: 0.42,
        hoverScale: 1.015,
      };
      villasByInstance.set(instanceKey, villa);
      targets.push(villa);
    }

    if (!villa) {
      root.visible = false;
      return;
    }

    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      const material = new MeshBasicMaterial({
        color: "#9af5a8",
        colorWrite: false,
        depthTest: true,
        depthWrite: true,
        opacity: 1,
        side: FrontSide,
        toneMapped: false,
        transparent: false,
      });

      object.material = material;
      object.renderOrder = 0;
      object.userData.masterPlanVillaId = villa.id;
      object.userData.masterPlanVillaLabel = villa.label;
      object.userData.masterPlanTargetId = villa.id;
      object.userData.masterPlanTargetLabel = villa.label;
      villa.materials.push(material);
      villa.meshes.push(object);
      villa.meshScales.push(object.scale.clone());
    });
  });

  return {
    ...createOcclusionPass(scene),
    scene,
    targets,
  };
}

function CameraRig({ config, frame }: { config?: MasterPlanDeveloperConfig; frame: number }) {
  const { size } = useThree();
  const cameraConfig = config?.hotspots.find((hotspot) => hotspot.frame === frame)?.camera ?? config?.hotspots[0]?.camera;

  if (!cameraConfig) {
    return null;
  }

  const viewportAspect = Math.max(size.width / Math.max(size.height, 1), 0.01);
  const baseVerticalFovRadians = (cameraConfig.fov * Math.PI) / 180;
  const coverMatchedFov =
    viewportAspect > SOURCE_FRAME_ASPECT
      ? (2 *
          Math.atan(
            (Math.tan(baseVerticalFovRadians / 2) * SOURCE_FRAME_ASPECT) /
              viewportAspect,
          ) *
          180) /
        Math.PI
      : cameraConfig.fov;

  return (
    <DreiPerspectiveCamera
      makeDefault
      position={[
      cameraConfig.position.x,
      cameraConfig.position.y,
      cameraConfig.position.z,
      ]}
      quaternion={new Quaternion().fromArray(cameraConfig.quaternion)}
      fov={coverMatchedFov}
      near={0.1}
      far={4000}
    />
  );
}

function VillasModel({
  config,
  filteredVillaIds,
  hoveredVillaId,
  modelUrl,
  onHover,
  onSelect,
  onReady,
  selectedVillaId,
  villaStatusById,
}: {
  config?: MasterPlanDeveloperConfig;
  filteredVillaIds: ReadonlySet<string>;
  hoveredVillaId: string | null;
  modelUrl: string;
  onHover: (id: string | null, label?: string, event?: ThreeEvent<PointerEvent>) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
  selectedVillaId: string | null;
  villaStatusById: ReadonlyMap<string, InventoryStatus>;
}) {
  const gltf = useGLTF(modelUrl);
  const { invalidate } = useThree();
  const prepared = useMemo(
    () => prepareModel(gltf.scene as Group),
    [gltf.scene],
  );
  useEffect(() => { onReady(); }, [onReady, prepared]);
  const transform = config?.towerATransform;
  const modelMatrix = useMemo(() => {
    if (transform?.matrix) {
      return new Matrix4().fromArray(transform.matrix);
    }

    const position = new Vector3(...(transform?.position ?? [0, 0, 0]));
    const quaternion = transform
      ? new Quaternion().fromArray(transform.quaternion)
      : new Quaternion();
    const scale = transform?.scale ?? 1;

    return new Matrix4().compose(
      position,
      quaternion,
      new Vector3(scale, scale, scale),
    );
  }, [transform]);

  useEffect(() => {
    // Keep the original hover treatment: the hovered villa is excluded from
    // the filter occlusion pass, while every other villa still clips it. This
    // lets the hover mesh pop out exactly as before without allowing filtered
    // overlays to bleed through neighboring villas.
    prepared.occlusionMeshes.forEach((mesh) => {
      mesh.visible =
        mesh.userData.masterPlanTargetId !== hoveredVillaId;
    });

    prepared.targets.forEach((villa) => {
      const isHovered = villa.id === hoveredVillaId;
      const isFilterMatch = villa.kind === "villa" && filteredVillaIds.has(villa.id);
      const isSelected = isFilterMatch || villa.id === selectedVillaId;
      const isHighlighted = isHovered || isSelected;
      const status = villaStatusById.get(villa.id) ?? "Available";
      const highlightColor =
        isHovered && isSelected
          ? SELECTED_VILLA_HOVER_COLOR
          : VILLA_STATUS_COLORS[status];

      villa.materials.forEach((material) => {
        material.color.set(highlightColor);
        material.colorWrite = isHighlighted;
        // Filter highlights use the shared depth pass. Hover keeps its former
        // independent depth behavior and remains free to pop out slightly.
        material.depthWrite = isHovered;
        material.opacity = isHighlighted
          ? isHovered
            ? isSelected
              ? 0.52
              : villa.hoverOpacity
            : 0.3
          : 1;
        material.transparent = isHighlighted;
        material.needsUpdate = true;
      });

      villa.meshes.forEach((mesh, index) => {
        // The dedicated occlusion scene renders first. Highlight meshes render
        // afterward and are clipped against that shared depth buffer.
        mesh.renderOrder = isHighlighted ? 20 : 0;
        mesh.scale
          .copy(villa.meshScales[index])
          .multiplyScalar(isHovered ? villa.hoverScale : 1);
      });
    });
    invalidate();
  }, [
    filteredVillaIds,
    hoveredVillaId,
    invalidate,
    prepared.occlusionMeshes,
    prepared.targets,
    selectedVillaId,
    villaStatusById,
  ]);

  useEffect(
    () => () => {
      prepared.targets.forEach((villa) => {
        villa.materials.forEach((material) => material.dispose());
        if (villa.disposeGeometry) {
          villa.meshes.forEach((mesh) => mesh.geometry.dispose());
        }
      });
      prepared.occlusionMaterial.dispose();
    },
    [prepared.occlusionMaterial, prepared.targets],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const id = event.object.userData.masterPlanTargetId as string | undefined;
      const label = event.object.userData.masterPlanTargetLabel as string | undefined;

      if (!id) {
        return;
      }

      event.stopPropagation();
      onHover(id, label, event);
    },
    [onHover],
  );

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const nextVillaId = event.intersections.find(
        (intersection) => intersection.object.userData.masterPlanTargetId,
      )?.object.userData.masterPlanTargetId as string | undefined;

      if (!nextVillaId) {
        onHover(null);
      }
    },
    [onHover],
  );

  return (
    <group matrix={modelMatrix} matrixAutoUpdate={false}>
      <primitive object={prepared.occlusionScene} />
      <primitive
        object={prepared.scene}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          const id = event.object.userData.masterPlanTargetId as string | undefined;
          if (!id || event.delta > 5) return;
          event.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />
    </group>
  );
}

function LoadingStatus() {
  const { active, progress } = useProgress();

  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[#00142b]/15 bg-[#efebe4]/88 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00142b] shadow-[0_10px_30px_rgba(0,20,43,0.12)] backdrop-blur-xl">
      Mapping villas {Math.round(progress)}%
    </div>
  );
}

export default function VillasMasterPlanStage({
  apartments,
  config,
  currentFrame,
  dragEnabled = true,
  containMedia = false,
  responsiveLayout = false,
  orbitMotion,
  filteredApartments,
  onApartmentSelect,
  onApartmentIntent,
  onInteractionChange,
  onSetFrame,
  selectedApartmentId,
}: VillasMasterPlanStageProps) {
  const router = useRouter();
  const [settledFrame, setSettledFrame] = useState<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ id: number; x: number; frame: number; next: number; moved: boolean } | null>(null);
  const dragRaf = useRef(0);
  const suppressClickUntil = useRef(0);
  const totalFrames = config?.totalFrames ?? 309;
  const stopFrames = config?.hotspotFrames ?? [1, 160];
  const handleModelReady = useCallback(() => setModelReady(true), []);
  const videoUrl = config?.scrubVideoKey?.startsWith("local:")
    ? `/${config.scrubVideoKey.slice(6).replace(/^\/+/, "")}`
    : /^https?:\/\//i.test(config?.scrubVideoKey ?? "")
      ? config!.scrubVideoKey
      : VILLA_MASTERPLAN_VIDEO_URL;
  const isAtCalibratedStop = settledFrame === currentFrame &&
    Boolean(config?.hotspots.some((hotspot) => hotspot.frame === settledFrame));
  const showHoverLayer = modelReady && !videoFailed && !isDragging && isAtCalibratedStop;
  const modelUrl = useMemo(() => resolveModelUrl(config), [config]);
  const filteredVillaIds = useMemo(() => {
    const ids = new Set<string>();

    filteredApartments.forEach((apartment) => {
      const villaNumber = Number(
        (apartment.flatNumber || apartment.title).replace(/\D/g, ""),
      );

      if (Number.isInteger(villaNumber) && villaNumber > 0) {
        ids.add(`villa-${villaNumber}`);
      }
    });

    return ids;
  }, [filteredApartments]);
  const villaStatusById = useMemo(() => {
    const statuses = new Map<string, InventoryStatus>();

    apartments.forEach((apartment) => {
      const villaNumber = Number(
        (apartment.flatNumber || apartment.title).replace(/\D/g, ""),
      );

      if (Number.isInteger(villaNumber) && villaNumber > 0) {
        statuses.set(`villa-${villaNumber}`, apartment.status);
      }
    });

    return statuses;
  }, [apartments]);
  const selectedVillaId = useMemo(() => {
    if (!selectedApartmentId) {
      return null;
    }

    const match = selectedApartmentId.match(/(\d+)$/);
    const villaNumber = match ? Number(match[1]) : Number.NaN;

    return Number.isInteger(villaNumber) && villaNumber > 0
      ? `villa-${villaNumber}`
      : null;
  }, [selectedApartmentId]);
  const [hoveredVilla, setHoveredVilla] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const handleVideoMotion = useCallback(() => {
    setSettledFrame(null);
    setHoveredVilla(null);
  }, []);
  const handleVideoSettled = useCallback((frame: number) => {
    setSettledFrame(frame);
  }, []);
  const handleVideoFailure = useCallback(() => {
    setVideoFailed(true);
    setHoveredVilla(null);
  }, []);
  const handleSelect = useCallback((id: string) => {
    if (performance.now() < suppressClickUntil.current) return;
    if (id === "clubhouse") {
      router.push(MASTERPLAN_CLUBHOUSE_HREF);
      return;
    }
    const villaNumber = getVillaNumberForModelTarget(id);
    if (villaNumber === null) return;
    const apartment = apartments.find((item) =>
      Number(item.flatNumber.replace(/\D/g, "")) === villaNumber);
    if (apartment) onApartmentSelect?.(apartment, id);
  }, [apartments, onApartmentSelect, router]);

  const handleHover = useCallback(
    (
      id: string | null,
      label = "",
      event?: ThreeEvent<PointerEvent>,
    ) => {
      setHoveredVilla(id ? { id, label } : null);

      if (event) {
        setTooltipPosition({
          x: event.nativeEvent.offsetX,
          y: event.nativeEvent.offsetY,
        });
      }
    },
    [],
  );

  const hoveredVillaId = hoveredVilla?.id;
  useEffect(() => {
    if (!hoveredVillaId) return;
    if (hoveredVillaId === "clubhouse") {
      const timer = setTimeout(() => router.prefetch(MASTERPLAN_CLUBHOUSE_HREF), 180);
      return () => clearTimeout(timer);
    }
    if (!onApartmentIntent) return;
    const villaNumber = getVillaNumberForModelTarget(hoveredVillaId);
    if (villaNumber === null) return;
    const timer = setTimeout(() => onApartmentIntent(villaNumber), 180);
    return () => clearTimeout(timer);
  }, [hoveredVillaId, onApartmentIntent, router]);

  useEffect(() => {
    onInteractionChange?.(Boolean(hoveredVilla) || isDragging);
  }, [hoveredVilla, isDragging, onInteractionChange]);

  useEffect(() => () => cancelAnimationFrame(dragRaf.current), []);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragEnabled || !event.isPrimary || event.button !== 0) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, frame: currentFrame, next: currentFrame, moved: false };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      handleVideoMotion();
    }
    event.preventDefault(); event.stopPropagation();
    drag.next = wrapVillaOrbitFrame(drag.frame - dx / Math.max(1, event.currentTarget.clientWidth) * totalFrames, totalFrames);
    cancelAnimationFrame(dragRaf.current);
    dragRaf.current = requestAnimationFrame(() => onSetFrame(drag.next));
  };
  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    cancelAnimationFrame(dragRaf.current);
    if (!drag.moved) return;
    event.preventDefault(); event.stopPropagation();
    suppressClickUntil.current = performance.now() + 350;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onSetFrame(nearestVillaOrbitStop(drag.next, stopFrames, totalFrames));
    setIsDragging(false);
  };

  return (
    <section
      className={`absolute inset-0 overflow-hidden bg-[#00142b] ${
        hoveredVilla ? "cursor-pointer" : "cursor-default"
      }`}
      onPointerLeave={() => handleHover(null)}
      style={{ containerType: "size" }}
      data-masterplan-frame={settledFrame ?? "moving"}
      data-masterplan-hover-enabled={showHoverLayer}
      data-masterplan-model-ready={modelReady}
      data-masterplan-dragging={isDragging}
      data-masterplan-target-frame={currentFrame}
    >
      <div
      data-masterplan-render-frame
      data-masterplan-media-fit={containMedia ? "contain" : "cover"}
      className={responsiveLayout ? viewportStyles.frame : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}
      style={{ width: responsiveLayout ? undefined : `${containMedia ? "min" : "max"}(100cqw, calc(100cqh * ${SOURCE_FRAME_ASPECT}))`, aspectRatio: SOURCE_FRAME_ASPECT, touchAction: "none" }}
      onPointerDownCapture={startDrag}
      onPointerMoveCapture={moveDrag}
      onPointerUpCapture={finishDrag}
      onPointerCancelCapture={finishDrag}
      onLostPointerCapture={finishDrag}
      onClickCapture={event => {
        if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
      }}
    >
      <MasterPlanPreview />

      <VillaMasterPlanVideo
        key={videoUrl}
        src={videoUrl}
        frame={currentFrame}
        fps={config?.fps ?? 30}
        totalFrames={config?.totalFrames ?? 309}
        motion={orbitMotion}
        scrubbing={isDragging}
        onMotion={handleVideoMotion}
        onSettled={handleVideoSettled}
        onFailure={handleVideoFailure}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_45%,rgba(0,20,43,0.12)_100%)]" />

      <div className="absolute inset-0 z-10" style={{ visibility: showHoverLayer ? "visible" : "hidden", pointerEvents: showHoverLayer ? "auto" : "none" }}>
      <Canvas
        className="pointer-events-auto absolute inset-0 z-10 [touch-action:none]"
        dpr={[1, 1.75]}
        frameloop="demand"
        camera={{ fov: config?.hotspots[0]?.camera.fov ?? 29.172 }}
        gl={{
          alpha: true,
          antialias: true,
          depth: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
      >
        <CameraRig config={config} frame={settledFrame ?? 1} />
        <Suspense fallback={null}>
          <VillasModel
            config={config}
            filteredVillaIds={filteredVillaIds}
            hoveredVillaId={showHoverLayer ? hoveredVilla?.id ?? null : null}
            modelUrl={modelUrl}
            onHover={handleHover}
            onSelect={handleSelect}
            onReady={handleModelReady}
            selectedVillaId={selectedVillaId}
            villaStatusById={villaStatusById}
          />
        </Suspense>
      </Canvas>
      </div>

      <LoadingStatus />

      {showHoverLayer && hoveredVilla ? (
        <div
          onPointerEnter={() => {
            if (hoveredVilla.id === "clubhouse") handleHover("clubhouse", hoveredVilla.label);
          }}
          onPointerLeave={() => handleHover(null)}
          className="pointer-events-none absolute z-30 -translate-y-1/2 rounded-full border border-[#fce190]/65 bg-[#00142b]/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fce190] shadow-[0_12px_30px_rgba(0,20,43,0.28)] backdrop-blur-xl"
          style={{
            left: `max(0px, min(${tooltipPosition.x + 16}px, calc(100% - 120px)))`,
            top: tooltipPosition.y,
          }}
        >
          {hoveredVilla.id === "clubhouse" ? (
            <Link href={MASTERPLAN_CLUBHOUSE_HREF} prefetch={false} className="pointer-events-auto rounded-sm focus-visible:outline-2 focus-visible:outline-[#fce190]" aria-label="Enter clubhouse walkthrough">
              {hoveredVilla.label}
            </Link>
          ) : hoveredVilla.label}
        </div>
      ) : null}
      </div>
    </section>
  );
}
