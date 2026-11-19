import project from "../data/area-map-project.json";
import poiSources from "../data/poi.json";
import photoCredits from "../public/data/laurels-poi-photos.json";
import routeMetrics from "../public/data/laurels-route-metrics.json";

export const areaMapProject = project;
export const AREA_MAP_ROUTE_CACHE_KEY = "laurels-area-road-routes-v2";
export const AREA_MAP_INITIAL_ZOOM = 13.8;

export type AreaPoiCategory = "park" | "mall" | "bus_stop" | "school" | "hospital" | "landmark" | "sports" | "IT Company";
export type AreaPhotoCredit = (typeof photoCredits)[number];
export type AreaPoi = {
  id: number;
  name: string;
  category: AreaPoiCategory;
  lng: number;
  lat: number;
  locality: string;
  description: string;
  coordinateSource: string;
  coordinateNote?: string;
  website?: string;
  featured?: boolean;
  image: string;
  images: string[];
  thumbnail: string;
  photoCredit?: AreaPhotoCredit;
  distanceLabel: string;
  timeLabel: string;
};

export type AreaRoute = {
  id: number;
  name: string;
  coordinates: [number, number][];
  duration: number;
  distance: number;
  signature?: string;
  calculatedAt?: string;
  snapped?: { location: [number, number]; distance: number }[];
  note?: string;
};

export function straightLineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = Math.PI / 180;
  const latDelta = (b.lat - a.lat) * radians;
  const lngDelta = (b.lng - a.lng) * radians;
  const haversine = Math.sin(latDelta / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lngDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

export function poiRouteSignature(poi: { lat: number; lng: number }) {
  return `${project.lng},${project.lat}:${poi.lng},${poi.lat}`;
}

// A distance-based 16% trail, interpolated at both ends. It stays short even
// on routes with only a few vertices and moves smoothly along uneven geometry.
export function getAnimatedRouteSegment(coordinates: [number, number][], progress: number): [number, number][] {
  if (coordinates.length < 2 || !Number.isFinite(progress)) return [];
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [lng, lat] = coordinates[i - 1];
    const [nextLng, nextLat] = coordinates[i];
    cumulative.push(cumulative[i - 1] + straightLineDistance({ lng, lat }, { lng: nextLng, lat: nextLat }));
  }
  const total = cumulative[cumulative.length - 1];
  if (!total) return [];
  const head = Math.min(1, Math.max(0, progress)) * 1.16 * total;
  const start = Math.max(0, head - total * 0.16);
  const end = Math.min(total, head);
  if (end <= start) return [];
  const pointAt = (distance: number): [number, number] => {
    const i = Math.max(1, cumulative.findIndex((value) => value >= distance));
    const length = cumulative[i] - cumulative[i - 1];
    const t = length ? (distance - cumulative[i - 1]) / length : 0;
    return [
      coordinates[i - 1][0] + (coordinates[i][0] - coordinates[i - 1][0]) * t,
      coordinates[i - 1][1] + (coordinates[i][1] - coordinates[i - 1][1]) * t,
    ];
  };
  return [pointAt(start), ...coordinates.filter((_, i) => cumulative[i] > start && cumulative[i] < end), pointAt(end)];
}

export function googleMapsDirections(poi?: { lat: number; lng: number }) {
  const destination = poi ?? project;
  const params = new URLSearchParams({ api: "1", destination: `${destination.lat},${destination.lng}`, travelmode: "driving" });
  if (poi) params.set("origin", `${project.lat},${project.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

const metricById = new Map(routeMetrics.map((entry) => [entry.id, entry]));
const creditById = new Map(photoCredits.map((entry) => [entry.id, entry]));

export function getPoiRoadMetrics(poi: Pick<AreaPoi, "id" | "lat" | "lng">) {
  const metric = metricById.get(poi.id);
  return metric?.signature === poiRouteSignature(poi) ? metric : undefined;
}

export function formatAreaDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatAreaDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const areaMapPois: AreaPoi[] = poiSources.map((poi) => {
  const metric = getPoiRoadMetrics(poi);
  const photo = creditById.get(poi.id);
  return {
    ...poi,
    category: poi.category as AreaPoiCategory,
    image: photo?.image ?? `/images/poi/laurels/${poi.id}.avif`,
    images: [photo?.image ?? `/images/poi/laurels/${poi.id}.avif`],
    thumbnail: photo?.thumbnail ?? `/images/poi/laurels/${poi.id}-thumb.avif`,
    photoCredit: photo,
    distanceLabel: metric ? formatAreaDistance(metric.distance) : `${formatAreaDistance(straightLineDistance(project, poi))} direct`,
    timeLabel: metric ? `~${formatAreaDuration(metric.duration)} drive` : "Check in Maps",
  };
});

export function getAreaMapBounds(): [[number, number], [number, number]] {
  const points = [project, ...areaMapPois];
  return [
    [Math.min(...points.map((point) => point.lng)), Math.min(...points.map((point) => point.lat))],
    [Math.max(...points.map((point) => point.lng)), Math.max(...points.map((point) => point.lat))],
  ];
}

// Both the project and destination are part of the signature. Never reuse a route
// from the old Bengaluru project, a different POI, or a moved pin.
export function isValidPoiRoute(value: unknown, poi: Pick<AreaPoi, "id" | "name" | "lat" | "lng">): value is AreaRoute {
  if (!value || typeof value !== "object") return false;
  const route = value as Partial<AreaRoute>;
  if (route.id !== poi.id || route.name !== poi.name || route.signature !== poiRouteSignature(poi)) return false;
  if (typeof route.duration !== "number" || !Number.isFinite(route.duration) || route.duration <= 0) return false;
  if (typeof route.distance !== "number" || !Number.isFinite(route.distance) || route.distance <= 0) return false;
  if (!Array.isArray(route.coordinates) || route.coordinates.length < 2 || route.coordinates.length > 20000) return false;
  if (!route.coordinates.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] > 77 && p[0] < 79 && p[1] > 16 && p[1] < 19)) return false;
  const [startLng, startLat] = route.coordinates[0];
  const [endLng, endLat] = route.coordinates.at(-1)!;
  return straightLineDistance(project, { lat: startLat, lng: startLng }) < 1500
    && straightLineDistance(poi, { lat: endLat, lng: endLng }) < 1500;
}
