"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BedDouble, ChevronLeft, ChevronRight, Compass, Expand, House, LayoutGrid, LoaderCircle, Minus, Plus, Ruler, Route, X } from "lucide-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import type { InventoryApartment } from "@/types/inventory";
import {
  getVillaFloorArea, getVillaFloorPlan, getVillaFloorRooms, getVillaPano,
  getVillaRecord, getVillaWalkthroughHref, VILLA_FLOORS, type VillaFloor,
} from "@/lib/villa-residence";
import { villaPanoAssets } from "@/lib/villa-pano-preload";
import mapStyles from "./MapSidebar.module.css";
import styles from "./VillaResidenceExperience.module.css";

const number = (value: number) => value.toLocaleString("en-IN");
const DETAIL_TABS = [
  { id: "villa", label: "Villa" }, { id: "ground", label: "Ground" },
  { id: "first", label: "First" }, { id: "second", label: "Second" },
] as const;
type DetailTab = "villa" | Exclude<VillaFloor, "terrace">;
const COMPACT_PANEL_QUERY = "(max-width: 759px), (max-height: 600px)";
const SHORT_PANEL_QUERY = "(max-height: 760px), (max-width: 759px)";
function subscribeToViewport(callback: () => void) {
  const compact = window.matchMedia(COMPACT_PANEL_QUERY);
  const short = window.matchMedia(SHORT_PANEL_QUERY);
  compact.addEventListener("change", callback);
  short.addEventListener("change", callback);
  return () => {
    compact.removeEventListener("change", callback);
    short.removeEventListener("change", callback);
  };
}

export default function VillaResidenceExperience({ apartment, onClose }: {
  apartment: InventoryApartment;
  onClose: () => void;
}) {
  const villaNumber = Number(apartment.flatNumber);
  const villa = getVillaRecord(villaNumber);
  const pano = getVillaPano(villaNumber);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(pano ? null : "This villa’s panorama is unavailable for now.");
  const [closing, setClosing] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("villa");
  const [expandedPlan, setExpandedPlan] = useState(false);
  const [planOpen, setPlanOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"plan" | "info" | null>("info");
  const [roomPage, setRoomPage] = useState(0);
  const compactPanels = useSyncExternalStore(subscribeToViewport,
    () => window.matchMedia(COMPACT_PANEL_QUERY).matches, () => false);
  const shortPanels = useSyncExternalStore(subscribeToViewport,
    () => window.matchMedia(SHORT_PANEL_QUERY).matches, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    // Keep the original masterplan mounted underneath for an equally smooth
    // reverse crossfade. No routing, screenshot swap, or camera reset is needed.
    closeTimer.current = setTimeout(onClose, reducedMotion.current || !ready ? 0 : 1250);
  }, [onClose, ready]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!pano || !hostRef.current) return;
    let cancelled = false;
    let localViewer: Viewer | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let announced = false;
    void (async () => {
      try {
        const [{ Viewer: PanoramaViewer }, { EquirectangularTilesAdapter }, assets] = await Promise.all([
          import("@photo-sphere-viewer/core"),
          import("@photo-sphere-viewer/equirectangular-tiles-adapter"),
          villaPanoAssets.getPanorama(pano.folder),
        ]);
        if (cancelled || !hostRef.current) return;
        localViewer = new PanoramaViewer({
          container: hostRef.current,
          adapter: EquirectangularTilesAdapter.withConfig({ resolution: 64, baseBlur: true, showErrorTile: false, antialias: true }),
          panorama: assets.panorama,
          navbar: false,
          defaultYaw: pano.yawDegrees * Math.PI / 180,
          defaultPitch: pano.pitchDegrees * Math.PI / 180,
          defaultZoomLvl: pano.zoom,
          minFov: 36, maxFov: 78,
          moveInertia: true,
          touchmoveTwoFingers: false,
          mousewheelCtrlKey: false,
        });
        viewerRef.current = localViewer;
        const reveal = () => {
          if (announced || cancelled) return;
          announced = true;
          // Only blend after a real panorama frame is painted. The masterplan
          // stays completely visible during metadata/image/shader preparation.
          firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => { if (!cancelled) setReady(true); });
          });
        };
        localViewer.addEventListener("ready", reveal);
        localViewer.addEventListener("panorama-loaded", reveal);
        localViewer.addEventListener("panorama-error", () => {
          if (!cancelled) setError("The villa panorama could not load. Please retry.");
        });
      } catch {
        if (!cancelled) setError("The villa panorama could not load. Please retry.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      localViewer?.destroy();
      if (viewerRef.current === localViewer) viewerRef.current = null;
    };
  }, [pano]);

  if (!villa) return null;
  const floor = detailTab === "villa" ? "ground" : detailTab;
  const rooms = getVillaFloorRooms(villa, floor);
  const floorArea = getVillaFloorArea(villa, floor);
  const floorPlan = getVillaFloorPlan(villa, floor);
  const walkthroughHref = getVillaWalkthroughHref(villa);
  const visible = ready && !closing && !error;
  const showDetails = (ready || Boolean(error)) && !closing;
  const pageSize = shortPanels ? 2 : 3;
  const pageCount = Math.max(1, Math.ceil(rooms.length / pageSize));
  const currentPage = Math.min(roomPage, pageCount - 1);
  const roomStart = currentPage * pageSize;
  const visibleRooms = rooms.slice(roomStart, roomStart + pageSize);
  const showPlan = planOpen && (!compactPanels || mobilePanel === "plan");
  const showInfo = infoOpen && (!compactPanels || mobilePanel === "info");
  const changeTab = (next: DetailTab) => { setDetailTab(next); setRoomPage(0); };
  const detailImage = detailTab === "villa" ? villa.image : floorPlan;
  const facts = [
    { label: "Bedrooms", value: String(villa.details.bedrooms), icon: BedDouble },
    { label: "Facing", value: villa.details.facing, icon: Compass },
    { label: "Plot area", value: `${number(villa.details.plotAreaSqYd)} sq yd`, icon: Ruler },
    { label: `${villa.roadFrontages} road frontage${villa.roadFrontages === 1 ? "" : "s"}`, value: villa.position === "corner" ? "Corner" : "Center", icon: Route },
  ];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Villa ${villaNumber} panorama and details`}
      aria-busy={!ready && !error} tabIndex={-1}
      className={styles.experience} data-villa-experience={villaNumber} data-preserve-flat-selection="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (expandedPlan) setExpandedPlan(false); else close();
        }
        if (event.key === "Tab") {
          const focusScope = expandedPlan ? dialogRef.current?.querySelector('[data-expanded-villa-plan]') : dialogRef.current;
          const controls = Array.from(focusScope?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex="0"]') ?? []).filter((el) => el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[inert]'));
          const first = controls[0]; const last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            event.preventDefault(); first?.focus();
          }
        }
      }}>
      <div ref={hostRef} className={`${styles.panorama} ${visible ? styles.panoramaVisible : ""}`} aria-hidden={!visible} />
      <div className={`${styles.shade} ${visible ? styles.shadeVisible : ""}`} />

      <button type="button" className={`${styles.back} ${mapStyles.primary}`} onClick={close} disabled={closing}>
        <ArrowLeft size={17} /> Back to masterplan
      </button>

      {!ready && !error && !closing ? (
        <div className={styles.loading} role="status"><LoaderCircle className={styles.spinner} size={17} /> Opening Villa {String(villaNumber).padStart(2, "0")}</div>
      ) : null}
      {error && !closing ? (
        <div className={`${styles.notice} ${mapStyles.panel}`} role="status">
          <strong>{pano ? "Panorama could not load" : "Panorama unavailable"}</strong>
          <p>{error}</p>
          {pano ? <button type="button" className={mapStyles.primary} onClick={() => { onClose(); }}>Return to masterplan</button> : null}
        </div>
      ) : null}

      <div className={`${styles.panels} ${showDetails ? styles.panelsVisible : ""}`} inert={!showDetails}>
        <aside id="villa-plan-sidebar" hidden={!showPlan} className={`${styles.panel} ${styles.planPanel}`} aria-label="Floor details" data-scroll-area="villa-rooms">
          <div className={styles.imageSection}>
            {detailImage ? <button type="button" className={styles.planImage} onClick={() => setExpandedPlan(true)} aria-label={`Enlarge Villa ${villaNumber} ${detailTab === "villa" ? "image" : `${detailTab} floor plan`}`}>
              <Image src={detailImage} alt={`Villa ${villaNumber} ${detailTab === "villa" ? "exterior" : `${detailTab} floor plan`}`} fill sizes="(min-width: 1100px) 328px, 90vw" unoptimized className={detailTab === "villa" ? styles.exteriorImage : ""} />
              <span><Expand size={14} /></span>
            </button> : <div className={styles.planPlaceholder}><LayoutGrid size={25} strokeWidth={1} /><strong>{DETAIL_TABS.find((item) => item.id === detailTab)?.label} floor</strong><span>Plan image not available yet</span></div>}
            <button type="button" className={`${styles.close} ${styles.imageClose}`} onClick={() => { setPlanOpen(false); if (compactPanels) setMobilePanel(null); }} aria-label="Hide floor details"><X size={16} /></button>
          </div>
          <div className={styles.planContent}>
          <div className={styles.floorTabs} role="tablist" aria-label="Villa floor" onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault(); event.stopPropagation();
            const next = (DETAIL_TABS.findIndex((item) => item.id === detailTab) + (event.key === "ArrowRight" ? 1 : -1) + DETAIL_TABS.length) % DETAIL_TABS.length;
            changeTab(DETAIL_TABS[next].id);
            document.getElementById(`villa-floor-${DETAIL_TABS[next].id}`)?.focus();
          }}>
            {DETAIL_TABS.map((item) => <button key={item.id} type="button" role="tab" id={`villa-floor-${item.id}`}
              aria-controls="villa-floor-spaces" aria-selected={detailTab === item.id}
              tabIndex={detailTab === item.id ? 0 : -1}
              onClick={() => changeTab(item.id)}>{item.label}</button>)}
          </div>
          <div role="tabpanel" id="villa-floor-spaces" aria-labelledby={`villa-floor-${detailTab}`}>
            {detailTab === "villa" ? <>
              <div className={styles.roomHeading}><h3>Villa {String(villaNumber).padStart(2, "0")}</h3><span>{villa.details.type}</span></div>
              <dl className={styles.rooms}>
                <div><dt>Plot dimensions</dt><dd>{villa.details.plotDimensionsM.width} × {villa.details.plotDimensionsM.depth} m</dd></div>
                <div><dt>Plot area</dt><dd>{number(villa.details.plotAreaSqYd)} sq yd</dd></div>
                <div><dt>Built-up area</dt><dd>{number(villa.details.advertisedBuiltUpSqFt)} sq ft</dd></div>
              </dl>
            </> : <>
            <div className={styles.roomHeading}><h3>{VILLA_FLOORS.find((item) => item.id === floor)?.label} floor</h3>{floorArea !== null ? <span>{number(floorArea)} sq ft</span> : null}</div>
            <dl className={styles.rooms}>
              {visibleRooms.map((room, index) => <div key={`${floor}-${roomPage}-${room.name}-${index}`}><dt>{room.name}</dt><dd>{room.dimensionsFt}</dd></div>)}
            </dl>
            {!rooms.length ? <p className={styles.emptyRooms}>No room schedule for this level</p> : null}
            <div className={styles.roomFooter}>
              <span>{rooms.length ? `${String(roomStart + 1).padStart(2, "0")}—${String(Math.min(roomStart + pageSize, rooms.length)).padStart(2, "0")} / ${rooms.length} spaces` : "CAD room dimensions"}</span>
              {pageCount > 1 ? <div className={styles.roomPager}>
                <button type="button" aria-label="Previous rooms" disabled={currentPage === 0} onClick={() => setRoomPage(currentPage - 1)}><ChevronLeft size={15} /></button>
                <button type="button" aria-label="Next rooms" disabled={currentPage === pageCount - 1} onClick={() => setRoomPage(currentPage + 1)}><ChevronRight size={15} /></button>
              </div> : null}
            </div>
            </>}
          </div>
          </div>
        </aside>

        <aside id="villa-info-sidebar" hidden={!showInfo} className={`${styles.panel} ${styles.infoPanel}`} aria-label="Villa details" data-scroll-area="villa-info">
          <div className={styles.heading}>
            <span className={styles.eyebrow}>The Laurels · {villa.details.type}</span>
            <div className={styles.titleRow}><h1>Villa {String(villaNumber).padStart(2, "0")}</h1><button type="button" className={styles.close} onClick={() => { setInfoOpen(false); if (compactPanels) setMobilePanel(null); }} aria-label="Hide villa details"><X size={16} /></button></div>
            <div className={styles.badges}><span data-status={pano ? apartment.status : "Unavailable"}><i aria-hidden="true" />{pano ? apartment.status : "Pano unavailable"}</span></div>
          </div>
          <dl className={styles.facts}>{facts.map((fact) => <div key={fact.label}><dt><fact.icon size={15} />{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
          <div className={styles.plotDimensions}><span>Plot dimensions</span><strong>{villa.details.plotDimensionsM.width} × {villa.details.plotDimensionsM.depth} <small>m</small></strong></div>
          <div className={styles.builtUp}><span>Built-up area</span><strong>{number(villa.details.advertisedBuiltUpSqFt)} <small>sq ft</small></strong></div>
          {walkthroughHref ? <Link className={styles.walkthrough} href={walkthroughHref}>Open walkthrough <ArrowUpRight size={16} /></Link> : <>
            <button type="button" disabled className={styles.walkthrough}>Open walkthrough <ArrowUpRight size={16} /></button>
            <span className={styles.walkthroughState}>Interior tour coming soon</span>
          </>}
        </aside>
      </div>

      {showDetails ? <div className={styles.panelDock} aria-label="Villa sidebars">
        <button type="button" className={showPlan ? styles.dockButtonOpen : ""} aria-label="Show floor details" aria-controls="villa-plan-sidebar" aria-expanded={showPlan} onClick={() => { setPlanOpen(true); setMobilePanel("plan"); }}><LayoutGrid size={16} /> Floor details</button>
        <button type="button" className={showInfo ? styles.dockButtonOpen : ""} aria-label="Show villa details" aria-controls="villa-info-sidebar" aria-expanded={showInfo} onClick={() => { setInfoOpen(true); setMobilePanel("info"); }}><House size={16} /> Villa details</button>
      </div> : null}

      {visible ? <div className={styles.viewerControls} aria-label="Panorama controls">
        <button type="button" className={mapStyles.primary} aria-label="Zoom out" onClick={() => { const viewer = viewerRef.current; if (viewer) viewer.zoom(Math.max(0, viewer.getZoomLevel() - 10)); }}><Minus size={18} /></button>
        <span>Drag to look around</span>
        <button type="button" className={mapStyles.primary} aria-label="Zoom in" onClick={() => { const viewer = viewerRef.current; if (viewer) viewer.zoom(Math.min(100, viewer.getZoomLevel() + 10)); }}><Plus size={18} /></button>
      </div> : null}

      {expandedPlan ? <div className={styles.expandedPlan} data-expanded-villa-plan role="dialog" aria-modal="true" aria-label="Enlarged villa image">
        <button type="button" className={mapStyles.primary} aria-label="Close enlarged image" onClick={() => setExpandedPlan(false)} autoFocus><X size={20} /></button>
        <Image src={detailImage ?? villa.image} alt={`Villa ${villaNumber} ${detailTab === "villa" ? "exterior" : "floor plan"}`} fill sizes="90vw" unoptimized />
      </div> : null}
    </div>
  );
}
