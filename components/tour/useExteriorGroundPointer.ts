"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { Viewer } from "@photo-sphere-viewer/core";
import { getVillaInteriorHref, getVillaPointers } from "@/lib/exterior-tour/villa-hotspots";

export function useExteriorGroundPointer(
  viewerRef: RefObject<Viewer | null>,
  nodeId: string,
  enabled: boolean,
) {
  const router = useRouter();
  useEffect(() => {
    const viewer = viewerRef.current;
    const configs = getVillaPointers(nodeId);
    if (!viewer || !enabled || !configs.length) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void (async () => {
      const [{ GLTFLoader }, { Mesh, Vector3, Box3 }, { createGroundPointer, GROUND_POINTER_MODEL_URL }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three"),
        import("@/lib/exterior-tour/ground-pointer"),
      ]);
      if (cancelled) return;
      // One model request per active pano, shared by all of its entrance markers.
      const model = await new GLTFLoader().loadAsync(GROUND_POINTER_MODEL_URL);
      let mesh: InstanceType<typeof Mesh> | undefined;
      model.scene.traverse((object) => { if (object instanceof Mesh && !mesh) mesh = object; });
      const pointers = mesh ? configs.map((config) => ({ config, pointer: createGroundPointer(mesh!.geometry, config) })) : [];
      model.scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            Object.values(material).forEach((value: unknown) => {
              if (value && typeof value === "object" && "isTexture" in value && "dispose" in value) {
                (value as { dispose: () => void }).dispose();
              }
            });
            material.dispose();
          });
        }
      });
      if (cancelled) { pointers.forEach(({ pointer }) => pointer.dispose()); return; }
      if (!pointers.length) return;
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const start = performance.now();
      let rendering = false;
      const corner = new Vector3();
      const bounds = new Box3();
      const stop = (event: Event) => event.stopPropagation();
      const markers = pointers.map(({ config, pointer }) => {
        const link = document.createElement("a");
        link.href = getVillaInteriorHref(config);
        link.setAttribute("aria-label", `Enter Villa ${config.villaNumber}, ${config.facing}-facing`);
        link.dataset.villaEntrance = config.id;
        // No visible text or overlay: the white 3D arrow is the visible control.
        link.style.cssText = "position:absolute;z-index:5;display:none;cursor:pointer;border-radius:12px;background:transparent;touch-action:manipulation;";
        ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "touchstart", "touchend"].forEach((name) => link.addEventListener(name, stop));
        link.addEventListener("click", (event) => {
          event.stopPropagation();
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          router.push(getVillaInteriorHref(config));
        });
        let prefetched = false;
        const prefetch = () => {
          if (!prefetched) { prefetched = true; router.prefetch(getVillaInteriorHref(config)); }
        };
        link.addEventListener("pointerenter", prefetch);
        link.addEventListener("focus", prefetch);
        viewer.container.appendChild(link);
        viewer.renderer.addObject(pointer.group);
        return { pointer, link };
      });
      const positionLinks = () => {
        const { width, height } = viewer.state.size;
        for (const { pointer, link } of markers) {
          if (viewer.state.direction.dot(pointer.group.position) <= 0) { link.style.display = "none"; continue; }
          bounds.setFromObject(pointer.group);
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (let i = 0; i < 8; i++) {
            corner.set(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
            const { x, y } = viewer.dataHelper.vector3ToViewerCoords(corner);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
          const x = (minX + maxX) / 2, y = (minY + maxY) / 2;
          const w = Math.max(44, maxX - minX + 8), h = Math.max(44, maxY - minY + 8);
          const visible = x >= 0 && x <= width && y >= 0 && y <= height;
          link.style.display = visible ? "block" : "none";
          link.style.left = `${x - w / 2}px`; link.style.top = `${y - h / 2}px`;
          link.style.width = `${w}px`; link.style.height = `${h}px`;
        }
      };
      const update = () => {
        pointers.forEach(({ pointer }) => pointer.update((performance.now() - start) / 1000, media.matches));
        positionLinks();
      };
      const syncMotion = () => {
        const shouldRender = !media.matches && document.visibilityState === "visible";
        if (rendering !== shouldRender) {
          viewer.needsContinuousUpdate(shouldRender);
          rendering = shouldRender;
        }
        update();
        viewer.needsUpdate();
      };
      const animate = () => {
        const shouldRender = !media.matches && document.visibilityState === "visible";
        if (rendering !== shouldRender) syncMotion();
        update(); // Also reproject on user rotation/zoom with reduced motion.
      };
      viewer.addEventListener("before-render", animate);
      media.addEventListener("change", syncMotion);
      document.addEventListener("visibilitychange", syncMotion);
      syncMotion();
      dispose = () => {
        viewer.removeEventListener("before-render", animate);
        media.removeEventListener("change", syncMotion);
        document.removeEventListener("visibilitychange", syncMotion);
        if (rendering) viewer.needsContinuousUpdate(false);
        markers.forEach(({ pointer, link }) => {
          link.remove();
          viewer.renderer.removeObject(pointer.group);
          pointer.dispose();
        });
        viewer.needsUpdate();
      };
    })().catch((error: unknown) => {
      if (!cancelled) console.warn("Exterior ground pointer could not load:", error);
    });
    return () => { cancelled = true; dispose?.(); };
  }, [viewerRef, nodeId, enabled, router]);
}
