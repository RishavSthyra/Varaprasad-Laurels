import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { HOME_HERO_IMAGE_SRC } from "./home-hero";

test("the homepage uses the supplied AVIF without re-encoding it", () => {
  assert.equal(HOME_HERO_IMAGE_SRC, "/gate.00297.avif");
  const image = readFileSync(`public${HOME_HERO_IMAGE_SRC}`);
  assert.equal(image.length, 938650);
  assert.equal(createHash("sha256").update(image).digest("hex"), "1a2f2f85fa4d3cacd037703e3922c207bcea53ecd4e0f58ce3cc1ab955cd7515");
});

test("the homepage stays static while a bounded loader warms the next route", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const client = readFileSync("components/HomePageClient.tsx", "utf8");
  const hero = readFileSync("components/sections/HeroSection.tsx", "utf8");
  assert(page.includes("href={HOME_HERO_IMAGE_SRC}"));
  assert(client.includes("<HeroSection imageSrc={imageSrc}"));
  assert(hero.includes('loading="eager"'));
  assert(hero.includes('fetchPriority="high"'));
  assert(hero.includes('animate={revealContent ? "show" : "hidden"}'));
  for (const source of [page, client, hero]) {
    assert(!/<video|heroVideo|signR2AssetKeys|useSignedAssetUrls/.test(source));
  }
  assert(client.includes("<LuxuryVillaPreloader"));
  assert(client.includes("HOME_WARMUP_MAX_WAIT_MS"));
  assert(client.includes("observeVillaMasterPlanOpening"));
  assert(client.includes("scheduleVillaMasterPlanBuffering"));
  assert(hero.includes('router.push("/master-plan")'));
});
