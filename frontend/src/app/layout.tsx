import type { Metadata } from "next";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "Outlaw Capital — Every Trade is a Heist",
  description: "A cinematic JRPG-inspired DeFi launchpad and trading protocol. Enter Heist Mode, roll the dice, and challenge the Crown's treasury.",
  openGraph: {
    title: "Outlaw Capital — Every Trade is a Heist",
    description: "A cinematic JRPG-inspired DeFi launchpad and trading protocol. Enter Heist Mode, roll the dice, and challenge the Crown's treasury.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-void">
      <body className="h-full font-sans antialiased text-foreground">
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
