import {
  BufferGeometry, CircleGeometry, DataTexture, DoubleSide,
  Group, Mesh, MeshBasicMaterial,
  PlaneGeometry, RingGeometry, RGBAFormat, Vector3,
} from "three";
import type { VillaPointer } from "./villa-hotspots";

export const GROUND_POINTER_MODEL_URL = "/models/arrow.glb";
const radians = (degrees: number) => degrees * Math.PI / 180;

export function getGroundPointerMotion(seconds: number, reducedMotion = false,
  options = { bounceHeightMetres: 0.07, bouncePeriodSeconds: 1.8, rotationPeriodSeconds: 5.5 }) {
  const lift = reducedMotion ? 0 : (1 - Math.cos(seconds * Math.PI * 2 / options.bouncePeriodSeconds)) / 2;
  return {
    lift: lift * options.bounceHeightMetres,
    rotation: reducedMotion ? 0 : seconds * Math.PI * 2 / options.rotationPeriodSeconds,
    shadowScale: 1 - lift * 0.18,
    shadowOpacity: 0.30 - lift * 0.10,
  };
}

export function createGroundPointer(source: BufferGeometry, config: VillaPointer) {
  const group = new Group();
  group.name = `exterior-ground-pointer-${config.id}`;
  // The tiled pano adapter paints transparent tiles at renderOrder=1 without
  // depth testing. Marker meshes must share the transparent render queue and
  // sort after those tiles, or a loaded tile can erase the otherwise-solid arrow.
  group.renderOrder = 20;
  const yaw = radians(config.position.yawDegrees);
  const pitch = radians(config.position.pitchDegrees);
  const distance = config.position.distanceMetres;
  group.position.set(
    -Math.sin(yaw) * Math.cos(pitch) * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const center = bounds.getCenter(new Vector3());
  const height = bounds.max.y - bounds.min.y;
  geometry.translate(-center.x, -bounds.min.y, -center.z);
  const scale = config.heightMetres / Math.max(height, 0.001);
  geometry.scale(scale, scale, scale);
  // Unlit white stays white, without adding lights to the panorama scene.
  const arrow = new Mesh(geometry, new MeshBasicMaterial({
    color: config.color, side: DoubleSide, transparent: true, opacity: 1, depthWrite: true,
  }));
  const rotating = new Group();
  rotating.renderOrder = group.renderOrder;
  rotating.rotation.order = "YXZ";
  rotating.rotation.set(radians(config.rotation.pitchDegrees), radians(config.rotation.yawDegrees), radians(config.rotation.rollDegrees));
  group.add(rotating);
  arrow.name = "bouncing-arrow";
  arrow.renderOrder = 3;
  const baseLift = config.heightMetres * 0.16;
  arrow.position.y = baseLift;
  rotating.add(arrow);

  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      pixels[(y * 64 + x) * 4 + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255);
    }
  }
  const shadowTexture = new DataTexture(pixels, 64, 64, RGBAFormat);
  shadowTexture.needsUpdate = true;
  const shadowMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.3, depthWrite: false });
  const footprint = config.heightMetres / 0.62;
  const shadow = new Mesh(new PlaneGeometry(footprint, footprint), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  const ring = new Mesh(new RingGeometry(0.29 * footprint, 0.31 * footprint, 48), new MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.65, depthWrite: false, side: DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 2;
  ring.position.y = 0.012;
  const centerDisc = new Mesh(new CircleGeometry(0.27 * footprint, 32), new MeshBasicMaterial({ color: config.color, transparent: true, opacity: 0.08, depthWrite: false }));
  centerDisc.rotation.x = -Math.PI / 2;
  centerDisc.renderOrder = 1;
  centerDisc.position.y = 0.01;
  group.add(shadow, ring, centerDisc);
  // A projected, keyboard-accessible link handles hit testing above the canvas.
  group.traverse((object) => { if (object instanceof Mesh) object.raycast = () => {}; });

  const update = (seconds: number, reducedMotion = false) => {
    const motion = getGroundPointerMotion(seconds, reducedMotion, config);
    arrow.position.y = baseLift + motion.lift;
    arrow.rotation.y = motion.rotation;
    shadow.scale.setScalar(motion.shadowScale);
    shadowMaterial.opacity = motion.shadowOpacity;
  };
  update(0);
  return {
    group,
    update,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      shadowTexture.dispose();
    },
  };
}
