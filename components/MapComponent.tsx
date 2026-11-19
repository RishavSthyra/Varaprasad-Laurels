"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AREA_MAP_PHOTO_PLACEHOLDER, getAreaMapPhotoUrl } from "@/lib/area-map-photo-assets";
import { Cormorant_Garamond } from "next/font/google";
import mapSidebarStyles from "./MapSidebar.module.css";
import {
  areaMapProject as centerPlace, areaMapPois as pois, AREA_MAP_INITIAL_ZOOM,
  AREA_MAP_ROUTE_CACHE_KEY, getPoiRoadMetrics, poiRouteSignature, isValidPoiRoute,
  straightLineDistance, getAnimatedRouteSegment,
  type AreaPoi as Poi, type AreaPoiCategory as PoiCategory, type AreaRoute as RouteData,
} from "@/lib/area-map";
export type { AreaPoi as Poi } from "@/lib/area-map";
import { Map as MapView,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapControls,
  MapClusterLayer,
  useMap,
  MapRoute,
  type MapRef,
} from "@/components/ui/map";
import {
  BriefcaseBusiness,
  Cross,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  School,
  Store,
  Trees,
  BusFront,
  Landmark,
  X,
  LocateFixed,
  Clock3,
  Navigation,
  Trophy,
  ListFilter,
  Grid2x2,
  Layers3,
} from "lucide-react";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
const CARTO_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const displaySerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
});

type UserLocation = {
  longitude: number;
  latitude: number;
  accuracy?: number;
};

type ClusterPoiProperties = {
  poiId: number;
  name: string;
  category: PoiCategory;
};

type DistanceFilter = "5km" | "10km" | "all";
type SortMode = "featured" | "nearest" | "name";
type MapDisplayMode = "normal" | "carto" | "3d";
const DEFAULT_MAP_DISPLAY_MODE: MapDisplayMode = "3d";

function cameraForMode(mode: MapDisplayMode) {
  return { pitch: mode === "3d" ? 55 : 0, bearing: mode === "3d" ? -18 : 0 };
}

const DEFAULT_SELECTED_CATEGORIES: PoiCategory[] = [
  "park",
  "mall",
  "bus_stop",
  "school",
  "hospital",
  "landmark",
  "sports",
  "IT Company",
];
const CATEGORY_ORDER = DEFAULT_SELECTED_CATEGORIES;
const ROUTE_CACHE_KEY = AREA_MAP_ROUTE_CACHE_KEY;
const ROUTE_REQUEST_TIMEOUT = 12000;
const POI_CLUSTER_MAX_ZOOM = 12;
const POI_CLUSTER_SWITCH_ZOOM = 12.8;
const POI_CLUSTER_RADIUS = 58;
const ROUTE_ANIMATION_DURATION = 2600;
const PREMIUM_OLIVE_BUTTON =
  "border border-[#fce190]/55 bg-[radial-gradient(circle_at_32%_20%,#12395f_0%,#062542_48%,#00142b_100%)] text-[#fce190]";
const FLOATING_PANEL =
  "rounded-[1.6rem] border border-[#fce190]/30 bg-[#00142b]/92 text-[#fce190] shadow-[0_18px_42px_rgba(0,20,43,0.26),inset_0_1px_0_rgba(252,225,144,0.12)] backdrop-blur-xl";
const FLOATING_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-[#fce190]/35 bg-[#00142b]/92 text-[#fce190] shadow-[0_18px_42px_rgba(0,20,43,0.26),inset_0_1px_0_rgba(252,225,144,0.12)] backdrop-blur-xl transition hover:border-[#fce190]/60 hover:bg-[#082846]/95";
const FLOATING_GHOST_PANEL =
  "rounded-[1.6rem] border border-transparent bg-transparent shadow-none backdrop-blur-0";
const OVERLAY_TRANSITION =
  "transition duration-200 ease-out data-[state=closed]:translate-y-2 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0 data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100";

type IdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hours}h ${remaining}m`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function buildAccuracyPolygon(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  points = 48,
): [number, number][] {
  const latitudeCos = Math.max(
    Math.cos((latitude * Math.PI) / 180),
    0.00001,
  );

  const coordinates: [number, number][] = [];

  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const lngOffset =
      ((radiusMeters * Math.cos(angle)) / (111320 * latitudeCos));
    const latOffset = (radiusMeters * Math.sin(angle)) / 111320;

    coordinates.push([longitude + lngOffset, latitude + latOffset]);
  }

  return coordinates;
}

function isLngLatCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function parseRouteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const coordinates = value.map((coordinate) => {
    if (!isLngLatCoordinate(coordinate)) {
      return null;
    }

    return [coordinate[0], coordinate[1]] as [number, number];
  });

  return coordinates.every(Boolean) ? (coordinates as [number, number][]) : null;
}

function waitForIdle(signal: AbortSignal, timeout = 700) {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const hostWindow =
      typeof window === "undefined" ? null : (window as IdleWindow);
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      if (idleId !== null) {
        hostWindow?.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", abort, { once: true });

    if (hostWindow && typeof hostWindow.requestIdleCallback === "function") {
      idleId = hostWindow.requestIdleCallback(finish, { timeout });
      return;
    }

    timeoutId = globalThis.setTimeout(finish, 0);
  });
}

async function fetchRouteBetweenPoints({
  from,
  to,
  id,
  name,
  timeout = 12000,
  signal,
}: {
  from: { lng: number; lat: number };
  to: { lng: number; lat: number };
  id: number;
  name: string;
  timeout?: number;
  signal?: AbortSignal;
}): Promise<RouteData | null> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeout);
  const abortFromCaller = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      {
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.warn("Route fetch failed:", name, response.status);
      return null;
    }

    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = parseRouteCoordinates(route?.geometry?.coordinates);

    if (!coordinates) {
      console.warn("Invalid route:", name);
      return null;
    }

    return {
      id,
      name,
      coordinates,
      duration:
        typeof route.duration === "number" && Number.isFinite(route.duration)
          ? route.duration
          : 0,
      distance:
        typeof route.distance === "number" && Number.isFinite(route.distance)
          ? route.distance
          : 0,
    };
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      console.warn("Route fetch error:", name, err);
    }
    return null;
  } finally {
    signal?.removeEventListener("abort", abortFromCaller);
    globalThis.clearTimeout(timeoutId);
  }
}

function upsertRouteById(routes: RouteData[], nextRoute: RouteData) {
  const existingIndex = routes.findIndex((route) => route.id === nextRoute.id);

  if (existingIndex === -1) {
    return [...routes, nextRoute];
  }

  const nextRoutes = [...routes];
  nextRoutes[existingIndex] = nextRoute;
  return nextRoutes;
}

function getRouteCacheKey(poi: Poi) {
  return poiRouteSignature(poi);
}

function loadRouteCache() {
  try {
    if (typeof sessionStorage === "undefined") {
      return {} as Record<string, RouteData>;
    }

    const raw = sessionStorage.getItem(ROUTE_CACHE_KEY);
    if (!raw) return {} as Record<string, RouteData>;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as Record<string, RouteData>;
    return parsed as Record<string, RouteData>;
  } catch {
    return {} as Record<string, RouteData>;
  }
}

function saveRouteCache(cache: Record<string, RouteData>) {
  try {
    if (typeof sessionStorage === "undefined") {
      return;
    }

    sessionStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage failures
  }
}

async function loadRouteCacheDuringIdle(signal: AbortSignal) {
  await waitForIdle(signal);
  if (signal.aborted) {
    return {} as Record<string, RouteData>;
  }

  return loadRouteCache();
}

const categoryMeta: Record<
  PoiCategory,
  {
    label: string;
    color: string;
    glow: string;
    panelClass: string;
    pinColor: string;
    routeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeBg: string;
    badgeRing: string;
    badgeIcon: string;
  }
> = {
  park: {
    label: "Parks",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: Trees,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  mall: {
    label: "Malls",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: Store,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  bus_stop: {
    label: "Transport",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: BusFront,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  school: {
    label: "Education",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: School,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  hospital: {
    label: "Hospitals",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: Cross,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  landmark: {
    label: "Landmarks",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: Landmark,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  sports: {
    label: "Sports",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: Trophy,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
  "IT Company": {
    label: "Business",
    color: "text-[#fce190]",
    glow: "bg-[#fce190]/20",
    panelClass: "border-[#fce190]/40 bg-[#00142b]/90",
    pinColor: "text-[#fce190]",
    routeColor: "#fce190",
    icon: BriefcaseBusiness,
    badgeBg: "bg-[#00142b]",
    badgeRing: "ring-[#fce190]/60",
    badgeIcon: "text-[#fce190]",
  },
};

const PoiMarker = memo(function PoiMarker({
  poi,
  isSelected,
  onMarkerClick,
}: {
  poi: Poi;
  isSelected: boolean;
  onMarkerClick: (poi: Poi) => void;
}) {
  const meta = categoryMeta[poi.category];
  const Icon = meta.icon;

  return (
    <MapMarker longitude={poi.lng} latitude={poi.lat}>
      <MarkerContent>
        <button
          type="button"
          onClick={() => onMarkerClick(poi)}
          className="group relative flex items-center justify-center"
          aria-label={poi.name}
        >
          <span
            className={`relative flex items-center justify-center rounded-full border shadow-[0_8px_18px_rgba(0,20,43,0.3)] transition ${
              isSelected
                ? "h-9 w-9 border-[#f3ead2] bg-[#2449a4]"
                : "h-8 w-8 border-[#f3ead2]/80 bg-[#10264d]/95"
            }`}
          >
            <Icon className="size-4 text-[#f3ead2]" />
          </span>
        </button>
      </MarkerContent>
      <MarkerTooltip
        offset={10}
        className={`rounded-full border border-[#fce190]/45 bg-[#00142b]/94 px-3 py-1 text-[0.68rem] font-semibold text-[#fce190] shadow-[0_10px_24px_rgba(0,20,43,0.3)] ${isSelected ? "opacity-100" : ""}`}
      >
        {poi.name}
      </MarkerTooltip>
    </MapMarker>
  );
});

function useAnimatedRouteProgress(active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;

    let frameId = 0;
    let start: number | null = null;

    const animate = (time: number) => {
      if (start === null) start = time;

      const elapsed = time - start;
      setProgress((elapsed % ROUTE_ANIMATION_DURATION) / ROUTE_ANIMATION_DURATION);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [active]);

  return active ? progress : 0;
}

function MapClickClearRoute({
  onClear,
  suppressRef,
}: {
  onClear: () => void;
  suppressRef: React.MutableRefObject<boolean>;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleMapClick = () => {
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }

      onClear();
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, isLoaded, onClear, suppressRef]);

  return null;
}

function focusProject(map: MapRef, duration = 0, mode = DEFAULT_MAP_DISPLAY_MODE) {
  const compact = map.getContainer().clientWidth < 1280;
  map.easeTo({
    center: [centerPlace.lng, centerPlace.lat],
    zoom: AREA_MAP_INITIAL_ZOOM, ...cameraForMode(mode),
    offset: compact ? [0, -45] : [-155, 0],
    duration,
  });
}

function AreaMapViewport({ route, mode }: { route: RouteData | null; mode: MapDisplayMode }) {
  const { map, isLoaded } = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (!initialized.current) {
      initialized.current = true;
      focusProject(map, 0, mode);
    } else {
      map.easeTo({ ...cameraForMode(mode), duration: 900 });
    }
  }, [map, isLoaded, mode]);
  useEffect(() => {
    if (!map || !isLoaded || !route) return;
    const compact = map.getContainer().clientWidth < 1280;
    const xs = route.coordinates.map((p) => p[0]);
    const ys = route.coordinates.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], {
      padding: compact ? { top: 110, right: 75, bottom: 150, left: 75 } : { top: 100, right: 470, bottom: 90, left: 180 },
      maxZoom: 14.5, duration: 1100, pitch: map.getPitch(), bearing: map.getBearing(),
    });
  }, [map, isLoaded, route]);
  return null;
}

function UserLocationAccuracyLayer({
  location,
}: {
  location: UserLocation;
}) {
  const { map, isLoaded, styleRevision } = useMap();
  const accuracyRadius = Math.max(location.accuracy ?? 0, 35);
  const polygon = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          buildAccuracyPolygon(
            location.longitude,
            location.latitude,
            accuracyRadius,
          ),
        ],
      },
    }),
    [accuracyRadius, location.latitude, location.longitude],
  );

  useEffect(() => {
    if (!isLoaded || !map) return;

    const sourceId = "user-location-accuracy-source";
    const fillLayerId = "user-location-accuracy-fill";
    const outlineLayerId = "user-location-accuracy-outline";

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: polygon,
      });
    }

    if (!map.getLayer(fillLayerId)) {
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#0f766e",
          "fill-opacity": 0.14,
        },
      });
    }

    if (!map.getLayer(outlineLayerId)) {
      map.addLayer({
        id: outlineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#0f766e",
          "line-width": 2,
          "line-opacity": 0.3,
        },
      });
    }

    return () => {
      try {
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore map style teardown races
      }
    };
  }, [isLoaded, map, polygon, styleRevision]);

  useEffect(() => {
    if (!isLoaded || !map) return;

    const source = map.getSource(
      "user-location-accuracy-source",
    ) as { setData?: (data: unknown) => void } | null;

    source?.setData?.(polygon);
  }, [isLoaded, map, polygon, styleRevision]);

  return null;
}

function ThreeDBuildingsLayer({
  active,
}: {
  active: boolean;
}) {
  const { map, isLoaded, styleRevision } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "openfreemap-3d-buildings";
    const layerId = "openfreemap-3d-buildings-layer";

    const removeBuildings = () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore style teardown races
      }
    };

    if (!active) {
      removeBuildings();
      return;
    }

    const layers = map.getStyle()?.layers ?? [];
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && Boolean(layer.layout?.["text-field"]),
    )?.id;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer(
        {
          id: layerId,
          type: "fill-extrusion",
          source: sourceId,
          "source-layer": "building",
          minzoom: 15,
          filter: ["!=", ["get", "hide_3d"], true],
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "render_height"],
              0,
              "#d7d6cf",
              60,
              "#c9ccb8",
              160,
              "#b3b89e",
            ],
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              16,
              ["get", "render_height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              16,
              ["coalesce", ["get", "render_min_height"], 0],
            ],
          },
        },
        labelLayerId,
      );
    }

    return () => {
      removeBuildings();
    };
  }, [active, isLoaded, map, styleRevision]);

  return null;
}

function getPoiImage(poi: Poi | null, photoUrls: Readonly<Record<string, string>>) {
  return getAreaMapPhotoUrl(poi?.thumbnail, photoUrls);
}

function getDisplayRoute(route: RouteData | null | undefined, poi: Poi | null) {
  return {
    distance: route ? formatDistance(route.distance) : poi?.distanceLabel ?? "—",
    duration: route ? `~${formatDuration(route.duration)} drive` : poi?.timeLabel ?? "Check in Maps",
  };
}

function getPoiDistanceMeters(poi: Poi, route: RouteData | null | undefined) {
  return route?.distance ?? getPoiRoadMetrics(poi)?.distance ?? straightLineDistance(centerPlace, poi);
}

function isPopularPoi(poi: Poi) {
  return Boolean(poi.featured);
}

function PoiDetailsCard({
  photoUrls,
  poi, metrics, onClose, onDirections,
}: {
  poi: Poi;
  photoUrls: Readonly<Record<string, string>>;
  metrics: { distance: string; duration: string };
  onClose: () => void;
  onDirections: (poi: Poi) => void;
}) {
  const meta = categoryMeta[poi.category];
  const Icon = meta.icon;
  return (
    <article className="pointer-events-auto overflow-hidden rounded-[inherit] text-[#f4eedf]" data-poi-details={poi.id}>
      <div className="relative isolate overflow-hidden rounded-t-[inherit] bg-[#10264d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getAreaMapPhotoUrl(poi.image, photoUrls)} alt={poi.name} decoding="async"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = AREA_MAP_PHOTO_PLACEHOLDER; }}
          className="block h-[clamp(9rem,26dvh,15rem)] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#00142b]/40 via-transparent to-[#00142b]/10" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-[#f4eedf]/35 bg-[#00142b]/75 px-3 py-1.5 text-[0.68rem] font-medium backdrop-blur-md">
          <Icon className="size-3.5" />{meta.label}
        </span>
        <button type="button" onClick={onClose} aria-label="Close selected place details"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/35 bg-[#00142b]/65 text-[#f4eedf] backdrop-blur-md transition hover:bg-[#2449a4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        <div>
          <h2 className={`${displaySerif.className} text-[1.65rem] font-semibold leading-[1.08] sm:text-[1.85rem]`}>{poi.name}</h2>
          <p className="mt-1.5 text-[0.7rem] text-[#f4eedf]/60">{poi.locality}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.7rem] font-semibold text-[#fce190]" aria-label="Estimated road distance and drive time">
          <span className="inline-flex items-center gap-1.5"><LocateFixed className="size-3.5" />{metrics.distance}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{metrics.duration}</span>
        </div>
        <p className="text-[0.75rem] leading-5 text-[#f4eedf]/75">{poi.description}</p>
        <button type="button" onClick={() => onDirections(poi)}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[0.8rem] font-semibold transition hover:brightness-110 ${PREMIUM_OLIVE_BUTTON}`}>
          <Navigation className="size-3.5" />Get Directions
        </button>
      </div>
    </article>
  );
}


function PremiumSelect({
  value,
  onChange,
  options,
  icon: Icon,
  ariaLabel,
  className,
  selectClassName,
  iconClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon: React.ComponentType<{ className?: string }>;
  ariaLabel: string;
  className?: string;
  selectClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon
        className={`pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#00142b] ${iconClassName ?? ""}`}
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        style={{ colorScheme: "light" }}
        className={`${mapSidebarStyles.control} h-11 w-full appearance-none rounded-full border pl-10 pr-10 text-sm font-medium outline-none transition ${selectClassName ?? ""}`}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={{ backgroundColor: "#efebe4", color: "#00142b" }}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[#00142b] ${iconClassName ?? ""}`}
      />
    </div>
  );
}


export function CustomStyleExample({ photoUrls }: { photoUrls: Readonly<Record<string, string>> }) {
  const mapRef = useRef<MapRef>(null);
  const suppressNextMapClearRef = useRef(false);
  const userRouteRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const userRouteAbortRef = useRef<AbortController | null>(null);
  const routeCacheRef = useRef<Record<string, RouteData>>({});
  const routeCacheWriteChainRef = useRef<Promise<void>>(Promise.resolve());

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [isUserRouteLoading, setIsUserRouteLoading] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<number | null>(null);
  const [routePoiId, setRoutePoiId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userRoute, setUserRoute] = useState<RouteData | null>(null);
  const [currentZoom, setCurrentZoom] = useState(AREA_MAP_INITIAL_ZOOM);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showPopular, setShowPopular] = useState(true);
  const [showPoiDetails, setShowPoiDetails] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  const [mobilePopularExpanded, setMobilePopularExpanded] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<PoiCategory[]>(
    DEFAULT_SELECTED_CATEGORIES,
  );
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>(DEFAULT_MAP_DISPLAY_MODE);
  const isTabletLayout = viewportWidth >= 768 && viewportWidth < 1280;
  const isCompactLayout = viewportWidth < 1280;
  const isCompactDesktop = viewportWidth >= 1280 && viewportWidth < 1560;
  const poiIndexes = useMemo(() => {
    const byCategory = new Map<PoiCategory, Poi[]>(
      CATEGORY_ORDER.map((category) => [
        category,
        pois.filter((poi) => poi.category === category),
      ]),
    );
    const clusterFeatureById = new Map<
      number,
      GeoJSON.Feature<GeoJSON.Point, ClusterPoiProperties>
    >(
      pois.map((poi) => [
        poi.id,
        {
          type: "Feature",
          properties: {
            poiId: poi.id,
            name: poi.name,
            category: poi.category,
          },
          geometry: {
            type: "Point",
            coordinates: [poi.lng, poi.lat],
          },
        },
      ]),
    );

    return {
      byCategory,
      clusterFeatureById,
    };
  }, []);
  const enqueueRouteCacheSave = useCallback((signal: AbortSignal) => {
    const snapshot = { ...routeCacheRef.current };

    routeCacheWriteChainRef.current = routeCacheWriteChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await waitForIdle(signal, 1200);
        if (!signal.aborted) {
          saveRouteCache(snapshot);
        }
      })
      .catch(() => undefined);

    return routeCacheWriteChainRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      userRouteAbortRef.current?.abort();
      userRouteAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncViewportWidth = () => {
      const nextWidth = window.innerWidth;
      setViewportWidth(nextWidth);

      if (nextWidth < 1280) {
        setMobilePopularExpanded(false);
      } else {
        setShowFilters(false);
      }
    };

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);

    return () => {
      window.removeEventListener("resize", syncViewportWidth);
    };
  }, []);

  useEffect(() => {
    if (!isCompactLayout || !showFilters) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFilters(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCompactLayout, showFilters]);

  useEffect(() => {
    const controller = new AbortController();
    const poi = pois.find((entry) => entry.id === selectedPoiId);
    if (!poi) {
      setIsLoading(false);
      setRouteNotice(null);
      return () => controller.abort();
    }

    async function loadSelectedRoute(selected: Poi) {
      setIsLoading(true);
      setRouteNotice(null);
      const key = getRouteCacheKey(selected);
      try {
        const stored = await loadRouteCacheDuringIdle(controller.signal);
        routeCacheRef.current = { ...stored, ...routeCacheRef.current };
        if (controller.signal.aborted) return;
        let result: unknown = routeCacheRef.current[key];
        if (!isValidPoiRoute(result, selected)) {
          // Routes were checked once during preparation; no external API burst
          // on page load, and no invented curved lines when a route is missing.
          const response = await fetch(`/data/laurels-routes/${selected.id}.json`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Local route unavailable");
          result = await response.json();
        }
        if (!isValidPoiRoute(result, selected)) throw new Error("Route belongs to a different location");
        if (controller.signal.aborted || !mountedRef.current) return;
        routeCacheRef.current = { ...routeCacheRef.current, [key]: result };
        void enqueueRouteCacheSave(controller.signal);
        const validatedRoute = result;
        setRoutes((previous) => upsertRouteById(previous, validatedRoute));
      } catch {
        if (!controller.signal.aborted && mountedRef.current) {
          setRouteNotice("This road route is unavailable. Please try another place.");
        }
      } finally {
        if (!controller.signal.aborted && mountedRef.current) setIsLoading(false);
      }
    }

    void loadSelectedRoute(poi);
    return () => controller.abort();
  }, [enqueueRouteCacheSave, selectedPoiId]);

  const routeLookup = useMemo(
    () => new Map(routes.map((route) => [route.id, route] as const)),
    [routes],
  );

  const filteredPois = useMemo(() => {
    const q = "";
    const selectedCategorySet = new Set(selectedCategories);
    const categoryPois =
      selectedCategories.length === CATEGORY_ORDER.length
        ? pois
        : selectedCategories.flatMap(
            (category) => poiIndexes.byCategory.get(category) ?? [],
          );

    if (!q) {
      return categoryPois;
    }

    return categoryPois.filter((poi) => {
      const matchesCategory = selectedCategorySet.has(poi.category);
      const matchesSearch =
        poi.name.toLowerCase().includes(q) ||
        categoryMeta[poi.category].label.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [poiIndexes.byCategory, selectedCategories]);

  const visiblePois = useMemo(() => {
    const thresholdMeters =
      distanceFilter === "5km" ? 5000 : distanceFilter === "10km" ? 10000 : Number.POSITIVE_INFINITY;

    const nextPois = filteredPois.filter((poi) => {
      return getPoiDistanceMeters(poi, routeLookup.get(poi.id)) <= thresholdMeters;
    });

    nextPois.sort((left, right) => {
      if (sortMode === "nearest") {
        return (
          getPoiDistanceMeters(left, routeLookup.get(left.id)) -
          getPoiDistanceMeters(right, routeLookup.get(right.id))
        );
      }

      if (sortMode === "name") return left.name.localeCompare(right.name);

      const popularDelta = Number(isPopularPoi(right)) - Number(isPopularPoi(left));
      if (popularDelta !== 0) {
        return popularDelta;
      }

      return getPoiDistanceMeters(left, routeLookup.get(left.id)) - getPoiDistanceMeters(right, routeLookup.get(right.id));
    });

    return nextPois;
  }, [distanceFilter, filteredPois, routeLookup, sortMode]);

  const clusterData = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, ClusterPoiProperties>
  >(
    () => ({
      type: "FeatureCollection",
      features: visiblePois
        .map((poi) => poiIndexes.clusterFeatureById.get(poi.id))
        .filter(
          (
            feature,
          ): feature is GeoJSON.Feature<
            GeoJSON.Point,
            ClusterPoiProperties
          > => Boolean(feature),
        ),
    }),
    [poiIndexes.clusterFeatureById, visiblePois],
  );
  const clearPoiSelection = useCallback(() => {
    setRoutePoiId(null);
    setSelectedPoiId(null);
  }, []);

  const toggleCategory = useCallback((category: PoiCategory) => {
    clearPoiSelection();
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category],
    );
  }, [clearPoiSelection]);

  const handlePoiMarkerClick = useCallback((poi: Poi) => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setUserRoute(null);
    setIsUserRouteLoading(false);
    suppressNextMapClearRef.current = true;
    setRoutePoiId(null);
    setSelectedPoiId(poi.id);
    setShowPoiDetails(true);
    setShowDesktopSidebar(false);
    setShowFilters(false);
    setMobilePopularExpanded(false);

    mapRef.current?.flyTo?.({
      center: [poi.lng, poi.lat],
      zoom: 16.8,
      duration: 1200,
    });
  }, []);

  const handleFilteredPoiSelection = useCallback((poi: Poi) => {
    setShowFilters(false);
    handlePoiMarkerClick(poi);
  }, [handlePoiMarkerClick]);

  const resetFilters = useCallback(() => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setSelectedPoiId(null);
    setRoutePoiId(null);
    setUserLocation(null);
    setUserRoute(null);
    setIsUserRouteLoading(false);
    setSelectedCategories(DEFAULT_SELECTED_CATEGORIES);
    setDistanceFilter("all");
    setSortMode("featured");
    setMapDisplayMode(DEFAULT_MAP_DISPLAY_MODE);
    setShowFilters(false);
    setShowPopular(true);
    setShowPoiDetails(false);
    setShowDesktopSidebar(true);
    setMobilePopularExpanded(false);
    if (mapRef.current) focusProject(mapRef.current, 1000);
  }, []);

  const clearActiveRoute = useCallback(() => {
    setRoutePoiId(null);
    setSelectedPoiId(null);
    setShowPoiDetails(false);
    setShowDesktopSidebar(true);
  }, []);

  const openDesktopSidebar = useCallback(() => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setRoutePoiId(null);
    setSelectedPoiId(null);
    setUserRoute(null);
    setIsUserRouteLoading(false);
    setShowPoiDetails(false);
    setShowDesktopSidebar(true);
    if (mapRef.current) focusProject(mapRef.current, 1200, mapDisplayMode);
  }, [mapDisplayMode]);

  const hideCompactPoiDetails = useCallback(() => {
    setShowPoiDetails(false);

    // Keep the selected POI only while its route is active so closing the
    // compact card never removes the directions path.
    if (routePoiId === null) {
      setSelectedPoiId(null);
    }
  }, [routePoiId]);

  const handleViewRoute = useCallback((poi: Poi) => {
    userRouteRequestRef.current += 1;
    userRouteAbortRef.current?.abort();
    setUserRoute(null);
    setIsUserRouteLoading(false);
    suppressNextMapClearRef.current = true;
    setSelectedPoiId(poi.id);
    setRoutePoiId(poi.id);
    setShowPoiDetails(!isCompactLayout);
    setShowDesktopSidebar(false);
    setShowFilters(false);
    setMobilePopularExpanded(false);

    mapRef.current?.flyTo?.({
      center: [poi.lng, poi.lat],
      zoom: 13.8,
      duration: 1200,
    });
  }, [isCompactLayout]);

  const handleClusterPointClick = useCallback(
    (
      feature: GeoJSON.Feature<GeoJSON.Point, ClusterPoiProperties>,
      coordinates: [number, number],
    ) => {
      const poiId = feature.properties?.poiId;
      if (typeof poiId !== "number") return;

      const poi = visiblePois.find((item) => item.id === poiId);
      if (!poi) return;

      userRouteRequestRef.current += 1;
      userRouteAbortRef.current?.abort();
      setUserRoute(null);
      setIsUserRouteLoading(false);
      suppressNextMapClearRef.current = true;
      setRoutePoiId(null);
      setSelectedPoiId(poi.id);
      setShowPoiDetails(true);
      setShowDesktopSidebar(false);
      setShowFilters(false);
      setMobilePopularExpanded(false);

      mapRef.current?.flyTo?.({
        center: coordinates,
        zoom: 16.2,
        duration: 1000,
      });
    },
    [visiblePois],
  );

  const handleUserLocate = useCallback(async (coords: UserLocation) => {
    const requestId = userRouteRequestRef.current + 1;
    userRouteRequestRef.current = requestId;
    userRouteAbortRef.current?.abort();
    const controller = new AbortController();
    userRouteAbortRef.current = controller;

    suppressNextMapClearRef.current = true;
    setSelectedPoiId(null);
    setRoutePoiId(null);
    setUserLocation(coords);
    setShowPoiDetails(false);
    setShowDesktopSidebar(false);
    setShowFilters(false);
    setMobilePopularExpanded(false);

    setUserRoute(null);
    setRouteNotice(null);
    setIsUserRouteLoading(true);

    mapRef.current?.fitBounds(
      [
        [
          Math.min(coords.longitude, centerPlace.lng),
          Math.min(coords.latitude, centerPlace.lat),
        ],
        [
          Math.max(coords.longitude, centerPlace.lng),
          Math.max(coords.latitude, centerPlace.lat),
        ],
      ],
      {
        padding: {
          top: 120,
          right: 80,
          bottom: showFilters ? 420 : 140,
          left: window.innerWidth >= 1280 ? 180 : 75,
        },
        duration: 1500,
      },
    );

    const fetchedRoute = await fetchRouteBetweenPoints({
      from: { lng: coords.longitude, lat: coords.latitude },
      to: { lng: centerPlace.lng, lat: centerPlace.lat },
      id: -1,
      name: "Your route to Varaprasad Laurels",
      timeout: ROUTE_REQUEST_TIMEOUT,
      signal: controller.signal,
    });

    if (
      controller.signal.aborted ||
      !mountedRef.current ||
      userRouteRequestRef.current !== requestId
    ) {
      return;
    }

    if (fetchedRoute) {
      setUserRoute(fetchedRoute);
    } else {
      setRouteNotice("Your road route is unavailable. Please try again.");
    }

    setIsUserRouteLoading(false);
    if (userRouteAbortRef.current === controller) {
      userRouteAbortRef.current = null;
    }
  }, [showFilters]);

  
  const selectedPoi =
    visiblePois.find((poi) => poi.id === selectedPoiId) ??
    filteredPois.find((poi) => poi.id === selectedPoiId) ??
    pois.find((poi) => poi.id === selectedPoiId) ??
    null;

  const activeRoute = routePoiId !== null ? routeLookup.get(routePoiId) ?? null : null;
  const routeProgress = useAnimatedRouteProgress(Boolean(activeRoute));
  const userRouteProgress = useAnimatedRouteProgress(Boolean(userRoute));

  const animatedCoordinates = useMemo(() => {
    if (!activeRoute) return [];

    if (!Array.isArray(activeRoute.coordinates)) return [];

    if (activeRoute.coordinates.length < 2) return [];

    return getAnimatedRouteSegment(
      activeRoute.coordinates,
      routeProgress,
    );
  }, [activeRoute, routeProgress]);

  const userAnimatedCoordinates = useMemo(() => {
    if (!userRoute) return [];

    if (!Array.isArray(userRoute.coordinates)) return [];

    if (userRoute.coordinates.length < 2) return [];

    return getAnimatedRouteSegment(
      userRoute.coordinates,
      userRouteProgress,
    );
  }, [userRoute, userRouteProgress]);

  const routeBaseColor = "#f3ead2";
  const routeHighlightColor = "#2449a4";
  const showClusters = currentZoom < POI_CLUSTER_SWITCH_ZOOM;
  const selectedDisplayPoi = selectedPoi ?? visiblePois[0] ?? pois[0] ?? null;
  const desktopSidebarVisible = !isCompactLayout && showDesktopSidebar && !showPoiDetails;
  const desktopSidebarWidthClass = isTabletLayout
    ? "w-[20rem]"
    : isCompactDesktop
      ? "w-[23rem]"
      : "w-[28rem]";
  const desktopSidebarPanelPaddingClass = isTabletLayout ? "p-4" : isCompactDesktop ? "p-4.5" : "p-5";
  const desktopSidebarHeaderEyebrowClass = isTabletLayout
    ? "text-[0.64rem] tracking-[0.18em]"
    : isCompactDesktop
      ? "text-[0.68rem] tracking-[0.2em]"
      : "text-[0.72rem] tracking-[0.22em]";
  const desktopSidebarTitleClass = isTabletLayout
    ? "text-[2rem] leading-[0.94]"
    : isCompactDesktop
      ? "text-[2.25rem] leading-[0.93]"
      : "text-[2.6rem] leading-[0.92]";
  const desktopSidebarBodyCopyClass = isTabletLayout
    ? "max-w-[11rem] text-[0.92rem] leading-6"
    : isCompactDesktop
      ? "max-w-[12rem] text-[0.96rem] leading-6"
      : "max-w-[13rem] text-sm leading-6";
  const desktopSidebarActionTextClass = isTabletLayout ? "text-[0.92rem]" : "text-sm";
  const desktopSidebarCloseButtonClass = isTabletLayout ? "size-10" : "size-11";
  const desktopSidebarTileGridClass = isTabletLayout ? "gap-2" : "gap-2.5";
  const desktopSidebarTileClass = isTabletLayout
    ? "rounded-[1rem] px-2 py-2 text-[0.8rem]"
    : isCompactDesktop
      ? "rounded-[1.05rem] px-2.5 py-2.5 text-[0.86rem]"
      : "rounded-[1.1rem] px-2.5 py-2.5 text-[0.92rem]";
  const desktopSidebarTileIconWrapClass = isTabletLayout
    ? "size-7 rounded-[0.8rem]"
    : isCompactDesktop
      ? "size-7.5 rounded-[0.9rem]"
      : "size-8 rounded-[0.95rem]";
  const desktopSidebarTileIconClass = isTabletLayout
    ? "size-4"
    : isCompactDesktop
      ? "size-[1.05rem]"
      : "size-[1.125rem]";
  const desktopSidebarTileLabelClass = isTabletLayout
    ? "max-w-[4.4rem] whitespace-nowrap text-[0.68rem]"
    : isCompactDesktop
      ? "max-w-[5rem] whitespace-nowrap text-[0.72rem]"
      : "max-w-[5.4rem] whitespace-nowrap text-[0.76rem]";
  const desktopSidebarFilterLabelClass = isTabletLayout
    ? "text-[0.64rem] tracking-[0.18em]"
    : isCompactDesktop
      ? "text-[0.68rem] tracking-[0.2em]"
      : "text-[0.72rem] tracking-[0.22em]";
  const desktopSidebarControlHeightClass = isTabletLayout ? "h-10" : "h-12";
  const desktopSidebarControlTextClass = isTabletLayout ? "text-[0.95rem]" : "text-sm";
  const desktopSidebarControlRadiusClass = isTabletLayout ? "rounded-[1rem]" : "rounded-[1.1rem]";
  const desktopSidebarControlIconClass = isTabletLayout ? "text-[#00142b] size-3.5" : "text-[#00142b]";
  const activeMapStyle = mapDisplayMode === "carto" ? CARTO_MAP_STYLE : MAP_STYLE;
  const activeProjection = { type: "mercator" } as const;
  const mapControlsThemeClass =
    "[&>div]:border-[#fce190]/30 [&>div]:bg-[#00142b]/92 [&>div]:text-[#fce190] [&>div]:shadow-[0_12px_28px_rgba(0,20,43,0.25)] [&_button]:text-[#fce190] [&_button:hover]:bg-[#082846] [&>div>button:not(:last-child)]:border-[#fce190]/18";
  const popularPanelPaddingClass = isTabletLayout ? "p-3.5" : "p-4";
  const popularPanelTitleClass = isTabletLayout ? "text-[1.5rem]" : "text-lg";
  const popularPanelDescriptionClass = isTabletLayout ? "text-[0.72rem]" : "text-xs";
  const popularItemImageClass = isTabletLayout ? "h-[4.2rem] w-[4.4rem]" : "h-[4.8rem] w-[5.2rem]";
  const popularItemTitleClass = isTabletLayout ? "text-[0.9rem]" : "text-[0.98rem]";
  const popularItemMetaClass = "text-[0.65rem] font-semibold";
  const popularItemArrowClass = isTabletLayout ? "size-8" : "size-9";
  const selectedRouteMetrics = getDisplayRoute(
    selectedDisplayPoi ? routeLookup.get(selectedDisplayPoi.id) : null,
    selectedDisplayPoi,
  );
  const listedPois = visiblePois;
  const topCategories = useMemo(
    () => [
      { id: "all", label: "All", icon: Grid2x2, active: selectedCategories.length === CATEGORY_ORDER.length },
      ...CATEGORY_ORDER.map((category) => ({
        id: category,
        label: categoryMeta[category].label,
        icon: categoryMeta[category].icon,
        active: selectedCategories.includes(category),
      })),
    ],
    [selectedCategories],
  );
  const hasActiveFilters =
    selectedCategories.length !== CATEGORY_ORDER.length ||
    distanceFilter !== "all" ||
    sortMode !== "featured" ||
    mapDisplayMode !== DEFAULT_MAP_DISPLAY_MODE;
  const desktopSidebarCategories = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        id: category,
        label: categoryMeta[category].label,
        icon: categoryMeta[category].icon,
        active: selectedCategories.includes(category),
      })),
    [selectedCategories],
  );

  const handleViewportChange = useCallback((viewport: { zoom: number }) => {
    setCurrentZoom(viewport.zoom);
  }, []);

  useEffect(() => {
    const resizeMap = () => {
      mapRef.current?.resize();
    };

    resizeMap();
    window.addEventListener("resize", resizeMap);

    const frameId = window.requestAnimationFrame(resizeMap);

    return () => {
      window.removeEventListener("resize", resizeMap);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#00142b] text-[#fce190]">
      <div className="absolute inset-0">
        <MapView
          ref={mapRef}
          center={[centerPlace.lng, centerPlace.lat]}
          zoom={AREA_MAP_INITIAL_ZOOM}
          pitch={55}
          bearing={-18}
          theme="light"
          projection={activeProjection}
          canvasContextAttributes={{ antialias: true }}
          fadeDuration={0}
          className="h-full w-full"
          onViewportChange={handleViewportChange}
          styles={{ light: activeMapStyle, dark: activeMapStyle }}
        >
          <AreaMapViewport route={activeRoute} mode={mapDisplayMode} />
          <ThreeDBuildingsLayer active={mapDisplayMode === "3d"} />
          <MapControls
            position="bottom-right"
            showZoom
            showCompass
            showLocate
            onLocate={handleUserLocate}
            className={`${mapControlsThemeClass} ${
              isCompactLayout
                ? showFilters
                  ? "hidden"
                  : `right-3 sm:right-5 ${showPoiDetails || mobilePopularExpanded ? "bottom-auto top-[4.75rem] sm:top-[5.5rem]" : "bottom-[7rem] sm:bottom-[7.75rem]"}`
                : `right-6 ${showPoiDetails ? "bottom-[26rem]" : "bottom-8"}`
            }`}
          />
          <MapClickClearRoute onClear={clearActiveRoute} suppressRef={suppressNextMapClearRef} />
          {userLocation ? <UserLocationAccuracyLayer location={userLocation} /> : null}
          {userRoute ? (
            <>
              <MapRoute id="user-route-outline" coordinates={userRoute.coordinates} color="#162d59" width={9} opacity={0.22} />
              <MapRoute id="user-route-base" coordinates={userRoute.coordinates} color={routeBaseColor} width={6} opacity={1} />
            </>
          ) : null}
          {userAnimatedCoordinates.length > 1 ? (
            <MapRoute id="user-route-animated" coordinates={userAnimatedCoordinates} color={routeHighlightColor} width={3.5} opacity={1} />
          ) : null}
          {activeRoute ? (
            <>
              <MapRoute id="poi-route-outline" coordinates={activeRoute.coordinates} color="#162d59" width={9} opacity={0.22} />
              <MapRoute id="poi-route-base" coordinates={activeRoute.coordinates} color={routeBaseColor} width={6} opacity={1} />
            </>
          ) : null}
          {animatedCoordinates.length > 1 ? (
            <MapRoute id="poi-route-animated" coordinates={animatedCoordinates} color={routeHighlightColor} width={3.5} opacity={1} />
          ) : null}
          {showClusters ? (
            <MapClusterLayer<ClusterPoiProperties>
              data={clusterData}
              clusterRadius={POI_CLUSTER_RADIUS}
              clusterMaxZoom={POI_CLUSTER_MAX_ZOOM}
              clusterColors={["#2449a4", "#193878", "#10264d"]}
              clusterThresholds={[12, 28]}
              pointColor="#f3ead2"
              textFont="Noto Sans Regular"
              onPointClick={handleClusterPointClick}
            />
          ) : null}
          <MapMarker longitude={centerPlace.lng} latitude={centerPlace.lat}>
            <MarkerContent>
              <button
                type="button"
                onClick={clearActiveRoute}
                className="relative flex items-center justify-center"
                aria-label={centerPlace.name}
                data-project-lat={centerPlace.lat}
                data-project-lng={centerPlace.lng}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/vp-b-cons-images_blue.webp"
                  alt={centerPlace.name}
                  className="h-12 w-32 object-contain drop-shadow-[0_6px_18px_rgba(0,20,43,0.28)]"
                />
              </button>
            </MarkerContent>
          </MapMarker>
          {userLocation ? (
            <MapMarker longitude={userLocation.longitude} latitude={userLocation.latitude}>
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-8 animate-ping rounded-full bg-[#fce190]/25" />
                  <div className="relative size-4 rounded-full border-2 border-[#fce190] bg-[#00142b] shadow-[0_0_0_6px_rgba(252,225,144,0.2)]" />
                </div>
              </MarkerContent>
            </MapMarker>
          ) : null}
          {!showClusters
            ? visiblePois.map((poi) => (
                <PoiMarker
                  key={poi.id}
                  poi={poi}
                  isSelected={selectedPoiId === poi.id}
                  onMarkerClick={handlePoiMarkerClick}
                />
              ))
            : null}
          {showClusters && selectedPoi ? <PoiMarker poi={selectedPoi} isSelected onMarkerClick={handlePoiMarkerClick} /> : null}
        </MapView>

      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {isCompactLayout ? (
          <>
            {!showPoiDetails ? (
              <button
                type="button"
                onClick={() => {
                  setMobilePopularExpanded(false);
                  setShowFilters(true);
                }}
                className={`${mapSidebarStyles.control} absolute right-3 top-[max(env(safe-area-inset-top),1rem)] pointer-events-auto inline-flex min-h-11 items-center gap-2 px-3.5 text-[0.78rem] font-semibold sm:right-5 sm:min-h-12 sm:px-4 sm:text-sm ${FLOATING_BUTTON}`}
                aria-label="Open map filters"
                aria-expanded={showFilters}
                aria-controls="compact-map-filter-drawer"
              >
                <ListFilter className="size-4" />
                <span>Filters</span>
                {hasActiveFilters ? (
                  <span className="size-1.5 rounded-full bg-[#fce190]" aria-hidden="true" />
                ) : null}
              </button>
            ) : null}

            {showFilters ? (
              <div className="pointer-events-auto absolute inset-0 z-30">
                <button
                  type="button"
                  className="absolute inset-0 cursor-default bg-[#00142b]/55 backdrop-blur-[3px]"
                  onClick={() => setShowFilters(false)}
                  aria-label="Close map filters"
                />
                <section
                  id="compact-map-filter-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="compact-map-filter-title"
                  className={`${mapSidebarStyles.panel} absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-[1.75rem] border-t px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3.5 [scrollbar-width:none] sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(44rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[2rem] sm:border sm:p-6 [&::-webkit-scrollbar]:hidden`}
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#fce190]/45 sm:mb-4" />
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#00142b]/70 sm:text-[0.68rem]">
                        Explore nearby
                      </p>
                      <h2
                        id="compact-map-filter-title"
                        className={`${displaySerif.className} mt-1 text-lg font-semibold leading-none text-[#00142b] sm:text-xl`}
                      >
                        Map Filters
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFilters(false)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#00142b]/35 bg-[#efebe4]/50 text-[#00142b] sm:size-12"
                      aria-label="Close map filters"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {topCategories.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={item.active}
                          onClick={() => {
                            if (item.id === "all") {
                              clearPoiSelection();
                              setSelectedCategories(DEFAULT_SELECTED_CATEGORIES);
                              return;
                            }

                            toggleCategory(item.id as PoiCategory);
                          }}
                          className={`${mapSidebarStyles.choice} flex min-h-11 min-w-0 items-center gap-2 rounded-[0.95rem] border px-3 text-left text-[0.78rem] font-semibold transition sm:min-h-12 sm:px-3.5 sm:text-sm`}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
                    <PremiumSelect
                      className="min-w-0"
                      value={distanceFilter}
                      onChange={(value) => setDistanceFilter(value as DistanceFilter)}
                      ariaLabel="Filter nearby places by distance"
                      icon={LocateFixed}
                      selectClassName="h-11 rounded-[0.95rem] text-[0.78rem] sm:h-12 sm:text-[0.82rem]"
                      iconClassName="size-3.5"
                      options={[
                        { value: "5km", label: "Within 5 km" },
                        { value: "10km", label: "Within 10 km" },
                        { value: "all", label: "All Distances" },
                      ]}
                    />
                    <PremiumSelect
                      className="min-w-0"
                      value={sortMode}
                      onChange={(value) => setSortMode(value as SortMode)}
                      ariaLabel="Sort nearby places"
                      icon={ChevronUp}
                      selectClassName="h-11 rounded-[0.95rem] text-[0.78rem] sm:h-12 sm:text-[0.82rem]"
                      iconClassName="size-3.5"
                      options={[
                        { value: "featured", label: "Sort: Suggested" },
                        { value: "nearest", label: "Sort: Nearby" },
                        { value: "name", label: "Sort: A–Z" },
                      ]}
                    />
                    <PremiumSelect
                      className="min-w-0"
                      value={mapDisplayMode}
                      onChange={(value) => setMapDisplayMode(value as MapDisplayMode)}
                      ariaLabel="Change map style"
                      icon={Layers3}
                      selectClassName="h-11 rounded-[0.95rem] text-[0.78rem] sm:h-12 sm:text-[0.82rem]"
                      iconClassName="size-3.5"
                      options={[
                        { value: "normal", label: "Map: Normal" },
                        { value: "carto", label: "Map: Carto" },
                        { value: "3d", label: "Map: 3D" },
                      ]}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="min-h-11 rounded-full border border-[#00142b]/30 bg-[#efebe4]/50 px-4 text-[0.78rem] font-semibold text-[#00142b] sm:min-h-12 sm:text-sm"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFilters(false);
                        setMobilePopularExpanded(true);
                      }}
                      className={`${mapSidebarStyles.primary} min-h-11 rounded-full px-4 text-[0.78rem] font-semibold sm:min-h-12 sm:text-sm`}
                    >
                      Show {visiblePois.length} Places
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : desktopSidebarVisible ? (
          <section
            className={`absolute right-6 top-6 bottom-6 ${desktopSidebarWidthClass} pointer-events-none ${OVERLAY_TRANSITION}`}
            data-state="open"
          >
            <div className="flex h-full flex-col gap-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className={`pointer-events-auto ${FLOATING_GHOST_PANEL} p-0`}>
                <div className={`${mapSidebarStyles.panel} relative overflow-hidden rounded-[2rem] border ${desktopSidebarPanelPaddingClass}`}>
                  <div className="pointer-events-none absolute inset-[8px] rounded-[1.65rem] border border-[#00142b]/12" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/flowerUI.png"
                    alt=""
                    className={`${mapSidebarStyles.flower} pointer-events-none absolute -right-6 -top-3 z-0 h-88 w-auto select-none`}
                  />
                  <div className="relative mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-semibold uppercase text-[#00142b]/72 ${desktopSidebarHeaderEyebrowClass}`}>
                        Discover Nearby
                      </p>
                      <h2 className={`${displaySerif.className} mt-2 font-semibold text-[#00142b] ${desktopSidebarTitleClass}`}>
                        {centerPlace.name}
                      </h2>
                      <p className={`mt-3 text-[#00142b]/68 ${desktopSidebarBodyCopyClass}`}>
                        Mokila · {pois.length} destinations.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className={`whitespace-nowrap px-2 font-medium text-[#00142b]/82 transition hover:text-[#00142b] ${desktopSidebarActionTextClass}`}
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDesktopSidebar(false)}
                        className={`flex shrink-0 items-center justify-center rounded-full border border-[#00142b]/28 bg-[#efebe4]/50 text-[#00142b] ${desktopSidebarCloseButtonClass}`}
                        aria-label="Close sidebar"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`grid grid-cols-4 ${desktopSidebarTileGridClass}`}>
                    {desktopSidebarCategories.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleCategory(item.id as PoiCategory)}
                          aria-pressed={item.active}
                          className={`${mapSidebarStyles.choice} group aspect-square border transition ${desktopSidebarTileClass}`}
                        >
                          <span className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                            <span className={`${mapSidebarStyles.choiceIcon} flex items-center justify-center ${desktopSidebarTileIconWrapClass}`}>
                              <Icon className={desktopSidebarTileIconClass} />
                            </span>
                            <span className={`leading-tight ${desktopSidebarTileLabelClass}`}>{item.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5">
                    <p className={`font-semibold uppercase text-[#00142b]/72 ${desktopSidebarFilterLabelClass}`}>
                      Quick Filters
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <PremiumSelect
                      className="w-full"
                      value={distanceFilter}
                      onChange={(value) => setDistanceFilter(value as DistanceFilter)}
                      ariaLabel="Filter nearby places by distance"
                      icon={LocateFixed}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[#00142b]/24 bg-[#efebe4]/50 text-[#00142b] focus:border-[#00142b]/55 ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "5km", label: "Within 5 km" },
                        { value: "10km", label: "Within 10 km" },
                        { value: "all", label: "All Distances" },
                      ]}
                    />
                    <PremiumSelect
                      className="w-full"
                      value={sortMode}
                      onChange={(value) => setSortMode(value as SortMode)}
                      ariaLabel="Sort nearby places"
                      icon={ChevronUp}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[#00142b]/24 bg-[#efebe4]/50 text-[#00142b] focus:border-[#00142b]/55 ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "featured", label: "Sort by: Suggested" },
                        { value: "nearest", label: "Sort by: Nearby" },
                        { value: "name", label: "Sort by: A–Z" },
                      ]}
                    />
                    <PremiumSelect
                      className="w-full"
                      value={mapDisplayMode}
                      onChange={(value) => setMapDisplayMode(value as MapDisplayMode)}
                      ariaLabel="Change map style"
                      icon={Layers3}
                      iconClassName={desktopSidebarControlIconClass}
                      selectClassName={`${desktopSidebarControlHeightClass} ${desktopSidebarControlRadiusClass} border-[#00142b]/24 bg-[#efebe4]/50 text-[#00142b] focus:border-[#00142b]/55 ${desktopSidebarControlTextClass}`}
                      options={[
                        { value: "normal", label: "Map: Normal" },
                        { value: "carto", label: "Map: Carto" },
                        { value: "3d", label: "Map: 3D" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className={`pointer-events-auto ${FLOATING_GHOST_PANEL} p-0`}>
                <div className={`${mapSidebarStyles.panel} rounded-[1.8rem] border ${popularPanelPaddingClass}`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className={`font-semibold text-[#00142b] ${popularPanelTitleClass}`}>Nearby places</h2>
                      <p className={`mt-1 text-[#00142b]/62 ${popularPanelDescriptionClass}`}>Explore nearby destinations.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(DEFAULT_SELECTED_CATEGORIES)}
                      className={`whitespace-nowrap font-medium text-[#00142b]/82 ${desktopSidebarActionTextClass}`}
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-[46vh] space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {listedPois.map((poi) => {
                      const meta = categoryMeta[poi.category];
                      const linkedRoute = routeLookup.get(poi.id);
                      const metrics = getDisplayRoute(linkedRoute, poi);
                      const isSelected = selectedPoiId === poi.id;

                      return (
                        <button
                          key={poi.id}
                          type="button"
                          onClick={() => handleFilteredPoiSelection(poi)}
                          className={`group flex w-full items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left transition ${
                            isSelected
                              ? "border-[#00142b]/55 bg-[#fce190]/42"
                              : "border-[#00142b]/12 bg-[#efebe4]/50 hover:border-[#00142b]/28 hover:bg-[#efebe4]/50"
                          }`}
                        >
                          <div className={`relative shrink-0 overflow-hidden rounded-[1rem] border border-[#00142b]/24 bg-[#efebe4]/50 ${popularItemImageClass}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getPoiImage(poi, photoUrls)} alt={poi.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-semibold text-[#00142b] ${popularItemTitleClass}`}>{poi.name}</p>
                            <p className="mt-0.5 text-xs text-[#00142b]/58">{meta.label}</p>
                            <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[#2449a4] ${popularItemMetaClass}`}>
                              <span>{metrics.distance}</span>
                              <span>{metrics.duration}</span>
                            </div>
                          </div>
                          <span className={`flex shrink-0 items-center justify-center rounded-full border border-[#00142b]/24 bg-[#efebe4]/50 text-[#00142b] ${popularItemArrowClass}`}>
                            <ChevronRight className="size-4" />
                          </span>
                        </button>
                      );
                    })}
                    {!visiblePois.length ? (
                      <div className="rounded-2xl border border-[#00142b]/20 bg-[#efebe4]/50 p-6 text-center text-sm text-[#00142b]/65">
                        No places match your current filters.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={openDesktopSidebar}
            className={`${mapSidebarStyles.control} absolute right-6 top-6 pointer-events-auto size-12 ${FLOATING_BUTTON}`}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <ListFilter className="size-5" />
          </button>
        )}

        {!isCompactLayout && showPoiDetails && selectedDisplayPoi ? (
          <section className={`absolute bottom-6 right-6 w-[26rem] max-h-[calc(100dvh-3rem)] overflow-y-auto ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`} data-state="open">
            <PoiDetailsCard photoUrls={photoUrls} poi={selectedDisplayPoi} metrics={selectedRouteMetrics} onClose={clearActiveRoute} onDirections={handleViewRoute} />
          </section>
        ) : null}

        {isCompactLayout ? (
          <>
            {showPopular && !showPoiDetails && !showFilters ? (
              <section
                className={`${mapSidebarStyles.panel} absolute inset-x-3 sm:left-1/2 sm:right-auto sm:w-[min(40rem,calc(100vw-2.5rem))] sm:-translate-x-1/2 ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`}
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 2.5rem)" }}
                data-state="open"
              >
                <div className="pointer-events-auto p-2 sm:p-2.5">
                  <button
                    type="button"
                    onClick={() => setMobilePopularExpanded((current) => !current)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-2.5 py-1 text-left sm:min-h-14 sm:px-3"
                    aria-expanded={mobilePopularExpanded}
                  >
                    <div>
                      <p className="text-[0.88rem] font-semibold text-[#00142b] sm:text-base">Nearby places · {visiblePois.length}</p>
                      <p className="text-[0.68rem] text-[#00142b]/58 sm:text-xs">{mobilePopularExpanded ? "Tap to collapse · estimated drive times" : "Mokila & west Hyderabad"}</p>
                    </div>
                    <ChevronUp className={`size-3.5 text-[#00142b] transition ${mobilePopularExpanded ? "" : "rotate-180"}`} />
                  </button>
                  {mobilePopularExpanded ? (
                    <div className="mt-1.5 max-h-[48dvh] space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] sm:max-h-[44dvh] [&::-webkit-scrollbar]:hidden">
                      {listedPois.map((poi) => {
                        const meta = categoryMeta[poi.category];
                        const linkedRoute = routeLookup.get(poi.id);
                        const metrics = getDisplayRoute(linkedRoute, poi);

                        return (
                          <button
                            key={poi.id}
                            type="button"
                            onClick={() => handleFilteredPoiSelection(poi)}
                            className="flex w-full items-center gap-2 rounded-[0.9rem] border border-[#00142b]/12 bg-[#efebe4]/50 px-2 py-1.5 text-left sm:gap-2.5 sm:py-2"
                          >
                            <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-[0.8rem] border border-[#00142b]/24 bg-[#efebe4]/50 sm:h-14 sm:w-16">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getPoiImage(poi, photoUrls)} alt={poi.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[0.78rem] font-semibold text-[#00142b] sm:text-sm">{poi.name}</p>
                              <p className="text-[0.66rem] text-[#00142b]/56 sm:text-xs">{meta.label}</p>
                              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.62rem] font-semibold text-[#2449a4] sm:text-[0.65rem]">
                                <span>{metrics.distance}</span>
                                <span>{metrics.duration}</span>
                              </div>
                            </div>
                            <ChevronRight className="size-3.5 text-[#00142b]" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showPoiDetails && selectedDisplayPoi ? (
              <section
                className={`absolute inset-x-3 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain sm:left-1/2 sm:right-auto sm:w-[min(26rem,calc(100vw-2.5rem))] sm:-translate-x-1/2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${FLOATING_PANEL} ${OVERLAY_TRANSITION}`}
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 2.5rem)" }} data-state="open">
                <PoiDetailsCard photoUrls={photoUrls} poi={selectedDisplayPoi} metrics={selectedRouteMetrics} onClose={hideCompactPoiDetails} onDirections={handleViewRoute} />
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {routeNotice ? (
        <div role="status" className="absolute left-3 top-24 z-30 max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#fce190]/30 bg-[#00142b]/95 p-3 text-xs leading-5 text-[#fce190] shadow-xl">
          {routeNotice}
        </div>
      ) : null}

      {(isLoading || isUserRouteLoading) && (
        <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-30 flex justify-center px-3 sm:top-4 sm:px-4">
          <div className="max-w-full rounded-full border border-[#fce190]/32 bg-[#00142b]/92 px-4 py-2.5 text-[#fce190] shadow-xl backdrop-blur-2xl sm:px-5 sm:py-3">
            <div className="flex items-center gap-3">
              <Loader2 className="size-4 shrink-0 animate-spin text-[#fce190] sm:size-5" />
              <span className="truncate text-xs text-[#fce190]/72 sm:text-sm">
                {isUserRouteLoading
                  ? "Tracing your route to Varaprasad Laurels..."
                  : "Loading the selected road route..."}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
