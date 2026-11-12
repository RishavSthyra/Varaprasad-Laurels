const PRELOADER_CORNER_LOGO_URL = "/vp_cons_images.webp";

export default function PreloaderCornerLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PRELOADER_CORNER_LOGO_URL}
      alt="Vara Prasad Constructions"
      width={401}
      height={201}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      draggable={false}
      className="pointer-events-none absolute right-[max(env(safe-area-inset-right),1rem)] top-[max(env(safe-area-inset-top),1rem)] z-50 h-auto w-[clamp(8.5rem,18vw,13rem)] select-none object-contain drop-shadow-[0_8px_22px_rgba(0,0,0,0.28)] sm:right-[max(env(safe-area-inset-right),1.5rem)] sm:top-[max(env(safe-area-inset-top),1.5rem)]"
    />
  );
}
