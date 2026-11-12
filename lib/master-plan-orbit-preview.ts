import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CatmullRomCurve3,
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { getThreeDsMaxMasterPlanConfig } from "@/lib/master-plan-3dsmax-trial";
import {
  MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL,
  MASTER_PLAN_ORBIT_VIDEO_URL,
} from "@/lib/master-plan-asset-keys";
import {
  MASTER_PLAN_HOTSPOT_FRAMES,
  MASTER_PLAN_HOTSPOT_KEYS,
  type MasterPlanHotspotKey,
} from "@/lib/master-plan-hotspots";
import type {
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  Vector3Config,
} from "@/types/developer-config";

const PREVIEW_CAMERA_DATA_PATH = join(
  process.cwd(),
  "data/master-plan-orbit-camera.json",
);

const GLB_DUMMY_ANCHOR_MM = new Vector3(89948, 1334, -57740);
const GLB_DUMMY_001_ANCHOR_MM = new Vector3(
  -72212.390625,
  1334,
  -78069.2578125,
);
const RENDER_DUMMY_ANCHOR_CM = new Vector3(9036.03516, 124.94747, -5798.80847);
const RENDER_DUMMY_001_ANCHOR_CM = new Vector3(
  -7179.91807,
  124.88676,
  -7837.97368,
);

type OrbitPreviewFrame = {
  frame: number;
  forward_vector: Vector3Config;
  right_vector: Vector3Config;
  x: number;
  y: number;
  z: number;
};

export type OrbitPreviewOptions = {
  debugModel?: boolean;
  fov?: number;
  hotspotFrames?: readonly number[];
  hotspotKeys?: readonly MasterPlanHotspotKey[];
  maxMetersCalibration?: {
    cameraStops: readonly {
      frame: number;
      position: Vector3Config;
      rotationDegrees?: Vector3Config;
      projectionOffsetY?: number;
    }[];
    dummyAnchors: readonly [Vector3Config, Vector3Config];
    target?: Vector3Config;
  };
  modelOffset?: Partial<Vector3Config>;
  modelScaleMultiplier?: number;
  modelYawOffsetDegrees?: number;
};

function renderToThreeVector(point: Vector3Config) {
  return new Vector3(point.x, point.z, point.y);
}

function buildCameraQuaternion(frame: OrbitPreviewFrame) {
  const forward = renderToThreeVector(frame.forward_vector).normalize();
  const right = renderToThreeVector(frame.right_vector).normalize();
  const up = right.clone().cross(forward).normalize();
  const back = forward.clone().negate();
  const rotationMatrix = new Matrix4().makeBasis(right, up, back);

  return new Quaternion().setFromRotationMatrix(rotationMatrix).normalize();
}

function buildCameraConfig(
  frame: OrbitPreviewFrame,
  horizontalFov: number,
): MasterPlanCameraConfig {
  const position = renderToThreeVector({
    x: frame.x,
    y: frame.y,
    z: frame.z,
  });
  const quaternion = buildCameraQuaternion(frame);

  return {
    fov: horizontalFov,
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

function maxMetersToThreeMillimeters(point: Vector3Config) {
  return new Vector3(point.x * 1000, point.z * 1000, -point.y * 1000);
}

function vectorToConfig(point: Vector3): Vector3Config {
  return { x: point.x, y: point.y, z: point.z };
}

function buildLookAtQuaternion(position: Vector3, target: Vector3) {
  const back = position.clone().sub(target).normalize();
  const right = new Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right).normalize();
  const rotationMatrix = new Matrix4().makeBasis(right, up, back);

  return new Quaternion().setFromRotationMatrix(rotationMatrix).normalize();
}

function buildThreeQuaternionFromMaxRotation(
  rotationDegrees: Vector3Config,
) {
  const maxQuaternion = new Quaternion().setFromEuler(
    new Euler(
      (rotationDegrees.x * Math.PI) / 180,
      (rotationDegrees.y * Math.PI) / 180,
      (rotationDegrees.z * Math.PI) / 180,
      "ZYX",
    ),
  );
  const maxToThreeBasis = new Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, -1, 0, 0,
    0, 0, 0, 1,
  );
  const threeRotationMatrix = maxToThreeBasis
    .clone()
    .multiply(new Matrix4().makeRotationFromQuaternion(maxQuaternion))
    .multiply(maxToThreeBasis.clone().invert());
  const basisQuaternion = new Quaternion().setFromRotationMatrix(
    threeRotationMatrix,
  );
  const cameraForwardAxisCorrection = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
  );

  return basisQuaternion
    .multiply(cameraForwardAxisCorrection)
    .normalize();
}

function sourceFrameToCameraIndex(frame: number, totalFrames: number) {
  return ((Math.round(frame) % totalFrames) + totalFrames) % totalFrames;
}

function buildMaxMetersFrameCameras(
  calibration: NonNullable<OrbitPreviewOptions["maxMetersCalibration"]>,
  horizontalFov: number,
  totalFrames: number,
) {
  if (calibration.cameraStops.length < 2) {
    throw new Error("At least two 3ds Max camera stops are required.");
  }

  const stops = calibration.cameraStops
    .map((stop) => ({
      // Vantage exports zero-based frame numbers. The scrub UI converts these
      // to one-based values separately.
      frameIndex: sourceFrameToCameraIndex(stop.frame, totalFrames),
      position: maxMetersToThreeMillimeters(stop.position),
      quaternion: stop.rotationDegrees
        ? buildThreeQuaternionFromMaxRotation(stop.rotationDegrees)
        : null,
      projectionOffsetY: stop.projectionOffsetY ?? 0,
    }))
    .sort((left, right) => left.frameIndex - right.frameIndex);
  const uniqueFrameIndexes = new Set(stops.map((stop) => stop.frameIndex));

  if (uniqueFrameIndexes.size !== stops.length) {
    throw new Error("3ds Max camera stops must use distinct frames.");
  }

  const [dummyAnchorA, dummyAnchorB] = calibration.dummyAnchors.map(
    maxMetersToThreeMillimeters,
  );
  const target = calibration.target
    ? maxMetersToThreeMillimeters(calibration.target)
    : dummyAnchorA.clone().add(dummyAnchorB).multiplyScalar(0.5);
  const cameraCurve = new CatmullRomCurve3(
    stops.map((stop) => stop.position),
    true,
    "centripetal",
  );

  return Array.from({ length: totalFrames }, (_, frameIndex) => {
    let segmentIndex = stops.length - 1;

    for (let index = 0; index < stops.length; index += 1) {
      const startFrame = stops[index].frameIndex;
      const endFrame =
        index === stops.length - 1
          ? stops[0].frameIndex + totalFrames
          : stops[index + 1].frameIndex;
      const adjustedFrame =
        index === stops.length - 1 && frameIndex < startFrame
          ? frameIndex + totalFrames
          : frameIndex;

      if (adjustedFrame >= startFrame && adjustedFrame <= endFrame) {
        segmentIndex = index;
        break;
      }
    }

    const startFrame = stops[segmentIndex].frameIndex;
    const endFrame =
      segmentIndex === stops.length - 1
        ? stops[0].frameIndex + totalFrames
        : stops[segmentIndex + 1].frameIndex;
    const adjustedFrame =
      segmentIndex === stops.length - 1 && frameIndex < startFrame
        ? frameIndex + totalFrames
        : frameIndex;
    const segmentProgress = Math.max(
      0,
      Math.min(
        1,
        (adjustedFrame - startFrame) / Math.max(endFrame - startFrame, 1),
      ),
    );
    const curveProgress = (segmentIndex + segmentProgress) / stops.length;
    const position = cameraCurve.getPoint(curveProgress);
    const startQuaternion = stops[segmentIndex].quaternion;
    const endQuaternion = stops[(segmentIndex + 1) % stops.length].quaternion;
    const projectionOffsetY = MathUtils.lerp(
      stops[segmentIndex].projectionOffsetY,
      stops[(segmentIndex + 1) % stops.length].projectionOffsetY,
      segmentProgress,
    );
    const quaternion =
      startQuaternion && endQuaternion
        ? startQuaternion.clone().slerp(endQuaternion, segmentProgress)
        : buildLookAtQuaternion(position, target);

    return {
      fov: horizontalFov,
      projectionOffsetY,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      quaternion: [
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w,
      ],
    } satisfies MasterPlanCameraConfig;
  });
}

function buildModelTransform(options: OrbitPreviewOptions) {
  const modelDelta = GLB_DUMMY_001_ANCHOR_MM.clone().sub(GLB_DUMMY_ANCHOR_MM);
  const [renderAnchor, renderAnchor001] = options.maxMetersCalibration
    ? options.maxMetersCalibration.dummyAnchors.map(
        maxMetersToThreeMillimeters,
      )
    : [RENDER_DUMMY_ANCHOR_CM.clone(), RENDER_DUMMY_001_ANCHOR_CM.clone()];
  const renderDelta = renderAnchor001.clone().sub(renderAnchor);
  const modelDeltaXZ = new Vector3(modelDelta.x, 0, modelDelta.z);
  const renderDeltaXZ = new Vector3(renderDelta.x, 0, renderDelta.z);
  const baseScale = renderDeltaXZ.length() / modelDeltaXZ.length();
  const scale = baseScale * (options.modelScaleMultiplier ?? 1);
  const modelYaw = Math.atan2(modelDeltaXZ.x, modelDeltaXZ.z);
  const renderYaw = Math.atan2(renderDeltaXZ.x, renderDeltaXZ.z);
  const yawOffset =
    renderYaw -
    modelYaw +
    ((options.modelYawOffsetDegrees ?? 0) * Math.PI) / 180;
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    yawOffset,
  );
  const position = renderAnchor.clone().sub(
    GLB_DUMMY_ANCHOR_MM.clone()
      .applyQuaternion(quaternion)
      .multiplyScalar(scale),
  );

  position.add(
    new Vector3(
      options.modelOffset?.x ?? 0,
      options.modelOffset?.y ?? 0,
      options.modelOffset?.z ?? 0,
    ),
  );

  return {
    position: position.toArray(),
    quaternion: quaternion.toArray(),
    scale,
  } satisfies MasterPlanDeveloperConfig["towerATransform"];
}

function readOrbitPreviewFrames() {
  const frames = JSON.parse(
    readFileSync(PREVIEW_CAMERA_DATA_PATH, "utf8"),
  ) as OrbitPreviewFrame[];

  if (frames.length !== 360) {
    throw new Error(
      `Expected 360 master-plan preview cameras, received ${frames.length}.`,
    );
  }

  return frames;
}

export function getOrbitPreviewMasterPlanConfig(
  options: OrbitPreviewOptions = {},
): MasterPlanDeveloperConfig {
  const baseConfig = getThreeDsMaxMasterPlanConfig();
  const horizontalFov = options.fov ?? 60;
  const frameCameras = options.maxMetersCalibration
    ? buildMaxMetersFrameCameras(
        options.maxMetersCalibration,
        horizontalFov,
        360,
      )
    : readOrbitPreviewFrames().map((frame) =>
        buildCameraConfig(frame, horizontalFov),
      );
  const sourceHotspotFrames =
    options.hotspotFrames?.length === MASTER_PLAN_HOTSPOT_KEYS.length
      ? [...options.hotspotFrames]
      : [...MASTER_PLAN_HOTSPOT_FRAMES];
  const hotspotFrames = options.maxMetersCalibration
    ? sourceHotspotFrames.map(
        (frame) => sourceFrameToCameraIndex(frame, 360) + 1,
      )
    : sourceHotspotFrames;
  const hotspotKeys =
    options.hotspotKeys?.length === MASTER_PLAN_HOTSPOT_KEYS.length &&
    new Set(options.hotspotKeys).size === MASTER_PLAN_HOTSPOT_KEYS.length
      ? [...options.hotspotKeys]
      : [...MASTER_PLAN_HOTSPOT_KEYS];
  const cameras = Object.fromEntries(
    hotspotKeys.map((key, index) => [
      key,
      frameCameras[
        sourceFrameToCameraIndex(
          sourceHotspotFrames[index],
          frameCameras.length,
        )
      ],
    ]),
  ) as Record<string, MasterPlanCameraConfig>;
  const transform = buildModelTransform(options);
  const calibratedWorldDummies = options.maxMetersCalibration?.dummyAnchors.map(
    (anchor) => maxMetersToThreeMillimeters(anchor),
  );
  const worldDummies = calibratedWorldDummies
    ? {
        dummy1: vectorToConfig(calibratedWorldDummies[0]),
        dummy2: vectorToConfig(calibratedWorldDummies[1]),
        dummy3: vectorToConfig(calibratedWorldDummies[1]),
        dummy4: vectorToConfig(calibratedWorldDummies[0]),
      }
    : {
        dummy1: { x: 9036.03516, y: -5798.80847, z: 124.94747 },
        dummy2: { x: -7179.91807, y: -7837.97368, z: 124.88676 },
        dummy3: { x: -7179.91807, y: -7837.97368, z: 124.88676 },
        dummy4: { x: 9036.03516, y: -5798.80847, z: 124.94747 },
      };

  return {
    ...baseConfig,
    aspectRatio: 16 / 9,
    debugModel: options.debugModel ?? false,
    fallbackImageKey: MASTER_PLAN_ORBIT_FALLBACK_IMAGE_URL,
    fps: 60,
    frameCameras,
    hotspotFrames,
    hotspots: hotspotKeys.map((key, index) => ({
      camera: cameras[key],
      frame: hotspotFrames[index],
      key,
    })),
    interactionVideoKey: MASTER_PLAN_ORBIT_VIDEO_URL,
    reverseHotspotDirection: true,
    scrubVideoKey: MASTER_PLAN_ORBIT_VIDEO_URL,
    totalFrames: 360,
    towerACameras: cameras,
    towerAWorldDummies: worldDummies,
    towerATransform: transform,
    towerBCameras: cameras,
    towerBWorldDummies: worldDummies,
    towerBTransform: transform,
  };
}
