import type { MarkerConfig } from "@photo-sphere-viewer/markers-plugin";
import { getFloorMarkerProjection, type InteriorFloorMarker } from "@/lib/interior-tour/floor-navigation";
import styles from "./InteriorFloorMarkers.module.css";

/** All signs are fixed 3D planes, including signs floating over the stairs. */
export function createInteriorFloorMarker(
  marker: InteriorFloorMarker,
  navigate: (targetNodeId: string) => void,
): MarkerConfig {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${styles.marker} ${marker.presentation === "floating" ? styles.floating : ""} psv--capture-event`;
  button.dataset.floorMarkerId = marker.id;
  button.dataset.floorMarkerPresentation = marker.presentation ?? "wall";
  button.setAttribute("aria-label", `Go ${marker.direction} to ${marker.label}`);
  const content = document.createElement("span");
  content.className = styles.content;
  // Staircase + directional arrow; constant SVG paths, never user-supplied HTML.
  content.innerHTML = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 52h12V40h12V28h12V16h12"/><path d="${marker.direction === "up" ? "M12 29V10m-7 7 7-7 7 7" : "M12 10v19m-7-7 7 7 7-7"}"/></svg>`;
  const label = document.createElement("span");
  label.textContent = marker.label;
  content.append(label);
  button.append(content);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(marker.targetNodeId);
  });
  return {
    id: `floor-${marker.id}`, elementLayer: button,
    ...getFloorMarkerProjection(marker),
  };
}
