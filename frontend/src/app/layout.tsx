import type { Metadata } from "next";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hoarded.fun"),
  title: "The Goblin Hoard — Autonomous Raiding Swarm on Solana",
  description: "Launched on pump.fun. Enter the 3D Goblin Settlement, track 300 autonomous goblin raiders on Solana, and watch creator fees feed the Hoard until Raydium migration.",
  openGraph: {
    title: "The Goblin Hoard ($HOARD) — Solana",
    description: "Interactive 3D Goblin Settlement & Autonomous Raiding Swarm. Launched on pump.fun.",
    url: "https://www.hoarded.fun",
    siteName: "The Goblin Hoard",
    type: "website",
    images: [
      {
        url: "/goblin-logo.png",
        width: 512,
        height: 512,
        alt: "The Goblin Hoard Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Goblin Hoard ($HOARD) — Solana",
    description: "Interactive 3D Goblin Settlement & Autonomous Raiding Swarm. Launched on pump.fun.",
    images: ["/goblin-logo.png"],
    creator: "@hoardedfun",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
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
