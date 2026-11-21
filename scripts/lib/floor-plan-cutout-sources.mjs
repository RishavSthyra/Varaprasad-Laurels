// User-cleaned PNGs. Keep their original canvas so calibrated POIs do not move.
export const FLOOR_PLAN_CUTOUT_SOURCES = [
  { group: "clubhouse", id: "ground", file: "ground-Photoroom.png" },
  { group: "clubhouse", id: "first", file: "first-Photoroom.png" },
  { group: "clubhouse", id: "second", file: "second-Photoroom.png" },
  { group: "clubhouse", id: "third", file: "third-Photoroom.png" },
  { group: "clubhouse", id: "fourth", file: "fourth-Photoroom.png" },
  { group: "villa", id: "ground", file: "ground-Photoroom_villa.png" },
  { group: "villa", id: "first", file: "first-Photoroom-villa.png" },
  { group: "villa", id: "second", file: "second-Photoroom_villa.png" },
].map(source => {
  const directory = source.group === "clubhouse" ? "/clubhouse-floor-plans" : "/villa-floor-plans/villa-1";
  return {
    ...source,
    input: `public/floor-plans-nobg/${source.file}`,
    image: `${directory}/${source.id}-nobg.avif`,
    thumbnail: `${directory}/${source.id}-nobg-small.avif`,
  };
});
