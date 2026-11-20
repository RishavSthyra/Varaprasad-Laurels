import Image from "next/image";
import preview from "@/data/masterplan-preview.json";
import styles from "./MasterPlanViewport.module.css";

export const MASTERPLAN_COMPACT_MEDIA = "(max-width: 1023px), (max-width: 1366px) and (pointer: coarse)";
export const MASTERPLAN_DESKTOP_MEDIA = "(min-width: 1367px), (min-width: 1024px) and (pointer: fine)";

/** Real preview in server HTML; tiny inline placeholder paints without a fetch. */
export function MasterPlanPreview() {
  return <picture data-masterplan-preview>
    <source media={MASTERPLAN_COMPACT_MEDIA} srcSet={preview.mobile} />
    <Image src={preview.desktop} alt="Aerial west view of the Laurels villa master plan"
      fill sizes="100vw" unoptimized loading="eager" fetchPriority="high"
      placeholder="blur" blurDataURL={preview.blurDataURL}
      className="select-none object-contain" draggable={false} />
  </picture>;
}

/** Shown while the separately loaded 3D/video code downloads, not a blue screen. */
export function MasterPlanStagePlaceholder() {
  return <div className={styles.placeholder} data-masterplan-stage-placeholder>
    <div className={styles.frame}><MasterPlanPreview /></div>
  </div>;
}
