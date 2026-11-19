"use client";

import * as React from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type GlassSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  variant?: "light" | "tour";
};

export default function GlassSelect({
  value,
  onValueChange,
  placeholder = "Select an option",
  children,
  disabled = false,
  ariaLabel,
  variant = "light",
}: GlassSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={variant === "tour" ? "group flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(34,32,28,0.45))] px-4 py-3 text-left text-xs font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_8px_24px_rgba(0,0,0,0.10)] backdrop-blur-2xl outline-none transition hover:border-white/50 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[#ecd1a0]/70 disabled:cursor-wait disabled:opacity-50" : `
          group flex h-10 w-full items-center justify-between rounded-[24px]
          border border-white/50 bg-white/45 px-5 text-sm text-zinc-800
          shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl
          outline-none transition duration-200
          hover:bg-white/55
          focus:ring-4 focus:ring-white/20
          dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10
        `}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className={`h-4 w-4 shrink-0 transition group-data-[state=open]:rotate-180 ${variant === "tour" ? "text-[#ecd1a0]" : "text-zinc-500 dark:text-zinc-400"}`} />
        </Select.Icon>
      </Select.Trigger>

      <AnimatePresence>
        <Select.Portal>
          <Select.Content asChild position="popper" sideOffset={8} align="end" collisionPadding={12}>
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ maxHeight: "var(--radix-select-content-available-height)" }}
              className={variant === "tour" ? "z-[160] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-white/30 bg-[linear-gradient(140deg,rgba(108,103,94,0.78),rgba(27,27,25,0.88))] p-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_45px_rgba(0,0,0,0.24)] backdrop-blur-2xl" : `
                z-100 min-w-(--radix-select-trigger-width) overflow-hidden
                rounded-[24px] border border-white/50 bg-white/60
                p-2 shadow-[0_20px_60px_rgba(15,23,42,0.18)]
                backdrop-blur-2xl
                dark:border-white/10 dark:bg-[#0b0b0f]/80
              `}
            >
              <Select.Viewport className="max-h-64 overflow-y-auto overscroll-contain p-1">
                {children}
              </Select.Viewport>
            </motion.div>
          </Select.Content>
        </Select.Portal>
      </AnimatePresence>
    </Select.Root>
  );
}

type GlassSelectItemProps = {
  value: string;
  children: React.ReactNode;
  variant?: "light" | "tour";
};

export function GlassSelectItem({
  value,
  children,
  variant = "light",
}: GlassSelectItemProps) {
  return (
    <Select.Item
      value={value}
      className={variant === "tour" ? "relative flex min-h-11 cursor-pointer select-none items-center rounded-xl border border-transparent px-3 py-2.5 pr-10 text-xs text-white/85 outline-none transition data-[highlighted]:border-white/20 data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[state=checked]:bg-white/15 data-[state=checked]:font-semibold data-[state=checked]:text-[#f6e2b8]" : `
        relative flex h-11 cursor-pointer select-none items-center rounded-[16px]
        px-4 pr-10 text-sm text-zinc-700 outline-none transition
        data-[highlighted]:bg-white/80 data-[highlighted]:text-zinc-900
        data-[state=checked]:bg-white/90 data-[state=checked]:font-semibold
        dark:text-zinc-200
        dark:data-[highlighted]:bg-white/10 dark:data-[highlighted]:text-white
        dark:data-[state=checked]:bg-white/12
      `}
    >
      <Select.ItemText>{children}</Select.ItemText>

      <span className="absolute right-3 flex h-4 w-4 items-center justify-center">
        <Select.ItemIndicator>
          <Check className="h-4 w-4" />
        </Select.ItemIndicator>
      </span>
    </Select.Item>
  );
}
