import photos from "../public/data/laurels-poi-photos.json";

export const AREA_MAP_PHOTO_BASE_KEY = "Varaprasad_Laurels/Images/laurels/";
export const AREA_MAP_PHOTO_PLACEHOLDER = "/images/poi/laurels-unavailable.svg";

/** Retain local catalog/credit identities as a recovery record, but serve the
 * unchanged AVIF bytes through the site's authenticated Cloudflare Worker. */
export function getAreaMapPhotoKey(localPath: string) {
  const prefix = "/images/poi/laurels/";
  const filename = localPath.startsWith(prefix) ? localPath.slice(prefix.length) : "";
  if (!/^\d+(?:-v\d+)?(?:-thumb)?\.avif$/.test(filename)) {
    throw new Error(`Unrecognized map photo path: ${localPath}`);
  }
  return `${AREA_MAP_PHOTO_BASE_KEY}${filename}`;
}

export const areaMapPhotoAssets = photos.flatMap((photo) => [
  { localPath: photo.image, key: getAreaMapPhotoKey(photo.image), sha256: photo.sha256, bytes: photo.bytes },
  { localPath: photo.thumbnail, key: getAreaMapPhotoKey(photo.thumbnail), sha256: photo.thumbnailSha256, bytes: photo.thumbnailBytes },
]);

export function getAreaMapPhotoUrl(localPath: string | undefined, urls: Readonly<Record<string, string>>) {
  // Never fall back to the local photograph: keep the small neutral icon on an
  // unavailable cloud image. Local AVIFs remain backups, not runtime sources.
  return (localPath && urls[localPath]) || AREA_MAP_PHOTO_PLACEHOLDER;
}
