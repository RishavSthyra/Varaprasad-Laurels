import type { EquirectangularTilesPanorama } from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import { clamp, wrapAngleRad } from "@/lib/exterior-tour/math";
import {
  getSignedAssetUrl,
  getSignedAssetUrls,
} from "@/src/lib/signed-assets";
import type {
  ExteriorVector,
  PanoMeta,
  PanoTileDescriptor,
  PanoViewState,
} from "@/lib/exterior-tour/types";

export type ExteriorPanoramaSource = string | EquirectangularTilesPanorama;

export function asTiledPanorama(panorama: ExteriorPanoramaSource): EquirectangularTilesPanorama {
  if (typeof panorama !== "string") return panorama;
  // A preview-only fallback still needs the tiled adapter's object shape. Keep
  // one adapter for the session so a temporary metadata failure cannot strand
  // subsequent high-resolution panoramas on the plain-image adapter.
  return { width: 2048, cols: 1, rows: 1, baseUrl: panorama, tileUrl: () => null };
}
export type PanoImageLoader = (
  src: string,
  priority: "high" | "low" | "auto",
  cacheKey?: string,
  signal?: AbortSignal,
) => Promise<string>;
type ResolvedPanoramaAssets = {
  meta: PanoMeta;
  panorama: ExteriorPanoramaSource;
  previewUrl: string;
};
const joinedPanoPathCache = new Map<string, string>();
const LEGACY_SIGNED_ASSET_ORIGIN = "https://cdn.sthyra.com";

function isPublicPanoAssetPath(assetPath: string) {
  if (assetPath.startsWith("/")) {
    return true;
  }

  if (!/^https?:\/\//i.test(assetPath)) {
    return false;
  }

  return new URL(assetPath).origin !== LEGACY_SIGNED_ASSET_ORIGIN;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function joinPanoPath(baseUrl: string, path: string) {
  const key = `${baseUrl}|${path}`;
  const cached = joinedPanoPathCache.get(key);
  if (cached) {
    return cached;
  }

  const joined = `${ensureTrailingSlash(baseUrl)}${path.replace(/^\/+/, "")}`;
  joinedPanoPathCache.set(key, joined);

  if (joinedPanoPathCache.size > 2000) {
    const oldestKey = joinedPanoPathCache.keys().next().value;
    if (oldestKey) {
      joinedPanoPathCache.delete(oldestKey);
    }
  }

  return joined;
}

function loadImage(src: string, fetchPriority: "high" | "low" | "auto" = "auto") {
  return new Promise<string>((resolve, reject) => {
    const image = new Image() as HTMLImageElement & {
      fetchPriority?: "high" | "low" | "auto";
    };
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = fetchPriority;
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function wrapColumnDistance(distance: number, cols: number) {
  const absoluteDistance = Math.abs(distance);
  return Math.min(absoluteDistance, cols - absoluteDistance);
}

function angleFromVector(vector: ExteriorVector) {
  return Math.atan2(vector.y, vector.x);
}

function resolveFocusColumn(
  meta: PanoMeta,
  focusDirection?: ExteriorVector,
  panoForward?: ExteriorVector,
  fallbackYaw = 0,
) {
  const cols = meta.actualCols ?? meta.cols;
  if (!focusDirection || !panoForward) {
    const raw = ((fallbackYaw / (Math.PI * 2)) + 0.5) * cols;
    return ((raw % cols) + cols) % cols;
  }

  const delta = wrapAngleRad(angleFromVector(focusDirection) - angleFromVector(panoForward));
  const normalized = 0.5 + delta / (Math.PI * 2);
  const rawColumn = normalized * cols;
  return ((rawColumn % cols) + cols) % cols;
}

export function getPanoMetaUrl(panoId: string, baseUrl: string) {
  return joinPanoPath(baseUrl, `${panoId}/meta.json`);
}

export function getPanoPreviewUrl(
  panoId: string,
  previewFile = "preview.jpg",
  baseUrl: string,
) {
  return joinPanoPath(baseUrl, `${panoId}/${previewFile}`);
}

export function getPanoTileUrl(panoId: string, tilePath: string, baseUrl: string) {
  return joinPanoPath(baseUrl, `${panoId}/${tilePath}`);
}

export function canUseTiledPanorama(meta: PanoMeta) {
  const cols = meta.actualCols ?? meta.cols;
  const rows = meta.actualRows ?? meta.rows;
  return isPowerOfTwo(cols) && isPowerOfTwo(rows);
}

export function getResolvedPreviewUrl(
  panoId: string,
  baseUrl: string,
  previewFile = "preview.jpg",
) {
  return getPanoPreviewUrl(panoId, previewFile, baseUrl);
}

export function buildPhotoSpherePanorama(
  panoId: string,
  meta: PanoMeta,
  baseUrl: string,
  preferTiles = true,
  previewUrl?: string | null,
  signedTileUrls?: Record<string, string>,
): ExteriorPanoramaSource {
  const resolvedPreviewUrl =
    previewUrl ?? getResolvedPreviewUrl(panoId, baseUrl, meta.preview ?? "preview.jpg");

  if (!preferTiles || !canUseTiledPanorama(meta)) {
    if (!resolvedPreviewUrl) {
      throw new Error(`Missing preview image for ${panoId}`);
    }

    return resolvedPreviewUrl;
  }

  const cols = meta.actualCols ?? meta.cols;
  const rows = meta.actualRows ?? meta.rows;
  const explicitTiles = new Map(
    meta.tiles?.map((tile) => [`${tile.col}:${tile.row}`, tile.file]),
  );

  return {
    width: meta.width,
    cols,
    rows,
    ...(resolvedPreviewUrl ? { baseUrl: resolvedPreviewUrl } : {}),
    tileUrl: (col: number, row: number) => {
      if (col < 0 || row < 0 || col >= cols || row >= rows) {
        return null;
      }

      const explicitTile = explicitTiles.get(`${col}:${row}`);

      if (explicitTile) {
        const tilePath = getPanoTileUrl(panoId, `tiles/${explicitTile}`, baseUrl);
        return signedTileUrls?.[tilePath] ?? tilePath;
      }

      const template =
        meta.tileUrl ?? `tiles/tile_{col}_{row}.${meta.tileFormat ?? "jpg"}`;

      const tilePath = getPanoTileUrl(
        panoId,
        template.replace("{col}", String(col)).replace("{row}", String(row)),
        baseUrl,
      );
      return signedTileUrls?.[tilePath] ?? tilePath;
    },
  };
}

export function buildTileDescriptors(panoId: string, meta: PanoMeta, baseUrl: string) {
  const cols = meta.actualCols ?? meta.cols;
  const rows = meta.actualRows ?? meta.rows;
  const tileTemplate =
    meta.tileUrl ?? `tiles/tile_{col}_{row}.${meta.tileFormat ?? "jpg"}`;

  const tiles: PanoTileDescriptor[] = [];
  const explicitTiles = new Map(
    meta.tiles?.map((tile) => [`${tile.col}:${tile.row}`, tile.file]),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        key: `${col}:${row}`,
        col,
        row,
        url: getPanoTileUrl(
          panoId,
          explicitTiles.has(`${col}:${row}`)
            ? `tiles/${explicitTiles.get(`${col}:${row}`)}`
            : tileTemplate.replace("{col}", String(col)).replace("{row}", String(row)),
          baseUrl,
        ),
        left: col / cols,
        top: row / rows,
        width: 1 / cols,
        height: 1 / rows,
      });
    }
  }

  return tiles;
}

export function selectPriorityTiles(
  panoId: string,
  meta: PanoMeta,
  baseUrl: string,
  view: PanoViewState,
  limit = 48,
  viewport?: { aspect: number; minFov: number; maxFov: number },
) {
  const cols = meta.actualCols ?? meta.cols;
  const rows = meta.actualRows ?? meta.rows;
  const descriptors = buildTileDescriptors(panoId, meta, baseUrl);
  const focusColumn = resolveFocusColumn(meta, undefined, undefined, view.yaw);
  const focusRow = clamp((0.5 - view.pitch / Math.PI) * rows, 0, rows - 1);

  // Optional so interior tours keep their existing selection behaviour. Use
  // spherical tile bounds against the predicted camera frustum, including the
  // seam and poles; zoom is PSV's 0..100 vertical-FOV interpolation.
  const verticalFov = viewport
    ? (viewport.maxFov + clamp(view.zoom, 0, 100) / 100 *
      (viewport.minFov - viewport.maxFov)) * Math.PI / 180
    : Math.PI;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) *
    Math.max(0.1, viewport?.aspect ?? 1));
  const radius = Math.min(Math.PI / 2, Math.PI / cols + Math.PI / (2 * rows));
  const margin = Math.sin(radius);
  const viewScores = new Map<string, number>();
  const visible = descriptors.filter((tile) => {
    if (!viewport) return true;
    const yaw = ((tile.col + 0.5) / cols - 0.5) * Math.PI * 2;
    const pitch = (0.5 - (tile.row + 0.5) / rows) * Math.PI;
    const delta = yaw - view.yaw;
    const forward = Math.cos(pitch) * Math.cos(delta) * Math.cos(view.pitch) +
      Math.sin(pitch) * Math.sin(view.pitch);
    const right = Math.cos(pitch) * Math.sin(delta);
    const up = Math.sin(pitch) * Math.cos(view.pitch) -
      Math.cos(pitch) * Math.cos(delta) * Math.sin(view.pitch);
    viewScores.set(tile.key, 1 - forward);
    return forward * Math.sin(horizontalFov / 2) - Math.abs(right) *
      Math.cos(horizontalFov / 2) >= -margin &&
      forward * Math.sin(verticalFov / 2) - Math.abs(up) *
      Math.cos(verticalFov / 2) >= -margin;
  });

  return visible
    .sort((a, b) => {
      if (viewport) return viewScores.get(a.key)! - viewScores.get(b.key)!;
      const aColDistance = wrapColumnDistance(a.col - focusColumn, cols);
      const bColDistance = wrapColumnDistance(b.col - focusColumn, cols);
      const aRowDistance = Math.abs(a.row - focusRow);
      const bRowDistance = Math.abs(b.row - focusRow);

      const aScore = aRowDistance * 2.8 + aColDistance * 0.9;
      const bScore = bRowDistance * 2.8 + bColDistance * 0.9;

      return aScore - bScore;
    })
    .slice(0, limit);
}

export function selectWarmupTiles(
  panoId: string,
  meta: PanoMeta,
  baseUrl: string,
  limit = 12,
) {
  return selectPriorityTiles(
    panoId,
    meta,
    baseUrl,
    {
      yaw: 0,
      pitch: 0,
      zoom: 1.15,
    },
    limit,
  );
}

export class PanoAssetStore {
  private metaCache = new Map<string, PanoMeta>();
  private metaPromises = new Map<string, Promise<PanoMeta>>();
  private imagePromises = new Map<string, Promise<string>>();
  private signedUrlPromises = new Map<string, Promise<string>>();
  private signedTileUrlMaps = new Map<string, Promise<Record<string, string>>>();
  private panoramaPromises = new Map<string, Promise<ResolvedPanoramaAssets>>();

  constructor(
    private readonly baseUrl: string,
    private readonly imageLoader: PanoImageLoader = loadImage,
    private readonly baseUrlsByPanoId: Record<string, string> = {},
  ) {}

  getBaseUrl(panoId: string) {
    return this.baseUrlsByPanoId[panoId] ?? this.baseUrl;
  }

  getPanorama(panoId: string, preferTiles = true): Promise<ResolvedPanoramaAssets> {
    const baseUrl = this.getBaseUrl(panoId);
    const key = `${panoId}|${preferTiles ? "tiles" : "preview"}`;
    const cached = this.panoramaPromises.get(key);
    if (cached) {
      return cached;
    }

    // Authorize metadata and the conventional preview together. The preview can
    // then download while metadata and tile authorization are being prepared.
    const authorization = this.metaCache.has(panoId)
      ? Promise.resolve()
      : this.getSignedUrls([
          getPanoMetaUrl(panoId, baseUrl),
          getPanoPreviewUrl(panoId, "preview.jpg", baseUrl),
        ]);
    const promise = authorization.then(() => this.getMeta(panoId))
      .then(async (meta) => {
        const previewPath = getResolvedPreviewUrl(
          panoId, baseUrl, meta.preview ?? "preview.jpg",
        );
        const useTiles = preferTiles && canUseTiledPanorama(meta);
        // Sign the preview and tile URLs together, instead of serial API calls.
        const tilePaths = useTiles
          ? buildTileDescriptors(panoId, meta, baseUrl).map((tile) => tile.url)
          : [];
        const signedUrls = await this.getSignedUrls([previewPath, ...tilePaths]);
        const previewUrl = signedUrls[previewPath];

        return {
          meta,
          previewUrl,
          panorama: buildPhotoSpherePanorama(
            panoId, meta, baseUrl, useTiles, previewUrl, signedUrls,
          ),
        };
      })
      .catch((error) => {
        this.panoramaPromises.delete(key);
        throw error;
      });

    this.panoramaPromises.set(key, promise);
    return promise;
  }

  async getSignedUrl(assetPath: string) {
    if (isPublicPanoAssetPath(assetPath)) {
      return assetPath;
    }

    const cachedPromise = this.signedUrlPromises.get(assetPath);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = getSignedAssetUrl(assetPath).catch((error) => {
      this.signedUrlPromises.delete(assetPath);
      throw error;
    });

    this.signedUrlPromises.set(assetPath, promise);
    return promise;
  }

  async getSignedUrls(assetPaths: string[]) {
    const uniqueAssetPaths = [...new Set(assetPaths.filter(Boolean))];

    if (uniqueAssetPaths.length === 0) {
      return {} as Record<string, string>;
    }

    const resolvedUrls: Record<string, string> = {};
    const missingAssetPaths: string[] = [];

    uniqueAssetPaths.forEach((assetPath) => {
      if (isPublicPanoAssetPath(assetPath)) {
        resolvedUrls[assetPath] = assetPath;
        return;
      }

      const cachedPromise = this.signedUrlPromises.get(assetPath);

      if (cachedPromise) {
        return;
      }

      missingAssetPaths.push(assetPath);
    });

    if (missingAssetPaths.length > 0) {
      const batchPromise = getSignedAssetUrls(missingAssetPaths).catch((error) => {
        missingAssetPaths.forEach((assetPath) => {
          this.signedUrlPromises.delete(assetPath);
        });
        throw error;
      });

      missingAssetPaths.forEach((assetPath) => {
        const assetPromise = batchPromise.then((urls) => {
          const signedUrl = urls[assetPath];

          if (!signedUrl) {
            throw new Error(`Missing signed URL for ${assetPath}`);
          }

          return signedUrl;
        });

        this.signedUrlPromises.set(assetPath, assetPromise);
      });
    }

    await Promise.all(
      uniqueAssetPaths.map(async (assetPath) => {
        const signedUrl = await this.getSignedUrl(assetPath);
        resolvedUrls[assetPath] = signedUrl;
      }),
    );

    return resolvedUrls;
  }

  async getSignedTileUrlMap(panoId: string, meta: PanoMeta) {
    const cacheKey = `${this.getBaseUrl(panoId)}|${panoId}|${meta.actualCols ?? meta.cols}x${meta.actualRows ?? meta.rows}|${meta.tileUrl ?? meta.tileFormat ?? "jpg"}`;
    const cachedPromise = this.signedTileUrlMaps.get(cacheKey);

    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = this.getSignedUrls(
      buildTileDescriptors(panoId, meta, this.getBaseUrl(panoId)).map((tile) => tile.url),
    ).catch((error) => {
      this.signedTileUrlMaps.delete(cacheKey);
      throw error;
    });

    this.signedTileUrlMaps.set(cacheKey, promise);
    return promise;
  }

  async resolveSignedTiles(tiles: PanoTileDescriptor[]) {
    const signedTileUrls = await this.getSignedUrls(tiles.map((tile) => tile.url));

    return tiles.map((tile) => ({
      ...tile,
      url: signedTileUrls[tile.url] ?? tile.url,
    }));
  }

  async getMeta(panoId: string) {
    const cachedMeta = this.metaCache.get(panoId);
    if (cachedMeta) {
      return cachedMeta;
    }

    const cachedPromise = this.metaPromises.get(panoId);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = this.getSignedUrl(getPanoMetaUrl(panoId, this.getBaseUrl(panoId)))
      .then((signedMetaUrl) =>
        fetch(signedMetaUrl, {
          cache: "force-cache",
        }),
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load pano meta for ${panoId}`);
        }

        const meta = (await response.json()) as PanoMeta;
        this.metaCache.set(panoId, meta);
        return meta;
      })
      .finally(() => {
        this.metaPromises.delete(panoId);
      });

    this.metaPromises.set(panoId, promise);
    return promise;
  }

  preloadImage(
    src: string,
    fetchPriority: "high" | "low" | "auto" = "auto",
    cacheKey?: string,
    signal?: AbortSignal,
  ) {
    // Cancellable callers have their own subscription. The exterior loader
    // shares the network request without letting one cancelled subscriber kill
    // a foreground download. Keep legacy interior promise behaviour unchanged.
    if (signal) {
      signal.throwIfAborted();
      return this.imageLoader(src, fetchPriority, cacheKey, signal);
    }
    const cached = this.imagePromises.get(src);
    if (cached) {
      return cached;
    }

    const promise = this.imageLoader(src, fetchPriority, cacheKey).then(
      (url) => {
        // External loaders own their bounded cache. Settled promises must not
        // claim evicted images are warm. Preserve the legacy interior loader.
        if (this.imageLoader !== loadImage) this.imagePromises.delete(src);
        return url;
      },
      (error) => {
        this.imagePromises.delete(src);
        throw error;
      },
    );

    this.imagePromises.set(src, promise);
    return promise;
  }

  async preloadPanoramaPreview(
    panoId: string,
    fetchPriority: "high" | "low" | "auto" = "high",
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const defaultPreview = getPanoPreviewUrl(panoId, "preview.jpg", this.getBaseUrl(panoId));
    const urls = await this.getSignedUrls([
      getPanoMetaUrl(panoId, this.getBaseUrl(panoId)),
      defaultPreview,
    ]);
    signal?.throwIfAborted();
    // Attach a rejection handler immediately: a custom preview may legitimately
    // have no preview.jpg. Never let that speculative request reject unhandled.
    const defaultWarmup = this.preloadImage(urls[defaultPreview], fetchPriority, undefined, signal)
      .then((url) => ({ url, error: null }))
      .catch((error: unknown) => ({ url: null, error }));
    const meta = await this.getMeta(panoId).catch(() => null);
    signal?.throwIfAborted();
    if (meta?.preview && meta.preview !== "preview.jpg") {
      return this.preloadPreview(panoId, meta.preview, fetchPriority, signal);
    }
    const result = await defaultWarmup;
    if (!result.url) {
      throw result.error;
    }
    return result.url;
  }

  async preloadPreview(
    panoId: string,
    previewFile = "preview.jpg",
    fetchPriority: "high" | "low" | "auto" = "high",
    signal?: AbortSignal,
  ) {
    const assetPath = getPanoPreviewUrl(panoId, previewFile, this.getBaseUrl(panoId));
    const signedSrc = await this.getSignedUrl(assetPath);
    await this.preloadImage(signedSrc, fetchPriority, undefined, signal);
    return signedSrc;
  }

  async preloadTile(tile: PanoTileDescriptor, fetchPriority: "high" | "low" | "auto" = "auto") {
    const signedSrc = await this.getSignedUrl(tile.url);
    await this.preloadImage(signedSrc, fetchPriority);
    return {
      ...tile,
      url: signedSrc,
    };
  }
}
