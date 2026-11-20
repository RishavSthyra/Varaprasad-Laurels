import { EXTERIOR_AMENITY_REFERENCES } from "@/lib/exterior-tour/amenity-minimap";
import type { CSSProperties } from "react";
import styles from "./ExteriorAmenityMinimapPoints.module.css";

export default function ExteriorAmenityMinimapPoints({ compact, zoom }: { compact: boolean; zoom: number }) {
  return (
    <div
      className={styles.layer}
      data-exterior-amenity-references={compact ? "compact" : "expanded"}
      style={{ "--reference-inverse-zoom": compact ? 1 : 1 / zoom } as CSSProperties}
    >
      {EXTERIOR_AMENITY_REFERENCES.map((marker) => {
        const position = { left: `${marker.leftPercent * 100}%`, top: `${marker.topPercent * 100}%` };
        const label = `Reference ${marker.number}: ${marker.name}`;
        // The compact map is itself an expand button; do not nest buttons in it.
        return compact ? (
          <span key={marker.number} className={`${styles.point} ${styles.compact}`} style={position} aria-hidden="true">
            <span>{marker.number}</span>
          </span>
        ) : (
          <button
            key={marker.number}
            type="button"
            className={styles.point}
            style={position}
            title={label}
            aria-label={label}
            data-exterior-amenity-number={marker.number}
            data-pano-assigned="false"
            onClick={(event) => event.stopPropagation()}
          >
            {marker.number}
          </button>
        );
      })}
    </div>
  );
}
