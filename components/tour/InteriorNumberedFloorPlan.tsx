"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, X } from "lucide-react";
import { getFloorPlanArrivalView, getFloorPlanDestination, type NumberedFloorPlan } from "@/lib/interior-tour/floor-plans";
import type { InteriorEntryView } from "@/lib/interior-tour/floor-navigation";
import styles from "./InteriorFloorControls.module.css";

const SHOW_POI_REFERENCES = process.env.NODE_ENV === "development";

export default function InteriorNumberedFloorPlan({ plan, floorNodeIds, currentNodeId, onNavigate, onHide }: {
  plan: NumberedFloorPlan;
  floorNodeIds: readonly string[];
  currentNodeId: string;
  onNavigate: (id: string, arrivalView?: InteriorEntryView) => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const aspect = plan.width / plan.height;
  const rotateMinimap = plan.minimapRotation === 90;
  const minimapAspect = rotateMinimap ? 1 / aspect : aspect;
  const useDots = plan.markerStyle === "dot";

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  const chooseRoom = (number: number) => {
    const marker = plan.markers.find(item => item.number === number);
    if (!marker) return;
    const destination = getFloorPlanDestination(marker, floorNodeIds);
    if (destination) { onNavigate(destination, getFloorPlanArrivalView(marker)); setOpen(false); }
  };

  return <>
    <div data-floor-plan-minimap role="group" aria-label={`${plan.label} minimap`}
      className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: minimapAspect }}>
      <div data-minimap-image-layer className="absolute" style={{
        width: rotateMinimap ? `${aspect * 100}%` : "100%",
        height: rotateMinimap ? `${100 / aspect}%` : "100%",
        left: "50%", top: "50%",
        transform: `translate(-50%, -50%) rotate(${rotateMinimap ? 90 : 0}deg)`,
      }}>
        <Image src={plan.thumbnail} alt={`${plan.label} floor plan`} fill sizes="256px" loading="eager" unoptimized className="pointer-events-none object-contain" />
        {plan.markers.map(marker => <button type="button" key={marker.number} onClick={() => chooseRoom(marker.number)}
          aria-label={marker.label} aria-pressed={Boolean(marker.nodeId && marker.nodeId === currentNodeId)}
          title={SHOW_POI_REFERENCES ? `${marker.label} · Reference #${marker.number}` : marker.label}
          data-minimap-room-number={marker.number} data-marker-style={useDots ? "dot" : "number"}
          style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
          className={`${styles.minimapPoint} group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#2f7fb5]`}>
          <span aria-hidden="true" className={`flex items-center justify-center rounded-full border border-[#d6b65f] shadow-sm ${useDots ? "h-2.5 w-2.5" : "h-4.5 min-w-4.5 px-0.5 text-[9px] font-bold"} ${marker.nodeId && marker.nodeId === currentNodeId ? "bg-[#2f7fb5] text-white" : "bg-[#fce190] text-[#00142b] group-hover:bg-[#2f7fb5] group-hover:text-white group-focus-visible:bg-[#2f7fb5] group-focus-visible:text-white"}`}>{useDots ? null : marker.number}</span>
        </button>)}
      </div>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={`Open ${plan.label.toLowerCase()} plan`} aria-haspopup="dialog" aria-expanded={open}
        className={`${styles.desktopExpand} absolute right-1 top-1 h-8 w-8 items-center justify-center border-0 bg-transparent p-0 text-[#2f7fb5] shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[#2f7fb5]`}>
        <Expand aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onHide} aria-label="Hide minimap" className={`${styles.compactHide} absolute right-0 top-0 h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-[#2f7fb5] outline-none focus-visible:ring-2 focus-visible:ring-[#2f7fb5]`}>
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>

    {open && createPortal(<div data-expanded-floor-plan className="fixed inset-0 z-[250] grid place-items-center bg-[#001020]/75 p-4" onClick={() => setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${plan.label} plan`} tabIndex={-1}
        className="relative overflow-hidden rounded-2xl outline-none" onClick={event => event.stopPropagation()}
        style={{ width: `min(92vw, calc(90dvh * ${aspect}), 72rem)`, aspectRatio: aspect }}>
        <div data-numbered-plan-image className="absolute inset-0">
          <Image src={plan.image} alt={`${plan.label} floor plan with room locations`} fill sizes="90vw" loading="eager" unoptimized className="object-contain" />
          {plan.markers.map(marker => <button type="button" key={marker.number} onClick={() => chooseRoom(marker.number)}
            aria-label={marker.label} aria-pressed={Boolean(marker.nodeId && marker.nodeId === currentNodeId)}
            title={SHOW_POI_REFERENCES ? `${marker.label} · Reference #${marker.number}` : marker.label}
            data-room-number={marker.number} data-marker-style={useDots ? "dot" : "number"}
            style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
            className="group absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#2f7fb5]">
            <span aria-hidden="true" className={`flex items-center justify-center rounded-full border border-[#d6b65f] shadow-sm ${useDots ? "h-3.5 w-3.5" : "h-7 min-w-7 text-[11px] font-bold"} ${marker.nodeId && marker.nodeId === currentNodeId ? "bg-[#2f7fb5] text-white" : "bg-[#fce190] text-[#00142b] group-hover:bg-[#2f7fb5] group-hover:text-white group-focus-visible:bg-[#2f7fb5] group-focus-visible:text-white"}`}>{useDots ? null : marker.number}</span>
          </button>)}
        </div>
        <button type="button" aria-label="Close floor plan" onClick={() => setOpen(false)} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center text-[#2f7fb5] outline-none focus-visible:ring-2 focus-visible:ring-[#2f7fb5]">
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    </div>, document.body)}
  </>;
}
