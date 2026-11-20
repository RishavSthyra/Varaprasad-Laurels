import { EXTERIOR_AMENITY_REFERENCES, type ExteriorAmenityReference } from "@/lib/exterior-tour/amenity-minimap";
import type { CSSProperties } from "react";
import styles from "./ExteriorAmenityMinimapPoints.module.css";

export default function ExteriorAmenityMinimapPoints({ compact, zoom, activeNodeId, isNavigating, onNavigate }: {
  compact: boolean;
  zoom: number;
  activeNodeId: string;
  isNavigating: boolean;
  onNavigate: (marker: ExteriorAmenityReference) => void;
}) {
  return (
    <div
      className={styles.layer}
      data-exterior-amenity-references={compact ? "compact" : "expanded"}
      style={{ "--reference-inverse-zoom": compact ? 1 : 1 / zoom } as CSSProperties}
    >
      {EXTERIOR_AMENITY_REFERENCES.map((marker) => {
        const position = { left: `${marker.leftPercent * 100}%`, top: `${marker.topPercent * 100}%` };
        const label = `Go to ${marker.name}`;
        return (
          <button
            key={marker.number}
            type="button"
            className={`${styles.point} ${compact ? styles.compact : ""}`}
            style={position}
            title={process.env.NODE_ENV === "development" ? `${marker.name} · Reference #${marker.number}` : marker.name}
            aria-label={label}
            aria-pressed={marker.nodeId === activeNodeId}
            disabled={isNavigating}
            tabIndex={compact ? -1 : 0}
            data-exterior-amenity-number={marker.number}
            data-pano-assigned="true"
            data-pano-node={marker.nodeId}
            onPointerDown={event => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(marker);
            }}
          >
            <span className={styles.dot} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
