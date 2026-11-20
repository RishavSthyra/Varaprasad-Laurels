import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { HOME_HERO_IMAGE_SRC, HOME_HERO_VIDEO_SRC, HOME_HERO_IMAGE_BYTES, HOME_HERO_VIDEO_BYTES, HOME_HERO_REVERSE_VIDEO_SRC, HOME_HERO_REVERSE_VIDEO_BYTES, HOME_HERO_WARMUP_MAX_WAIT_MS } from "./home-hero";

test("the homepage uses the supplied cloud AV1 and AVIF with verified complete-file sizes", () => {
  assert.equal(HOME_HERO_IMAGE_SRC, "https://cdn.sthyra.com/Varaprasad_Laurels/Images/homepage_first_frame.avif");
  assert.equal(HOME_HERO_VIDEO_SRC, "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/homepage_compressed_av1.mp4");
  assert.equal(HOME_HERO_IMAGE_BYTES, 512576);
  assert.equal(HOME_HERO_VIDEO_BYTES, 7798241);
  assert.equal(HOME_HERO_REVERSE_VIDEO_SRC, "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/homepage_reverse_av1.mp4");
  assert.equal(HOME_HERO_REVERSE_VIDEO_BYTES, 7168048);
  assert.equal(HOME_HERO_WARMUP_MAX_WAIT_MS, 8000);
});

test("home preloader warms complete hero assets first and reveals decoded playback over the same poster", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const client = readFileSync("components/HomePageClient.tsx", "utf8");
  const hero = readFileSync("components/sections/HeroSection.tsx", "utf8");
  assert(page.includes("imageSrc={HOME_HERO_IMAGE_SRC} videoSrc={HOME_HERO_VIDEO_SRC}"));
  assert(!page.includes('rel="preload"'), "Do not bypass persistent-cache restoration with unconditional CDN preloads");
  assert(client.includes("<HeroSection imageSrc={posterSource} videoSrc={videoSource}"));
  assert(hero.includes('loading="eager"'));
  assert(hero.includes('fetchPriority="high"'));
  assert(hero.includes('animate={revealContent ? "show" : "hidden"}'));
  assert(hero.includes("<HomeHeroVideo videoSrc={videoSrc} reverseVideoSrc={reverseVideoSrc} poster={imageSrc}"));
  assert(client.includes("<LuxuryVillaPreloader"));
  assert(client.includes("HOME_HERO_WARMUP_MAX_WAIT_MS"));
  assert(client.includes("imageReady && assetsSettled && heroVideoSettled"));
  assert(client.includes("Promise.all([assets.poster.warm(), assets.video.warm(), assets.reverse.warm()])"));
  assert(page.includes("reverseVideoSrc={HOME_HERO_REVERSE_VIDEO_SRC}"));
  assert(client.includes("reverseVideoSrc={reverseSource}"));
  assert(client.includes("skipIfSeen={false}"));
  assert(client.includes("observeVillaMasterPlanOpening"));
  assert(client.includes("scheduleVillaMasterPlanBuffering"));
  assert(hero.includes('router.push("/master-plan")'));
});

test("ping-pong uses positive playback of two prepared clips, retaining the outgoing frame until presentation", () => {
  const source = readFileSync("components/sections/HomeHeroVideo.tsx", "utf8");
  assert(source.includes('data-home-direction="forward"'));
  assert(source.includes('data-home-direction="reverse"'));
  assert(source.includes('activeRef.current === "forward" && reverseVideoSrc && !reverseFailed ? "reverse" : "forward"'));
  assert(source.includes("player.requestVideoFrameCallback(presented)"));
  assert(source.includes("other.pause()"));
  assert(source.includes("show(direction)"));
  assert(source.includes("document.hidden"));
  assert(source.includes('removeEventListener("visibilitychange", sync)'));
  assert(source.includes('start("forward", true)'));
  assert(!source.includes("playbackRate"));
  assert(!source.includes(" loop "), "Native loop would bypass the reverse handoff");
});
