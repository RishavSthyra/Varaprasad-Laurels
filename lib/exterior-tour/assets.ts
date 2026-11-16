export const EXTERIOR_PANO_CDN_BASE_PATH =
  "TULA/Panos/exterior-pano-v2";

export const EXTERIOR_INITIAL_PANO_FOLDER = "PANO.00000";

export const EXTERIOR_INITIAL_PREVIEW_KEY =
  `${EXTERIOR_PANO_CDN_BASE_PATH}/${EXTERIOR_INITIAL_PANO_FOLDER}/preview.jpg`;

// R2 object keys use the existing signed Cloudflare Worker asset loader.
// Keep the legacy TULA keys above for the older amenity thumbnail assets.
export const EXTERIOR_PANO_ASSET_BASE_URL =
  "Varaprasad_Laurels/Panos/varaprasad_exterior_panos";
export const EXTERIOR_ASSET_INITIAL_PANO_FOLDER = "EP.00000";
export const EXTERIOR_ASSET_INITIAL_PREVIEW_KEY =
  `${EXTERIOR_PANO_ASSET_BASE_URL}/${EXTERIOR_ASSET_INITIAL_PANO_FOLDER}/preview.jpg`;
export const EXTERIOR_ASSET_INITIAL_NODE_ID = "Exterior_PANO_Spline_F0000";
