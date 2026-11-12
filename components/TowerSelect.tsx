"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";
import type { TowerType } from "@/types/inventory";

export type { TowerType } from "@/types/inventory";

type TowerSelectProps = {
  selectedTower?: TowerType | null;
  onSelectTower?: (tower: TowerType) => void;
  onTopViewClick?: () => void;
  onClose?: () => void;
  embedded?: boolean;
  isTopViewActive?: boolean;
  mobile?: boolean;
  compactDesktop?: boolean;
};

const towerCards: Array<{
  value: TowerType;
  label: string;
  accent: string;
  accentMuted: string;
  accentCheck: string;
  description: string;
  image: string;
  imageAlt: string;
  imageClass: string;
  mobileImageClass: string;
}> = [
  {
    value: "Tower A",
    label: "Garden Villas",
    accent: "border-[#cec3a0] bg-[#faf8f2] ring-1 ring-[#cec3a0]/35",
    accentMuted: "border-[#cec3a0]/25 bg-[#faf8f2]/92 hover:border-[#cec3a0]/60",
    accentCheck: "text-[#9b8753]",
    description: "Private gardens, sunlit living spaces and serene landscape views.",
    image: TOWER_SELECTION_IMAGE_URL,
    imageAlt: "Garden villa exterior",
    imageClass:
      "absolute inset-y-0 left-0 h-full w-[138%] max-w-none object-cover object-left",
    mobileImageClass: "object-cover object-left",
  },
  {
    value: "Tower B",
    label: "Grand Villas",
    accent: "border-[#cec3a0] bg-[#faf8f2] ring-1 ring-[#cec3a0]/35",
    accentMuted: "border-[#cec3a0]/25 bg-[#faf8f2]/92 hover:border-[#cec3a0]/60",
    accentCheck: "text-[#9b8753]",
    description: "Expansive layouts with courtyard living and a private arrival.",
    image: TOWER_SELECTION_IMAGE_URL,
    imageAlt: "Grand villa exterior",
    imageClass:
      "absolute inset-y-0 left-0 h-full w-[138%] max-w-none object-cover object-left",
    mobileImageClass: "object-cover object-left",
  },
];

function TowerSelectPanel({
  isTopViewActive: _isTopViewActive = false,
  onTopViewClick: _onTopViewClick,
  onClose,
  selectedTower,
  onSelectTower,
  mobile = false,
  compactDesktop = false,
}: {
  isTopViewActive?: boolean;
  onTopViewClick?: () => void;
  onClose?: () => void;
  selectedTower: TowerType | null;
  onSelectTower: (tower: TowerType) => void;
  mobile?: boolean;
  compactDesktop?: boolean;
}) {
  void _isTopViewActive;
  void _onTopViewClick;

  if (mobile) {
    return (
      <aside className="w-full">
        <div className="overflow-hidden rounded-[28px] border border-[#cec3a0]/35 bg-[linear-gradient(180deg,rgba(0,28,54,0.96),rgba(0,20,43,0.98))] p-4 text-[#faf8f2] shadow-[0_18px_40px_rgba(0,10,24,0.24)] backdrop-blur-xl sm:rounded-[32px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500/85">
                Villa Collection
              </p>
              <h2 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.04em] text-[#faf8f2] sm:text-[1.55rem]">
                Choose Your Villa
              </h2>
              <p className="mt-1.5 max-w-[30rem] text-sm leading-5 text-[#faf8f2]/58">
                Explore each villa collection and discover the residence that fits your way of living.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {towerCards.map((towerCard) => {
              const isActive = selectedTower === towerCard.value;

              return (
                <button
                  key={towerCard.value}
                  type="button"
                  onClick={() => onSelectTower(towerCard.value)}
                  className={`group relative overflow-hidden rounded-[24px] border p-3.5 text-left shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition duration-300 sm:min-h-[220px] sm:p-4 ${
                    isActive
                      ? "border-zinc-900/15 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.12)]"
                      : "border-white/70 bg-white/86 hover:border-zinc-200 hover:bg-white"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0))]" />
                  <div className="relative flex items-start gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] bg-zinc-100 ring-1 ring-black/5 sm:h-24 sm:w-24">
                      <Image
                        src={towerCard.image}
                        alt={towerCard.imageAlt}
                        fill
                        unoptimized
                        sizes="(max-width: 639px) 80px, 96px"
                        className={`object-cover ${towerCard.mobileImageClass}`}
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[42%] bg-gradient-to-r from-transparent via-white/70 to-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-zinc-950 sm:text-[1.15rem]">
                        {towerCard.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600 sm:text-[13px]">
                        {towerCard.description}
                      </p>
                    </div>

                    {isActive ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-zinc-900" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 transition group-hover:text-zinc-700" />
                    )}
                  </div>

                  <div className="relative mt-4 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Explore collection
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full">
      <div
        className={`relative overflow-hidden border border-[#cec3a0]/34 bg-[#00142b]/78 text-[#faf8f2] shadow-[0_24px_80px_rgba(0,10,24,0.28)] backdrop-blur-[22px] ${
          compactDesktop
            ? "rounded-[22px] p-2"
            : "rounded-[24px] p-2.5 xl:p-2.5 2xl:rounded-[26px] 2xl:p-3"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#cec3a0]/10 via-white/[0.02] to-transparent" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[#cec3a0]/70" />
        <div className="pointer-events-none absolute -right-20 top-8 h-36 w-36 rounded-full bg-[#cec3a0]/12 blur-3xl" />

        <div
          className={`relative px-1.5 pt-0.5 ${
            compactDesktop ? "mb-2.5" : "mb-3 2xl:mb-3.5"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-zinc-500/90 2xl:text-[9px]">
                Villa Collection
              </p>
              <h2
                className={`mt-2 font-semibold tracking-[-0.03em] text-[#faf8f2] ${
                  compactDesktop
                    ? "text-[1.04rem]"
                    : "text-[1.16rem] xl:text-[1.22rem] 2xl:text-[1.34rem]"
                }`}
              >
                Choose Your Villa
              </h2>
              <p
                className={`mt-1.5 text-[#faf8f2]/58 ${
                  compactDesktop
                    ? "max-w-[15.5rem] text-[10px] leading-4"
                    : "max-w-[19rem] text-[11px] leading-[1.05rem] 2xl:max-w-[20rem] 2xl:text-[12px] 2xl:leading-[1.15rem]"
                }`}
              >
                Start with a villa collection, then explore available residences and plans.
              </p>
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(255,255,255,0.52))] text-zinc-700 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.66))] hover:text-zinc-900 2xl:h-9 2xl:w-9"
                aria-label="Close villa selection panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {/* {onTopViewClick ? (
              <button
                type="button"
                onClick={onTopViewClick}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  isTopViewActive
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
                    : "border-zinc-200 bg-white/92 text-zinc-700 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <Layers3 className="h-3.5 w-3.5" />
                Top View
              </button>
            ) : null} */}
          </div>
        </div>

        <div
          className={
            compactDesktop ? "space-y-2.5" : "space-y-3 2xl:space-y-3.5"
          }
        >
          {towerCards.map((towerCard) => {
            const isActive = selectedTower === towerCard.value;

            return (
              <div key={towerCard.value}>
                <button
                  type="button"
                  onClick={() => onSelectTower(towerCard.value)}
                  className={`group relative w-full cursor-pointer overflow-hidden border text-left shadow-[0_18px_55px_rgba(15,23,42,0.10)] backdrop-blur-xl transition duration-300 ${
                    isActive
                      ? `${towerCard.accent} bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]`
                      : `${towerCard.accentMuted} bg-white`
                  } ${compactDesktop ? "rounded-[24px]" : "rounded-[30px]"}`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-white to-transparent opacity-90" />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />
                  <div
                    className={`pointer-events-none absolute -right-10 top-4 h-24 w-24 rounded-full blur-3xl transition duration-300 ${
                      isActive
                        ? "bg-cyan-200/35 opacity-100"
                        : "bg-white/35 opacity-0 group-hover:opacity-100"
                    }`}
                  />

                  <div
                    className={`grid grid-cols-[48%_52%] ${
                      compactDesktop
                        ? "min-h-[94px]"
                        : "min-h-[106px] xl:min-h-[112px] 2xl:min-h-[124px] 2xl:grid-cols-[48%_52%]"
                    }`}
                  >
                    <div
                      className={`relative overflow-hidden bg-white to-transparent ${
                        compactDesktop
                          ? "min-h-[92px] rounded-l-[22px]"
                          : "min-h-[104px] rounded-l-[24px] xl:min-h-[110px] 2xl:min-h-[122px]"
                      }`}
                    >
                      <Image
                        src={towerCard.image}
                        alt={towerCard.imageAlt}
                        width={3840}
                        height={2160}
                        unoptimized
                        className={`${towerCard.imageClass} origin-bottom-left transition duration-300 ${
                          isActive
                            ? "grayscale-0 scale-[1.02]"
                            : " scale-[1.02] group-hover:grayscale-0 group-hover:scale-[1.06]"
                        }`}
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[40%] bg-gradient-to-r from-transparent via-white/75 to-white" />
                    </div>

                    <div
                      className={`relative flex min-w-0 flex-col justify-center ${
                        compactDesktop
                          ? "px-2.5 py-2.5"
                          : "px-3 py-3 2xl:px-3.5 2xl:py-3.5"
                      }`}
                    >
                      <div
                        className={
                          compactDesktop
                            ? "max-w-[136px]"
                            : "max-w-[170px] 2xl:max-w-[190px]"
                        }
                      >
                        <h3
                          className={`font-medium tracking-[-0.03em] text-zinc-950 ${
                            compactDesktop
                              ? "text-[1rem]"
                              : "text-[1.14rem] xl:text-[1.2rem] 2xl:text-[1.34rem] 2xl:leading-[1.05]"
                          }`}
                        >
                          {towerCard.label}
                        </h3>

                        {/* <p className="mt-3 text-[14px] leading-6 text-zinc-600 sm:mt-4 sm:text-[15px] sm:leading-7">
                          {towerCard.description}
                        </p> */}

                        <p
                          className={`font-semibold uppercase tracking-[0.24em] text-zinc-400 transition group-hover:text-zinc-500 ${
                            compactDesktop
                              ? "mt-2 text-[7px]"
                              : "mt-3 text-[8px] 2xl:mt-4 2xl:text-[9px]"
                          }`}
                        >
                          Explore villa collection
                        </p>
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <CheckCircle2
                      className={`absolute ${compactDesktop ? "right-2.5 top-2.5 h-4 w-4" : "right-3 top-3 h-4.5 w-4.5"} ${towerCard.accentCheck}`}
                    />
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default function TowerSelect({
  selectedTower,
  onSelectTower,
  onTopViewClick,
  onClose,
  embedded = false,
  isTopViewActive = false,
  mobile = false,
  compactDesktop = false,
}: TowerSelectProps) {
  const [internalSelectedTower, setInternalSelectedTower] =
    useState<TowerType | null>(null);
  const [autoCompactDesktop, setAutoCompactDesktop] = useState(false);

  const isControlled = selectedTower !== undefined;
  const activeTower = isControlled ? selectedTower : internalSelectedTower;
  const shouldUseCompactDesktop = compactDesktop || autoCompactDesktop;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactDesktopMedia = window.matchMedia(
      "(min-width: 1280px) and (max-width: 1699px)",
    );
    const syncCompactDesktop = () => {
      setAutoCompactDesktop(compactDesktopMedia.matches);
    };

    syncCompactDesktop();
    compactDesktopMedia.addEventListener("change", syncCompactDesktop);

    return () => {
      compactDesktopMedia.removeEventListener("change", syncCompactDesktop);
    };
  }, []);

  const handleSelectTower = (tower: TowerType) => {
    if (!isControlled) {
      setInternalSelectedTower(tower);
    }
    onSelectTower?.(tower);
  };

  if (embedded) {
    return (
      <TowerSelectPanel
        isTopViewActive={isTopViewActive}
        onTopViewClick={onTopViewClick}
        onClose={onClose}
        compactDesktop={shouldUseCompactDesktop}
        mobile={mobile}
        selectedTower={activeTower}
        onSelectTower={handleSelectTower}
      />
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#00142b] text-[#faf8f2]">
      <div
        className="relative z-10 w-full px-4 py-6 md:px-6 lg:px-8"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <div className="ml-auto w-full max-w-[340px] 2xl:max-w-[360px]">
          <TowerSelectPanel
            isTopViewActive={isTopViewActive}
            onTopViewClick={onTopViewClick}
            onClose={onClose}
            compactDesktop={shouldUseCompactDesktop}
            mobile={mobile}
            selectedTower={activeTower}
            onSelectTower={handleSelectTower}
          />
        </div>
      </div>
    </div>
  );
}
