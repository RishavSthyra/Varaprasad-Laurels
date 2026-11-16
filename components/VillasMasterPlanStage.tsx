"use client";

import Image from "next/image";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
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

import type { MasterPlanDeveloperConfig } from "@/types/developer-config";
import type {
  InventoryApartment,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";

const DEFAULT_MODEL_URL = "/models/villa 01.glb";
const BACKGROUND_IMAGE_URL = "/master_west.avif";
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
// `villa 01.glb` was exported with the Max group parents flattened, but the
// children of each group remain contiguous and ordered. These are the exact
// final root indices for the first 77 exported villa blocks. The last villa
// starts at 8487; roots 8481-8486 are loose non-villa helper objects.
const FLATTENED_VILLA_ROOT_ENDS = [
  112, 229, 338, 447, 564, 681, 790, 899, 1009, 1119, 1232, 1342, 1455,
  1565, 1673, 1786, 1899, 2008, 2117, 2223, 2329, 2435, 2541, 2647, 2753,
  2859, 2965, 3071, 3177, 3283, 3389, 3495, 3601, 3710, 3819, 3928, 4037,
  4146, 4255, 4364, 4473, 4582, 4691, 4800, 4909, 5018, 5127, 5240, 5353,
  5466, 5573, 5687, 5800, 5913, 6026, 6139, 6252, 6365, 6478, 6584, 6694,
  6807, 6920, 7033, 7139, 7245, 7351, 7457, 7563, 7669, 7775, 7881, 8001,
  8120, 8240, 8360, 8480,
] as const;
const FLATTENED_FINAL_VILLA_ROOT_RANGE = [8487, 8586] as const;

// Plot numbers recovered from the BOUNDRY numbering layer in
// 20260528-FLOOR PLAN-R0.dwg and matched to the flattened GLB groups by their
// plan coordinates. CAD plot 21 has no reliable corresponding GLB center and
// is intentionally excluded from catalogue filtering and hover interaction.
const CAD_VILLA_NUMBERS_BY_FLATTENED_GROUP = [
  17, 4, 7, 8, 3, 2, 6, 5, 1, 9, 12, 10, 13, 11, 14, 15, 16, 18, 19, 20,
  22, 23, 24, 25, 26, 39, 38, 37, 36, 35, 34, 33, 32, 40, 41, 42, 43, 44,
  53, 52, 51, 50, 49, 57, 56, 55, 54, 46, 45, 47, 48, 66, 67, 68, 69, 70,
  71, 72, 73, 65, 78, 77, 76, 75, 64, 63, 62, 61, 60, 59, 58, 21, 27, 28,
  29, 30, 31, 74,
] as const;

function formatVillaLabel(villaNumber: number) {
  return `Villa ${villaNumber}`;
}

type VillasMasterPlanStageProps = {
  apartments: InventoryApartment[];
  currentFrame: number;
  dragEnabled?: boolean;
  filteredApartments: InventoryApartment[];
  inventoryError: string | null;
  inventoryState: "loading" | "ready" | "error";
  onApartmentSelect?: (
    apartment: InventoryApartment | null,
    apartmentId: string | null,
  ) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  onSetFrame: (frame: number) => void;
  selectedApartmentId: string | null;
  selectedTower: TowerType | null;
  touchHighlightProfile?: "desktop" | "tablet" | "mobile";
  config?: MasterPlanDeveloperConfig;
};

type PreparedVilla = {
  disposeGeometry: boolean;
  id: string;
  label: string;
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
  villas: PreparedVilla[];
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
  const villas: PreparedVilla[] = [];
  const villasByInstance = new Map<string, PreparedVilla | null>();
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
    const villaRanges: Array<readonly [number, number]> = [];
    let startIndex = 0;

    FLATTENED_VILLA_ROOT_ENDS.forEach((endIndex) => {
      villaRanges.push([startIndex, endIndex]);
      startIndex = endIndex + 1;
    });
    villaRanges.push(FLATTENED_FINAL_VILLA_ROOT_RANGE);

    scene.updateMatrixWorld(true);
    const sceneWorldInverse = scene.matrixWorld.clone().invert();

    villaRanges.forEach(([start, end], villaIndex) => {
      if (end >= roots.length) {
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
      const villaNumber =
        CAD_VILLA_NUMBERS_BY_FLATTENED_GROUP[villaIndex] ?? villaIndex + 1;

      if (EXCLUDED_VILLA_NUMBERS.has(villaNumber)) {
        material.dispose();
        return;
      }

      const villa: PreparedVilla = {
        disposeGeometry: true,
        id: `villa-${villaNumber}`,
        label: formatVillaLabel(villaNumber),
        materials: [material],
        meshes: [],
        meshScales: [],
        hoverOpacity: 0.42,
        hoverScale: 1.015,
      };
      const sourceMeshes: Mesh[] = [];

      for (let rootIndex = start; rootIndex <= end; rootIndex += 1) {
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

      villaMesh.name = `MasterPlanVilla${villaNumber}`;
      villaMesh.position.copy(center);
      villaMesh.renderOrder = 0;
      villaMesh.userData.masterPlanVillaId = villa.id;
      villaMesh.userData.masterPlanVillaLabel = villa.label;
      optimizedScene.add(villaMesh);
      villa.meshes.push(villaMesh);
      villa.meshScales.push(villaMesh.scale.clone());
      villas.push(villa);
    });

    return {
      ...createOcclusionPass(optimizedScene),
      scene: optimizedScene,
      villas,
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
        materials: [],
        meshes: [],
        meshScales: [],
        hoverOpacity: 0.42,
        hoverScale: 1.015,
      };
      villasByInstance.set(instanceKey, villa);
      villas.push(villa);
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
      villa.materials.push(material);
      villa.meshes.push(object);
      villa.meshScales.push(object.scale.clone());
    });
  });

  return {
    ...createOcclusionPass(scene),
    scene,
    villas,
  };
}

function CameraRig({ config }: { config?: MasterPlanDeveloperConfig }) {
  const { size } = useThree();
  const cameraConfig = config?.hotspots[0]?.camera;

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
  selectedVillaId,
  villaStatusById,
}: {
  config?: MasterPlanDeveloperConfig;
  filteredVillaIds: ReadonlySet<string>;
  hoveredVillaId: string | null;
  modelUrl: string;
  onHover: (id: string | null, label?: string, event?: ThreeEvent<PointerEvent>) => void;
  selectedVillaId: string | null;
  villaStatusById: ReadonlyMap<string, InventoryStatus>;
}) {
  const gltf = useGLTF(modelUrl);
  const { invalidate } = useThree();
  const prepared = useMemo(
    () => prepareModel(gltf.scene as Group),
    [gltf.scene],
  );
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
        mesh.userData.masterPlanVillaId !== hoveredVillaId;
    });

    prepared.villas.forEach((villa) => {
      const isHovered = villa.id === hoveredVillaId;
      const isFilterMatch = filteredVillaIds.has(villa.id);
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
    prepared.villas,
    selectedVillaId,
    villaStatusById,
  ]);

  useEffect(
    () => () => {
      prepared.villas.forEach((villa) => {
        villa.materials.forEach((material) => material.dispose());
        if (villa.disposeGeometry) {
          villa.meshes.forEach((mesh) => mesh.geometry.dispose());
        }
      });
      prepared.occlusionMaterial.dispose();
    },
    [prepared.occlusionMaterial, prepared.villas],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const id = event.object.userData.masterPlanVillaId as string | undefined;
      const label = event.object.userData.masterPlanVillaLabel as string | undefined;

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
        (intersection) => intersection.object.userData.masterPlanVillaId,
      )?.object.userData.masterPlanVillaId as string | undefined;

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
  filteredApartments,
  onInteractionChange,
  selectedApartmentId,
}: VillasMasterPlanStageProps) {
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

  useEffect(() => {
    onInteractionChange?.(Boolean(hoveredVilla));
  }, [hoveredVilla, onInteractionChange]);

  return (
    <section
      className={`absolute inset-0 overflow-hidden bg-[#00142b] ${
        hoveredVilla ? "cursor-pointer" : "cursor-default"
      }`}
      onPointerLeave={() => handleHover(null)}
    >
      <Image
        src={BACKGROUND_IMAGE_URL}
        alt="Aerial west view of the Laurels villa master plan"
        fill
        priority
        sizes="100vw"
        className="select-none object-cover"
        draggable={false}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_45%,rgba(0,20,43,0.12)_100%)]" />

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
        <CameraRig config={config} />
        <Suspense fallback={null}>
          <VillasModel
            config={config}
            filteredVillaIds={filteredVillaIds}
            hoveredVillaId={hoveredVilla?.id ?? null}
            modelUrl={modelUrl}
            onHover={handleHover}
            selectedVillaId={selectedVillaId}
            villaStatusById={villaStatusById}
          />
        </Suspense>
      </Canvas>

      <LoadingStatus />

      {hoveredVilla ? (
        <div
          className="pointer-events-none absolute z-30 -translate-y-1/2 rounded-full border border-[#fce190]/65 bg-[#00142b]/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fce190] shadow-[0_12px_30px_rgba(0,20,43,0.28)] backdrop-blur-xl"
          style={{
            left: Math.min(tooltipPosition.x + 16, globalThis.innerWidth - 120),
            top: tooltipPosition.y,
          }}
        >
          {hoveredVilla.label}
        </div>
      ) : null}
    </section>
  );
}
