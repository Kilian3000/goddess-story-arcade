import type { Metadata } from "next";
import { arcadeConfig } from "./arcade-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(arcadeConfig.siteUrl),
  title: arcadeConfig.siteTitle,
  description: "Öffne virtuelle Goddess Story Booster mit physischer Pull-Reihenfolge, animierten Rarity-Hits und dem Waifu-21-Bonusspiel.",
  openGraph: {
    title: arcadeConfig.siteTitle,
    description: "47 Goddess Story Sets, physisch nachempfundene Pulls und Waifu 21 für zufällige Boosterpreise.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: arcadeConfig.siteTitle,
    description: "Öffne Goddess Story Booster und gewinne zufällige Packs in Waifu 21.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
