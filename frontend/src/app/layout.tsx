import type { Metadata } from "next";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "The Goblin Hoard — Autonomous Pillaging Swarm on Robinhood Chain",
  description: "Launched on ponsfamily.com. Enter the 3D Goblin Cavern, track 300 autonomous goblin raiders plundering Robinhood Chain pools, and watch loot sacrificed in the Lava Crucible.",
  openGraph: {
    title: "The Goblin Hoard ($HOARD) — Robinhood Chain",
    description: "Interactive 3D Goblin Cavern & Autonomous Raiding Swarm. Launched on ponsfamily.com.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#06080b]">
      <body className="h-full font-sans antialiased text-[#F3F4F6] selection:bg-[#F59E0B] selection:text-black">
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
