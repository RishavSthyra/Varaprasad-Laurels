import { MasterPlanStagePlaceholder } from "@/components/MasterPlanPreview";
import styles from "@/components/MasterPlanViewport.module.css";

export default function MasterPlanLoading() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-[#00142b]">
      <div className={styles.stage}><MasterPlanStagePlaceholder /></div>
      <div className={styles.loadingFilters} aria-hidden="true">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">Filters</p>
        <p className="mt-2 font-serif text-3xl">Find a villa</p>
        <div className="mt-4 h-11 rounded-full border border-[#00142b]/20" />
      </div>
    </section>
  );
}
