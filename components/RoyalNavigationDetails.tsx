"use client";

import { useId } from "react";
import styles from "./UpperLayoutCTA.module.css";

export function RoyalOrnament({ mirrored = false }: { mirrored?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48"
      className={`${styles.ornament} ${mirrored ? styles.ornamentRight : ""}`}>
      <defs>
        <linearGradient id={`ornament-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f1d89d" /><stop offset=".32" stopColor="#c99c50" />
          <stop offset=".63" stopColor="#e9c477" /><stop offset="1" stopColor="#a77a39" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#ornament-${id})`} strokeWidth=".85" strokeLinejoin="round">
        <path d="M64 .75C40 .75 32 23.5 0 24C32 24.5 40 47.25 64 47.25" />
        <path d="M64 4C43 4 33 23.5 4 24C33 24.5 43 44 64 44" opacity=".4" />
        <path d="M0 24H18" opacity=".8" />
      </g>
      <path d="M25 24Q29 22.5 31 19.5Q33 22.5 37 24Q33 25.5 31 28.5Q29 25.5 25 24Z"
        fill={`url(#ornament-${id})`} stroke="#f0d69c" strokeWidth=".4" />
    </svg>
  );
}

export function RoyalShield() {
  const id = useId().replace(/:/g, "");
  const silhouette = "M39 3Q42 3 47 6L66 17Q74 22 74 32V70Q74 78 66 83L44 98Q39 101 34 98L12 83Q4 78 4 70V32Q4 22 12 17L31 6Q36 3 39 3Z";
  return (
    <svg aria-hidden="true" viewBox="0 0 78 104" preserveAspectRatio="none" className={styles.shield}>
      <defs>
        <linearGradient id={`shield-gold-${id}`} x2=".7" y2="1">
          <stop stopColor="#f4dca3" /><stop offset=".4" stopColor="#d6ae62" />
          <stop offset=".72" stopColor="#92703b" /><stop offset="1" stopColor="#e8cc91" />
        </linearGradient>
      </defs>
      <path d={silhouette} fill="none"
        stroke={`url(#shield-gold-${id})`} strokeWidth="1.5" />
    </svg>
  );
}

export function RoyalJewel({ className }: { className: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <defs>
        <linearGradient id={`jewel-${id}`} x2="1" y2="1">
          <stop stopColor="#fff0bd" /><stop offset=".5" stopColor="#e9c477" />
          <stop offset="1" stopColor="#a77a39" />
        </linearGradient>
      </defs>
      <path d="M8 1L15 8L8 15L1 8Z" fill={`url(#jewel-${id})`} stroke="#f4dca3" strokeWidth=".8" />
      <path d="M8 2V8H2Z" fill="#fff2ca" opacity=".4" />
    </svg>
  );
}
