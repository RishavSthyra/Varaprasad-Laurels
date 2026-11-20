"use client";

import { useEffect, useState } from "react";

type DebugView = { yaw: number; pitch: number; zoom: number };

export default function PanoDebugPanel({ nodeId, imageFilename, folder, floorLabel, nodes, transitioning, onNavigate, getView, browseLabel = "Browse this floor's panos", className = "bottom-4 left-3", position }: {
  nodeId: string;
  imageFilename: string;
  folder: string;
  floorLabel: string;
  nodes: readonly { id: string; imageFilename: string; label?: string }[];
  transitioning: boolean;
  onNavigate: (id: string) => void;
  getView: () => DebugView | null;
  browseLabel?: string;
  className?: string;
  position?: { x: number; y: number; z: number };
}) {
  const [copied, setCopied] = useState<{ nodeId: string; message: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DebugView | null>(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      const next = getView();
      setView(current => current?.yaw === next?.yaw && current?.pitch === next?.pitch && current?.zoom === next?.zoom ? current : next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [getView, open]);
  return <details onToggle={event => {
    setOpen(event.currentTarget.open);
    if (event.currentTarget.open) setView(getView());
  }} className={`absolute z-40 max-w-[min(320px,calc(100%-1.5rem))] rounded-xl border border-[#fce190]/35 bg-[#00142b]/95 p-2 text-[11px] text-white shadow-xl ${className}`} data-pano-debug>
    <summary className="cursor-pointer px-1 py-2 font-semibold text-[#fce190]">Pano debug · Development only</summary>
    <div className="mt-1 grid max-h-[60svh] gap-2 overflow-y-auto overscroll-contain p-1">
      <p>{floorLabel}{transitioning ? " · Loading selected pano…" : " · Current pano"}</p>
      <p className="break-all font-mono text-[#fce190]" data-debug-pano-filename>{imageFilename}</p>
      {view ? <p data-debug-pano-view data-yaw={view.yaw} data-pitch={view.pitch} data-zoom={view.zoom} className="font-mono text-white/80">Yaw {view.yaw.toFixed(1)}° · Pitch {view.pitch.toFixed(1)}° · Zoom {view.zoom.toFixed(0)}</p> : null}
      <dl className="grid gap-1 break-all text-white/75"><dt>Node ID</dt><dd className="font-mono">{nodeId}</dd><dt>Cloud pano folder</dt><dd className="font-mono">{folder}</dd></dl>
      {position ? <p className="break-all font-mono text-white/75" data-debug-pano-position>Exported position (cm): X {position.x}, Y {position.y}, Z {position.z}</p> : null}
      <label className="grid gap-1">{browseLabel}
        <select aria-label="Debug: choose pano" value={nodeId} disabled={transitioning} onChange={event => { setCopied(null); onNavigate(event.target.value); }} className="min-h-11 w-full min-w-0 rounded-lg border border-white/30 bg-[#00142b] px-2 text-xs text-white">
          {nodes.map(node => <option key={node.id} value={node.id}>{node.label ?? node.imageFilename}</option>)}
        </select>
      </label>
      <button type="button" disabled={transitioning} className="min-h-11 rounded-lg border border-[#fce190]/40 px-2 text-[#fce190] disabled:cursor-wait disabled:opacity-40" onClick={async () => {
        try {
          const current = getView();
          const camera = current ? `\nArrival view (degrees): ${JSON.stringify({ yaw: +current.yaw.toFixed(2), pitch: +current.pitch.toFixed(2), zoom: +current.zoom.toFixed(2) })}` : "";
          const sourcePosition = position ? `\nExported position (cm): ${JSON.stringify(position)}` : "";
          await navigator.clipboard.writeText(`${floorLabel}\nPano: ${imageFilename}\nNode: ${nodeId}\nFolder: ${folder}${sourcePosition}${camera}`);
          setCopied({ nodeId, message: "Copied pano details and camera view" });
        }
        catch { setCopied({ nodeId, message: "Copy unavailable - select the filename above" }); }
      }}>Copy pano details</button>
      {copied?.nodeId === nodeId ? <p role="status">{copied.message}</p> : null}
    </div>
  </details>;
}
