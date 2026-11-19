"use client";

import { Component, Suspense, useEffect, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei/core/Gltf";
import { VILLA_MASTERPLAN_MODEL_URL } from "@/lib/villa-masterplan-model";

function CachedModel({ onSettled }: { onSettled: () => void }) {
  // Same Suspense cache and exact URL as VillasModel; no Canvas/GPU allocation.
  useGLTF(VILLA_MASTERPLAN_MODEL_URL);
  useEffect(onSettled, [onSettled]);
  return null;
}

class OptionalModelBoundary extends Component<{ children: ReactNode; onSettled: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    useGLTF.clear(VILLA_MASTERPLAN_MODEL_URL); // Let the real route retry a transient failure.
    this.props.onSettled();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function VillaMasterPlanModelWarmup({ onSettled }: { onSettled: () => void }) {
  return <OptionalModelBoundary onSettled={onSettled}>
    <Suspense fallback={null}><CachedModel onSettled={onSettled} /></Suspense>
  </OptionalModelBoundary>;
}
