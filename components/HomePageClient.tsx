"use client";

import HeroSection from "@/components/sections/HeroSection";

export default function HomePageClient({ imageSrc }: { imageSrc: string }) {
  return (
    <main
      aria-hidden={false}
      data-home-static
      className="app-screen overflow-hidden bg-neutral-950 text-white"
    >
      <HeroSection imageSrc={imageSrc} />
    </main>
  );
}
