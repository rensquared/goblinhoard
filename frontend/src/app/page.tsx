"use client";

import React from "react";
import dynamic from "next/dynamic";

const GoblinCamp3D = dynamic(() => import("@/components/GoblinHoard3D"), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-[#070b10] flex flex-col items-center justify-center gap-3 text-amber-400 font-mono">
      <div className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
      <p className="text-xs tracking-wider">ENTERING THE GOBLIN CAMP...</p>
    </div>
  )
});

export default function GoblinCampPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#070b10]">
      <GoblinCamp3D />
    </main>
  );
}
