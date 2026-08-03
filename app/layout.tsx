import type { Metadata } from "next";
import EnvBanner from "@/components/ui/EnvBanner";
import "./globals.css";
import "@/styles/grensrock.css";

export const metadata: Metadata = {
  title: "Grensrock — Sponsorbeheer",
  description: "Sponsor management for Grensrock",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full">
      <body className="min-h-full flex flex-col">
        <EnvBanner />
        {children}
      </body>
    </html>
  );
}
