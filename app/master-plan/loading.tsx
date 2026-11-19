import { VILLA_MASTERPLAN_BACKGROUND_URL } from "@/lib/villa-masterplan-model";

export default function MasterPlanLoading() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${VILLA_MASTERPLAN_BACKGROUND_URL}')`,
        }}
      />
    </section>
  );
}
