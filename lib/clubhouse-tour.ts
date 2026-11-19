import source from "@/data/Clubhouse_Pano_Data.json";
import { imageFilenameToPanoId } from "@/lib/exterior-tour/nodes";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import type { InteriorTourSection } from "@/lib/interior-tour/sections";
import type { InteriorDeveloperConfig } from "@/types/developer-config";

// R2 key prefix: PanoAssetStore resolves signed Worker URLs, never the private
// S3 endpoint or the raw 12K source-image directory.
export const CLUBHOUSE_PANO_BASE_PATH = "Varaprasad_Laurels/Panos/varaprasad_clubhouse_panos/";
export const CLUBHOUSE_NODES: ExteriorPanoNodeSource[] = source;
const floors = [
  { id: "ground", label: "Ground floor", prefix: "Ground_" },
  { id: "first", label: "First floor", prefix: "First_" },
  { id: "second", label: "Second floor", prefix: "Second_" },
  { id: "third", label: "Third floor", prefix: "Third_" },
  { id: "fourth", label: "Fourth floor", prefix: "Forth_" },
] as const;

export const CLUBHOUSE_SECTIONS: InteriorTourSection[] = floors.map((floor) => {
  // IDs identify floors reliably even where a render filename says "Thid".
  // Keep the supplied filenames byte-for-byte; never rename or regenerate assets.
  const nodes = CLUBHOUSE_NODES.filter((node) => node.id.startsWith(floor.prefix));
  return { id: floor.id, label: floor.label, nodeIds: nodes.map((node) => node.id), initialNodeId: nodes[0].id };
});
export const CLUBHOUSE_PANO_FOLDERS = Object.fromEntries(
  CLUBHOUSE_NODES.map((node) => [node.id, imageFilenameToPanoId(node.image_filename)]),
);
export const CLUBHOUSE_NODE_LABELS = Object.fromEntries(CLUBHOUSE_NODES.map((node) => {
  const match = /Pano_(\d+)_F(\d+)$/.exec(node.id);
  return [node.id, match ? `Zone ${match[1]} · View ${Number(match[2])}` : node.id];
}));
// Preserve consecutive samples within each exported pano path, including sparse
// points that the distance-based graph would otherwise leave disconnected.
// Do not connect the end of one room/path (or floor) to the start of another.
const paths = new Map<string, ExteriorPanoNodeSource[]>();
for (const node of CLUBHOUSE_NODES) {
  const key = node.id.replace(/_F\d+$/, "");
  paths.set(key, [...(paths.get(key) ?? []), node]);
}
export const CLUBHOUSE_NAVIGATION_PAIRS: ReadonlyArray<readonly [string, string]> = [...paths.values()].flatMap((nodes) => {
  const sorted = [...nodes].sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
  return sorted.flatMap((node, index): [string, string][] => {
    const previous = sorted[index - 1];
    return previous && (previous.frame ?? 0) + 1 === node.frame ? [[previous.id, node.id]] : [];
  });
});
export const CLUBHOUSE_CONFIG: InteriorDeveloperConfig = {
  furnishedPanoBasePath: CLUBHOUSE_PANO_BASE_PATH,
  bareShellPanoBasePath: CLUBHOUSE_PANO_BASE_PATH,
  balconyPanoBasePath: CLUBHOUSE_PANO_BASE_PATH,
  furnishedNodes: CLUBHOUSE_NODES,
  bareShellNodes: CLUBHOUSE_NODES,
  furnishedInitialNodeId: CLUBHOUSE_SECTIONS[0].initialNodeId,
  bareShellInitialNodeId: CLUBHOUSE_SECTIONS[0].initialNodeId,
};

export function getClubhouseEntry(floor?: string, requestedNode?: string) {
  const explicit = requestedNode && CLUBHOUSE_NODES.find((node) => node.id === requestedNode);
  if (explicit) return explicit.id;
  return (CLUBHOUSE_SECTIONS.find((section) => section.id === floor) ?? CLUBHOUSE_SECTIONS[0]).initialNodeId;
}
