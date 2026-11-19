import source from "@/data/Varaprasad_Interior_Pano_Data_v1.json";
import navigation from "@/data/villa-interior-navigation.json";
import { imageFilenameToPanoId } from "@/lib/exterior-tour/nodes";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import type { InteriorTourSection } from "@/lib/interior-tour/sections";
import type { InteriorEntryViews } from "@/lib/interior-tour/floor-navigation";
import type { InteriorDeveloperConfig } from "@/types/developer-config";

// Verified processed Cloudflare assets. Shared navigation corrections below
// remain independent of where metadata, previews and tiles are hosted.
export const VILLA_INTERIOR_BASE_PATH = "Varaprasad_Laurels/Panos/varaprasad_villa_1_interior/";
// Processed R2 tiles: PanoAssetStore signs Worker URLs on demand, never using
// the private S3 API or downloading the raw full-size balcony sources.
export const VILLA_BALCONY_BASE_PATH = "Varaprasad_Laurels/Panos/varaprasad_villa_balconyPanos/";
// Visually reviewed source stops: the two black first-floor balcony renders,
// and the second-floor path endpoint at the balcony's glazed doors. Do not
// replace SF_CAM2: its dark images are the cinema/bar, not an outdoor balcony.
export const VILLA_BALCONY_NODE_FLOORS: Readonly<Record<string, 1 | 2>> = {
  FF_CAM2_F0007: 1,
  FF_CAM2_F0008: 1,
  SF_CAM1_F0003: 2,
};
export const VILLA_BALCONY_DESTINATIONS = {
  first: { nodeId: "FF_CAM2_F0007", returnNodeId: "FF_CAM2_F0006" },
  second: { nodeId: "SF_CAM1_F0003", returnNodeId: "SF_CAM1_F0002" },
} as const;
// All 154 supplied balcony previews were visually reviewed at their native
// centre. It frames the seating/open balcony; the shared interior's camera yaw
// must not be carried into these separately rendered villa-specific images.
export const VILLA_BALCONY_ENTRY_VIEWS: InteriorEntryViews = Object.fromEntries(
  Object.keys(VILLA_BALCONY_NODE_FLOORS).map(id => [id, { yaw: 0, pitch: 0, zoom: 10 }]),
);
export const VILLA_INTERIOR_SOURCE_NODES: ExteriorPanoNodeSource[] = source;
export const VILLA_INTERIOR_DUPLICATE_RENDERS: Readonly<Record<string, string>> = navigation.duplicateRenders;
// This export's positive yaw turns the render in the opposite direction to
// viewer yaw. Reflect the entire coordinate basis, not just the arrival yaw:
// directional buttons, 3D links and preloading must all use the same basis.
export const VILLA_INTERIOR_NODES: ExteriorPanoNodeSource[] = source
  .filter((node) => !VILLA_INTERIOR_DUPLICATE_RENDERS[node.id])
  .map((node) => ({
    ...node, y: -node.y, yaw: -node.yaw,
    forward_vector: { ...node.forward_vector, y: -node.forward_vector.y },
    right_vector: { ...node.right_vector, y: -node.right_vector.y },
    left_vector: { ...node.left_vector, y: -node.left_vector.y },
  }));
const floors = [
  { id: "ground", label: "Ground floor", prefix: "GF_", entry: "GF_CAM5_F0000", yaw: -70 },
  { id: "first", label: "First floor", prefix: "FF_", entry: "FF_CAM1_F0000", yaw: 0 },
  // SF_CAM0 starts in a wardrobe; enter at the actual second-floor landing.
  { id: "second", label: "Second floor", prefix: "SF_", entry: "SF_CAM1_F0000", yaw: 0 },
] as const;
export const VILLA_INTERIOR_SECTIONS: InteriorTourSection[] = floors.map((floor) => ({
  id: floor.id, label: floor.label, initialNodeId: floor.entry,
  nodeIds: VILLA_INTERIOR_NODES.filter((node) => node.id.startsWith(floor.prefix)).map((node) => node.id),
}));
export const VILLA_INTERIOR_ENTRY_VIEWS: InteriorEntryViews = Object.fromEntries(floors.map((floor) => [
  floor.entry, { yaw: floor.yaw * Math.PI / 180, pitch: 0, zoom: 10 },
]));
export const VILLA_INTERIOR_FOLDERS = Object.fromEntries(VILLA_INTERIOR_SOURCE_NODES.map((node) => [
  node.id, imageFilenameToPanoId(node.image_filename),
]));
export const VILLA_INTERIOR_NODE_LABELS = Object.fromEntries(VILLA_INTERIOR_NODES.map((node) => {
  const match = /CAM(\d+)_F(\d+)$/.exec(node.id);
  return [node.id, match ? `Camera ${Number(match[1]) + 1} · View ${Number(match[2]) + 1}` : node.id];
}));
const paths = new Map<string, ExteriorPanoNodeSource[]>();
for (const node of VILLA_INTERIOR_NODES) {
  const key = node.id.replace(/_F\d+$/, "");
  paths.set(key, [...(paths.get(key) ?? []), node]);
}
export const VILLA_INTERIOR_NAVIGATION_PAIRS: ReadonlyArray<readonly [string, string]> = [...paths.values()].flatMap((nodes) => {
  const ordered = [...nodes].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
  return ordered.flatMap((node, index): [string, string][] => {
    const previous = ordered[index - 1];
    return previous && (previous.frame ?? 0) + 1 === node.frame ? [[previous.id, node.id]] : [];
  });
});
export const VILLA_INTERIOR_CONFIG: InteriorDeveloperConfig = {
  furnishedPanoBasePath: VILLA_INTERIOR_BASE_PATH,
  bareShellPanoBasePath: VILLA_INTERIOR_BASE_PATH,
  balconyPanoBasePath: VILLA_INTERIOR_BASE_PATH,
  furnishedNodes: VILLA_INTERIOR_NODES, bareShellNodes: VILLA_INTERIOR_NODES,
  furnishedInitialNodeId: floors[0].entry, bareShellInitialNodeId: floors[0].entry,
};
/** Keep the shared walking graph/coordinates intact; only the render set at
 * the balcony destinations changes with the selected villa. One supplied
 * first-floor image serves both existing balcony walking stops. */
export function getVillaInteriorTour(villaNumber: number) {
  if (!Number.isInteger(villaNumber) || villaNumber < 1 || villaNumber > 78 || villaNumber === 21) {
    throw new Error(`No balcony panorama set for villa ${villaNumber}`);
  }
  const folders = { ...VILLA_INTERIOR_FOLDERS };
  const labels = { ...VILLA_INTERIOR_NODE_LABELS };
  const balconyNodes = VILLA_INTERIOR_NODES.filter((node) => VILLA_BALCONY_NODE_FLOORS[node.id]);
  for (const node of balconyNodes) {
    const floor = VILLA_BALCONY_NODE_FLOORS[node.id];
    // Balcony 01 is SECOND floor; Balcony 02 is FIRST floor.
    folders[node.id] = `Villa ${String(villaNumber).padStart(2, "0")} Balcony ${floor === 2 ? "01" : "02"}`;
    labels[node.id] = floor === 2 ? "Second-floor balcony" : "First-floor balcony";
    if (node.id === "FF_CAM2_F0008") labels[node.id] += " · View 2";
  }
  const interiorNodes = VILLA_INTERIOR_NODES.filter((node) => !VILLA_BALCONY_NODE_FLOORS[node.id]);
  const config: InteriorDeveloperConfig = {
    ...VILLA_INTERIOR_CONFIG,
    balconyPanoBasePath: VILLA_BALCONY_BASE_PATH,
    furnishedNodes: interiorNodes,
    balconyNodes,
  };
  return { config, folders, labels };
}
export function getVillaInteriorEntry(floor?: string, nodeId?: string) {
  if (nodeId && VILLA_INTERIOR_FOLDERS[nodeId]) return VILLA_INTERIOR_DUPLICATE_RENDERS[nodeId] ?? nodeId;
  return (VILLA_INTERIOR_SECTIONS.find((section) => section.id === floor) ?? VILLA_INTERIOR_SECTIONS[0]).initialNodeId;
}
