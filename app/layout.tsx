import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import AppShell from "@/components/AppShell";
import {
  DEFAULT_DESCRIPTION,
  SITE_APPLE_ICON_URL,
  SITE_ICON_URL,
  SITE_NAME,
} from "@/lib/metadata";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: { url: SITE_ICON_URL, type: "image/png", sizes: "64x64" },
    shortcut: SITE_ICON_URL,
    apple: { url: SITE_APPLE_ICON_URL, type: "image/png", sizes: "180x180" },
  },
  openGraph: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "font-sans", geist.variable)}>
      <body className="custom-scrollbar w-full bg-[#00142b] text-zinc-900 antialiased dark:bg-[#00142b] dark:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
