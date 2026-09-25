import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ouranos | Your operational workspace",
  description: "Your work, connected. Explore the Ouranos travel and DTS workspace.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
