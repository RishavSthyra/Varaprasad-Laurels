import { Euler, Matrix4, Quaternion, Vector3 } from "three";

import { getThreeDsMaxMasterPlanConfig } from "@/lib/master-plan-3dsmax-trial";
import { VILLA_MASTERPLAN_BACKGROUND_KEY, VILLA_MASTERPLAN_MODEL_KEY } from "@/lib/villa-masterplan-model";
import { getVillaOrbitMidpointFrames, VILLA_MASTERPLAN_SECOND_STOP_SOURCE_FRAME, VILLA_MASTERPLAN_VIDEO_FPS, VILLA_MASTERPLAN_VIDEO_FRAMES, VILLA_MASTERPLAN_VIDEO_KEY } from "@/lib/villa-masterplan-video";
import type {
  MasterPlanCameraConfig,
  MasterPlanDeveloperConfig,
  Vector3Config,
} from "@/types/developer-config";

const CAMERA_POSITION_MM: Vector3Config = {
  x: -469245.944,
  y: -374528.689,
  z: 205835.847,
};

const CAMERA_ROTATION_DEGREES: Vector3Config = {
  x: 67.133,
  y: 0,
  z: -46.65,
};

// 02_Gates Edited_Camera 027_001. Preserve the supplied millimetres/degrees;
// frame selection is independent of the world-space camera/model calibration.

const SECOND_CAMERA_POSITION_MM: Vector3Config = {
  x: 374850.68, y: 251392.626, z: 210660.86,
};

const SECOND_CAMERA_ROTATION_DEGREES: Vector3Config = {
  x: 67.085, y: 0, z: 118.366,
};

// 3ds Max reports this camera value horizontally; Three.js expects a
// vertical field of view for PerspectiveCamera.
const CAMERA_HORIZONTAL_FOV_DEGREES = 29.172;
const CAMERA_FRAME_ASPECT = 16 / 9;

// These are the explicitly named dummy01-dummy03 anchors in villa 01.glb.
// The glTF exporter has already converted the model from Z-up to Y-up.
const MODEL_DUMMY_ANCHORS = [
  new Vector3(-248.828, 0, 119.706578),
  new Vector3(-136.172969, 0, 206.5465),
  new Vector3(103.800969, 0, -65.576281),
] as const;

const WORLD_DUMMY_COORDINATES_MM: readonly Vector3Config[] = [
  { x: -248999.828, y: -119706.578, z: 0 },
  { x: -136172.969, y: -206546.5, z: 0 },
  { x: 103800.969, y: 65576.281, z: 0 }, 
];

function maxMillimetersToThreeMeters(point: Vector3Config) {
  return new Vector3(point.x / 1000, point.z / 1000, -point.y / 1000);
}

function maxHorizontalFovToThreeVerticalFov(horizontalFovDegrees: number) {
  const horizontalFovRadians = (horizontalFovDegrees * Math.PI) / 180;

  return (
    (2 *
      Math.atan(
        Math.tan(horizontalFovRadians / 2) / CAMERA_FRAME_ASPECT,
      ) *
      180) /
    Math.PI
  );
}

function buildCameraQuaternion(rotation = CAMERA_ROTATION_DEGREES) {
  const maxQuaternion = new Quaternion().setFromEuler(
    new Euler(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180,
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
  const cameraAxisCorrection = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -Math.PI / 2,
  );

  return new Quaternion()
    .setFromRotationMatrix(threeRotationMatrix)
    .multiply(cameraAxisCorrection)
    .normalize();
}

function buildModelTransform() {
  const worldAnchors = WORLD_DUMMY_COORDINATES_MM.map(
    maxMillimetersToThreeMeters,
  );
  const modelCentroid = MODEL_DUMMY_ANCHORS.reduce(
    (sum, anchor) => sum.add(anchor),
    new Vector3(),
  ).multiplyScalar(1 / MODEL_DUMMY_ANCHORS.length);
  const worldCentroid = worldAnchors
    .reduce((sum, anchor) => sum.add(anchor), new Vector3())
    .multiplyScalar(1 / worldAnchors.length);
  let dotProduct = 0;
  let crossProduct = 0;
  let modelSquaredLength = 0;

  MODEL_DUMMY_ANCHORS.forEach((anchor, index) => {
    const modelPoint = anchor.clone().sub(modelCentroid);
    const worldPoint = worldAnchors[index].clone().sub(worldCentroid);

    dotProduct +=
      modelPoint.x * worldPoint.x + modelPoint.z * worldPoint.z;
    crossProduct +=
      modelPoint.z * worldPoint.x - modelPoint.x * worldPoint.z;
    modelSquaredLength +=
      modelPoint.x * modelPoint.x + modelPoint.z * modelPoint.z;
  });

  const yaw = Math.atan2(crossProduct, dotProduct);
  const scale =
    Math.hypot(dotProduct, crossProduct) / modelSquaredLength;
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    yaw,
  );
  const position = worldCentroid.sub(
    modelCentroid.applyQuaternion(quaternion).multiplyScalar(scale),
  );

  // A uniform scale + yaw can only approximate these exported anchors. Use
  // the three non-collinear points to build the exact planar affine mapping,
  // while retaining the decomposed transform above for existing consumers.
  const modelEdge1 = MODEL_DUMMY_ANCHORS[1]
    .clone()
    .sub(MODEL_DUMMY_ANCHORS[0]);
  const modelEdge2 = MODEL_DUMMY_ANCHORS[2]
    .clone()
    .sub(MODEL_DUMMY_ANCHORS[0]);
  const worldEdge1 = worldAnchors[1].clone().sub(worldAnchors[0]);
  const worldEdge2 = worldAnchors[2].clone().sub(worldAnchors[0]);
  const determinant =
    modelEdge1.x * modelEdge2.z - modelEdge2.x * modelEdge1.z;
  const xx =
    (worldEdge1.x * modelEdge2.z - worldEdge2.x * modelEdge1.z) /
    determinant;
  const xz =
    (-worldEdge1.x * modelEdge2.x + worldEdge2.x * modelEdge1.x) /
    determinant;
  const zx =
    (worldEdge1.z * modelEdge2.z - worldEdge2.z * modelEdge1.z) /
    determinant;
  const zz =
    (-worldEdge1.z * modelEdge2.x + worldEdge2.z * modelEdge1.x) /
    determinant;
  const translationX =
    worldAnchors[0].x -
    xx * MODEL_DUMMY_ANCHORS[0].x -
    xz * MODEL_DUMMY_ANCHORS[0].z;
  const translationZ =
    worldAnchors[0].z -
    zx * MODEL_DUMMY_ANCHORS[0].x -
    zz * MODEL_DUMMY_ANCHORS[0].z;
  const exactMatrix = new Matrix4().set(
    xx, 0, xz, translationX,
    0, 1, 0, 0,
    zx, 0, zz, translationZ,
    0, 0, 0, 1,
  );

  return {
    matrix: exactMatrix.toArray() as [
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
      number, number, number, number,
    ],
    position: position.toArray() as [number, number, number],
    quaternion: quaternion.toArray() as [number, number, number, number],
    scale,
  };
}

function buildCamera(positionMm = CAMERA_POSITION_MM, rotation = CAMERA_ROTATION_DEGREES): MasterPlanCameraConfig {
  const position = maxMillimetersToThreeMeters(positionMm);
  const quaternion = buildCameraQuaternion(rotation);

  return {
    fov: maxHorizontalFovToThreeVerticalFov(
      CAMERA_HORIZONTAL_FOV_DEGREES,
    ),
    position: { x: position.x, y: position.y, z: position.z },
    quaternion: quaternion.toArray() as [number, number, number, number],
  };
}

export function getVillasMasterPlanConfig(): MasterPlanDeveloperConfig {
  const baseConfig = getThreeDsMaxMasterPlanConfig();
  const camera = buildCamera();
  const modelTransform = buildModelTransform();
  const hotspots = [
    { key: "A1", frame: 1, camera },
    { key: "A2", frame: VILLA_MASTERPLAN_SECOND_STOP_SOURCE_FRAME + 1,
      camera: buildCamera(SECOND_CAMERA_POSITION_MM, SECOND_CAMERA_ROTATION_DEGREES) },
  ];
  const cameras = Object.fromEntries(
    hotspots.map((hotspot) => [hotspot.key, hotspot.camera]),
  );

  return {
    ...baseConfig,
    aspectRatio: 16 / 9,
    fps: VILLA_MASTERPLAN_VIDEO_FPS,
    totalFrames: VILLA_MASTERPLAN_VIDEO_FRAMES,
    scrubVideoKey: VILLA_MASTERPLAN_VIDEO_KEY,
    interactionVideoKey: VILLA_MASTERPLAN_VIDEO_KEY,
    fallbackImageKey: VILLA_MASTERPLAN_BACKGROUND_KEY,
    hotspotFrames: hotspots.map((hotspot) => hotspot.frame),
    pauseFrames: getVillaOrbitMidpointFrames(hotspots.map(hotspot => hotspot.frame), VILLA_MASTERPLAN_VIDEO_FRAMES),
    hotspots,
    previewLabel: "Villas master plan",
    towerAModelKey: VILLA_MASTERPLAN_MODEL_KEY,
    towerBModelKey: VILLA_MASTERPLAN_MODEL_KEY,
    towerACameras: cameras,
    towerBCameras: cameras,
    towerATransform: modelTransform,
    towerBTransform: modelTransform,
  };
}
