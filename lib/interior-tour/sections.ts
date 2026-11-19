import { buildExteriorTourGraph } from "@/lib/exterior-tour/nodes";
import type { ExteriorPanoNodeSource, ExteriorTourGraph } from "@/lib/exterior-tour/types";

export type InteriorTourSection = {
  id: string;
  label: string;
  nodeIds: readonly string[];
  initialNodeId: string;
};

/** Build spatial neighbours separately: overlapping XY coordinates on different
 * floors must never become an implicit stair/lift connection. Legacy tours keep
 * their original graph unchanged when no sections are supplied. */
export function buildInteriorTourGraph(
  nodes: ExteriorPanoNodeSource[],
  sections?: readonly InteriorTourSection[],
): ExteriorTourGraph {
  if (!sections?.length) return buildExteriorTourGraph(nodes);
  const grouped = new Set(sections.flatMap((section) => [...section.nodeIds]));
  const graphs = sections.map((section) => {
    const ids = new Set(section.nodeIds);
    return buildExteriorTourGraph(nodes.filter((node) => ids.has(node.id)));
  });
  const ungrouped = nodes.filter((node) => !grouped.has(node.id));
  if (ungrouped.length) graphs.push(buildExteriorTourGraph(ungrouped));
  const combined = graphs.flatMap((graph) => graph.nodes).map((node, order) => ({ ...node, order }));
  return {
    nodes: combined,
    byId: Object.fromEntries(combined.map((node) => [node.id, node])),
    order: combined.map((node) => node.id),
    medianNearestDistance: graphs.length
      ? graphs.reduce((sum, graph) => sum + graph.medianNearestDistance, 0) / graphs.length
      : 1,
  };
}
