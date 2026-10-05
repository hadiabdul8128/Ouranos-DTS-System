import type { Metadata } from "next";
import "./globals.css";
import { PlatformProvider } from "@/components/platform/provider";
import { DotPattern } from "@/components/ui/dot-pattern";

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
      <head>
        {/* Fraunces with its softness axis at full: a soft, Cooper Black style serif for the whole app. */}
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&display=swap"/>
      </head>
      <body className="antialiased">
        <div className="ambient-dots" aria-hidden="true"><DotPattern width={24} height={24} cr={0.8} glow={false} /></div>
        <div className="app-surface"><PlatformProvider>{children}</PlatformProvider></div>
      </body>
    </html>
  );
}
