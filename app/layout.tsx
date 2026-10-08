import type { Metadata } from "next";
import "./globals.css";
import { PlatformProvider } from "@/components/platform/provider";
import MovingGrid from "@/components/ui/hyper-grid";

export const metadata: Metadata = {
  title: "Ouranos | Your operational workspace",
  description: "One place for the work you need to do.",
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
    <html lang="en" className="dark">
      <body className="antialiased">
        <MovingGrid />
        <div className="app-surface"><PlatformProvider>{children}</PlatformProvider></div>
      </body>
    </html>
  );
}
