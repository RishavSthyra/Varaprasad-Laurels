# Laurels amenity videos

The `/amenities` gallery uses the 22 Cloudflare-hosted Laurels films in `data/amenitiesPage.json`. Titles refer to the supplied clips, including the two cafeteria views and two guest-bedroom views. The previous TULA catalog is retained in `data/archive/amenities-tula.json`, not shown in the gallery.

## Local media

- `public/varaprasad_amenities/videos/<slug>.mp4`
- `public/varaprasad_amenities/first-frames/<slug>.avif`

These are byte-for-byte copies of the verified Downloads batch, not new encodes. Videos use the user-approved HEVC/H.265 Main 10 `hvc1` MP4 profile (Intel QSV veryslow ICQ 34), preserving 3840 x 2160, 24 fps and all 121 frames. The videos total 48,787,519 bytes. The 22 full-resolution AVIF first frames total 11,974,772 bytes. Downloads originals and previous comparison files are untouched.

The existing video player, automatic advance, filmstrip controls, AVIF fallback and warmup behavior are reused. The first visible poster is preloaded. Both page rendering and background video warmup use the same URL resolver, so neither fetches the old project's videos.

## Active Cloudflare paths

Bucket: `sthyra-assets`. All 44 uploaded objects have been verified against the local copies by byte length and SHA-256, including correct content types, CORS and video byte-range support.

- Videos: `Varaprasad_Laurels/Videos/videos/<slug>.mp4`
- Posters: `Varaprasad_Laurels/Images/first-frames/<slug>.avif`

The catalog retains stable local-style identifiers. `lib/amenities-final-assets.ts` maps these to the above R2 keys by default; both server gallery rendering and client background warmup use that resolver and the existing signed Cloudflare Worker delivery flow. The S3 API endpoint is not a browser playback URL. Local media remains untouched as a backup and is not used for playback or as an automatic fallback.

Optional separate overrides are `NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL` and `NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL`. Each accepts an R2 prefix or public absolute base URL. These replace the earlier combined Laurels base setting because the actual uploads use separate Videos and Images prefixes. Restart development or rebuild production after changing public environment variables. The older `NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL` belongs to legacy assets and does not affect Laurels.

## Validation

`npx tsx --test lib/amenities-final-assets.test.ts` checks catalog completeness, cloud defaults, independent overrides, asset boundaries, matched poster/video names, retained local copies and preservation of legacy URL behavior.

`node scripts/verify-amenity-assets.mjs` performs a read-only audit of all 44 cloud objects using the configured Worker and signing secret, compares them to local copies and checks video byte-range delivery. It does not upload, delete or modify media.
