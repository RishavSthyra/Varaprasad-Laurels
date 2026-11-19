export const LOCAL_AMENITIES_FINAL_BASE_URL = "/AmenitiesGoodExpoOptimized";
export const CDN_AMENITIES_FINAL_BASE_URL =
  "https://cdn.sthyra.com/TULA/Videos/AmenitiesGoodExpoOptimized";

export const LOCAL_LAURELS_AMENITIES_BASE_URL = "/varaprasad_amenities";
export const LAURELS_AMENITY_VIDEO_BASE_PATH = "Varaprasad_Laurels/Videos/videos";
export const LAURELS_AMENITY_POSTER_BASE_PATH = "Varaprasad_Laurels/Images/first-frames";

function isUnderAssetBase(value: string, base: string) {
  return value === base || value.startsWith(`${base}/`);
}

function getConfiguredAmenitiesFinalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL?.trim().replace(/\/+$/, "") ||
    CDN_AMENITIES_FINAL_BASE_URL
  );
}

export function resolveAmenitiesFinalAssetUrl(value: string) {
  const videoBase = `${LOCAL_LAURELS_AMENITIES_BASE_URL}/videos`;
  const posterBase = `${LOCAL_LAURELS_AMENITIES_BASE_URL}/first-frames`;
  if (isUnderAssetBase(value, videoBase)) {
    // Relative R2 keys use the shared Worker signing flow in both the gallery
    // and background warmup. Videos and posters were uploaded separately.
    const baseUrl = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL
      ?.trim().replace(/\/+$/, "") || LAURELS_AMENITY_VIDEO_BASE_PATH;
    return `${baseUrl}${value.slice(videoBase.length)}`;
  }
  if (isUnderAssetBase(value, posterBase)) {
    const baseUrl = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL
      ?.trim().replace(/\/+$/, "") || LAURELS_AMENITY_POSTER_BASE_PATH;
    return `${baseUrl}${value.slice(posterBase.length)}`;
  }

  if (!isUnderAssetBase(value, LOCAL_AMENITIES_FINAL_BASE_URL)) {
    return value;
  }

  const baseUrl = getConfiguredAmenitiesFinalBaseUrl();
  return `${baseUrl}${value.slice(LOCAL_AMENITIES_FINAL_BASE_URL.length)}`;
}

export function isDirectAssetUrl(value: string) {
  return /^(?:https?:\/\/|\/|blob:|data:)/i.test(value.trim());
}

export function isHlsAssetUrl(value?: string) {
  return Boolean(value && /\.m3u8(?:$|[?#])/i.test(value));
}
