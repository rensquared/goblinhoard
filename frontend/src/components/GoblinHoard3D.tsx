"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { GoblinPopulationSystem, CampObstacle, GoblinAgent } from "./GoblinPopulation";
import { GoblinEntity } from "./GoblinEntity";
import {
  Compass,
  Navigation,
  Crosshair,
  Dices,
  Flame,
  Crown,
  Shield,
  Map as MapIcon,
  Skull,
  Mountain,
  Gem,
  Users,
  Eye,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Maximize,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Coins,
  Swords,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  X as CloseIcon,
  Radio,
  User as UserIcon,
  Zap,
  TrendingUp
} from "lucide-react";

// Height map formula for camp terrain with dedicated foundation plateaus for outer dungeons
export const getTerrainHeight = (x: number, z: number): number => {
  const dist = Math.sqrt(x * x + z * z);
  const mound = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.35;

  // Outer Dungeon Plateau Carving & Foundation Shaping
  const cryptDist = Math.hypot(x - 14.5, z - 12.0);
  const cryptPlateau = Math.exp(-(cryptDist * cryptDist) / 38);

  const chasmDist = Math.hypot(x - (-15.0), z - (-14.0));
  const chasmCaldera = Math.exp(-(chasmDist * chasmDist) / 32);

  const voidDist = Math.hypot(x - (-17.5), z - 3.5);
  const voidPlateau = Math.exp(-(voidDist * voidDist) / 34);

  // Outer rim rises smoothly except where leveled out by dungeon clearings
  const rimFactor = Math.max(0, 1.0 - cryptPlateau * 0.88 - chasmCaldera * 0.75 - voidPlateau * 0.88);
  const rimMound = dist > 18 ? Math.pow((dist - 18) * 0.22, 1.35) * rimFactor : 0;

  // Natural localized terrace elevations
  const chieftainHill = Math.exp(-((x * x + (z + 11) * (z + 11)) / 45)) * 0.85;
  const cryptMound = cryptPlateau * 0.38; // Ancient stone bedrock shelf
  const chasmRim = Math.exp(-Math.pow(chasmDist - 3.4, 2) / 7) * 0.52 - chasmCaldera * 0.35; // Volcanic crater lip with sunken center
  const voidMound = voidPlateau * 0.32; // Level quarry excavation terrace

  return mound + rimMound + chieftainHill + cryptMound + chasmRim + voidMound;
};

// Camp & Dungeon collision obstacles
export const CAMP_OBSTACLES: CampObstacle[] = [
  { center: new THREE.Vector2(0, 0), radius: 2.2 },        // Campfire & seating logs
  { center: new THREE.Vector2(0, -11.5), radius: 5.6 },     // Chieftain fortress compound
  { center: new THREE.Vector2(3.4, -6.8), radius: 1.7 },    // Goblin Hoard / Treasury
  { center: new THREE.Vector2(-12.4, 4.0), radius: 2.3 },   // Goblin Mine
  { center: new THREE.Vector2(14.5, 12.0), radius: 3.2 },   // Crypt of the Memes
  { center: new THREE.Vector2(-15.0, -14.0), radius: 3.4 }, // Dragon's Chasm
  { center: new THREE.Vector2(-17.5, 3.5), radius: 3.0 },   // Void Mine
];

export interface DungeonDefinition {
  id: string;
  name: string;
  subtitle: string;
  position: THREE.Vector3;
  color: number;
  unlockedTier: number;
  tickers: string[];
}

export const DUNGEONS: DungeonDefinition[] = [
  {
    id: "crypt",
    name: "Crypt of the Memes",
    subtitle: "PonsFamily live launchpad pairs",
    position: new THREE.Vector3(14.5, 0, 12.0),
    color: 0x9333ea, // Purple
    unlockedTier: 1,
    tickers: ["$FLOPPYCAT", "$MOCHI", "$ZAZIE", "$HASHLINGS", "$PONS"]
  },
  {
    id: "chasm",
    name: "Dragon's Chasm",
    subtitle: "PonsFamily breakout volume trenches",
    position: new THREE.Vector3(-15.0, 0, -14.0),
    color: 0xef4444, // Crimson red
    unlockedTier: 2,
    tickers: ["$GRIFFAIN", "$UNSEEN", "$GAMMA", "$ITNRY"]
  },
  {
    id: "voidmine",
    name: "Void Mine",
    subtitle: "Stealth PonsFamily bonding curve launches",
    position: new THREE.Vector3(-17.5, 0, 3.5),
    color: 0x06b6d4, // Cyan
    unlockedTier: 3,
    tickers: ["$DEXINFOX", "$CHAD", "$ROBIN", "$WOJAK"]
  }
];

interface EventBubble {
  id: string;
  text: string;
  type: "raid" | "burn" | "buy" | "brain" | "ascend";
}

export interface HoveredGoblinInfo {
  id: string;
  displayName: string;
  role: string;
  status: string;
  activity: string;
  balance: number;
  lootEth: number;
  raids: number;
  screenX: number;
  screenY: number;
}

interface FeedItem {
  id: string;
  type: "all" | "goblins" | "raids" | "burns" | "traders";
  title: string;
  subtitle?: string;
  amount?: string;
  isPositive?: boolean;
  time: string;
}

const INITIAL_FEED_ITEMS: FeedItem[] = [
  {
    id: "f-1",
    type: "goblins",
    title: "Campfire ignited · Awaiting token launch",
    subtitle: "Solitary hearth prepared on Robinhood Chain",
    time: "Genesis"
  },
  {
    id: "f-2",
    type: "goblins",
    title: "High Chieftain Grimjaw stands vigil",
    subtitle: "Vigilant guardian of the $HOARD treasury",
    time: "Genesis"
  },
  {
    id: "f-3",
    type: "traders",
    title: "Summoning threshold: 0.003 ETH of creator fees",
    subtitle: "Every fee spawns a goblin. Every goblin buys.",
    time: "Rule"
  },
  {
    id: "f-4",
    type: "raids",
    title: "Until migration every goblin only buys $HOARD",
    subtitle: "Autonomous on-chain raiders ready to accumulate",
    time: "Rule"
  }
];

export default function GoblinCamp3D({ onLoaded }: { onLoaded?: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Swarmed UI States
  const [activeFeedTab, setActiveFeedTab] = useState<"all" | "goblins" | "raids" | "burns" | "traders">("all");
  const [activeRightTab, setActiveRightTab] = useState<"chieftain" | "hivemind" | "dungeons">("chieftain");
  const [navMode, setNavMode] = useState<"orbit" | "fly" | "follow">("orbit");
  const navModeRef = useRef<"orbit" | "fly" | "follow">("orbit");
  const [feedItems, setFeedItems] = useState<FeedItem[]>(INITIAL_FEED_ITEMS);
  const [showRoster, setShowRoster] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<"none" | "feed" | "settlement">("none");
  const [copiedCA, setCopiedCA] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isDayMode, setIsDayMode] = useState(false);

  // Economics & World Ascension Metrics (Initial launch on ponsfamily at ~$4.7K)
  const [marketCap, setMarketCap] = useState(4700.0);
  const [volume24h, setVolume24h] = useState(1200.0);
  const [goblinCount, setGoblinCount] = useState(0);
  const [goblinBuysEth, setGoblinBuysEth] = useState(0.0);
  const [burnedHoard, setBurnedHoard] = useState(0);
  const [creatorFees, setCreatorFees] = useState(0.0);

  // 0.003 ETH per goblin as explicitly requested (ETH @ $2,761)
  const FEE_PER_GOBLIN = 0.003;

  // Hive-Mind Metrics ("The Chieftain has given the goblins a brain")
  const [hiveGen, setHiveGen] = useState(3);
  const [raidsLearned, setRaidsLearned] = useState(240);
  const [hiveWinRate, setHiveWinRate] = useState(68.4);
  const [hiveAvgPnl, setHiveAvgPnl] = useState(18.2);

  // Simulator controls
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(1);

  // Floating notification bubbles (managed via CSS keyframe animations, ZERO per-frame setState)
  const [eventBubbles, setEventBubbles] = useState<EventBubble[]>([]);

  // Direct DOM Refs for 3D Projected Badges (ZERO React Re-renders on Animation Loop)
  const chieftainTagRef = useRef<HTMLDivElement | null>(null);
  const pyreTagRef = useRef<HTMLDivElement | null>(null);
  const dungeonTagRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});

  // Goblin Entity Selection & Hovering
  const [selectedGoblin, setSelectedGoblin] = useState<GoblinEntity | null>(null);
  const selectedGoblinRef = useRef<GoblinEntity | null>(null);
  const [hoveredGoblin, setHoveredGoblin] = useState<HoveredGoblinInfo | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const campfireLightRef = useRef<THREE.PointLight | null>(null);
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const flameMeshRef = useRef<THREE.Mesh | null>(null);
  const chieftainMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const populationSystemRef = useRef<GoblinPopulationSystem | null>(null);

  // Modular World Tier Groups (Dynamic Ascension)
  const tier1WarbandGroupRef = useRef<THREE.Group | null>(null);
  const tier2MineGroupRef = useRef<THREE.Group | null>(null);
  const tier3StrongholdGroupRef = useRef<THREE.Group | null>(null);
  const dungeonGroupsRef = useRef<{ [id: string]: THREE.Group }>({});
  const currentTierRef = useRef<number>(0);
  const hoardLightRef = useRef<THREE.PointLight | null>(null);
  const hoardGlintsRef = useRef<THREE.Points | null>(null);
  const goldMoundMeshRef = useRef<THREE.Mesh | null>(null);
  const hoardScaleTargetRef = useRef<number>(1.0);
  const pyreFlareTimerRef = useRef<number>(0);

  // Interactive 3D World Landmarks Raycasting & Cinematic Fly-in References
  const landmarksRef = useRef<THREE.Object3D[]>([]);
  const isIntroFlyInRef = useRef(true);
  const introProgressRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

  // Audio System
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Camera Orbit / Navigation (Starts high in sky for 2.4s cinematic fly-in arc)
  const sphericalRef = useRef({ radius: 42.0, theta: 0.15, phi: 0.38 });
  const lookTargetRef = useRef(new THREE.Vector3(0, 0.8, -0.4));
  const isDraggingRef = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Migration Milestone Configuration (Bonding curve graduation on ponsfamily at $40.0K Market Cap)
  const MIGRATION_TARGET = 40000;
  const [isForceMigrated, setIsForceMigrated] = useState<boolean | null>(null);

  // Determine Current World Tier based on Market Cap (Initial launch on ponsfamily at ~$4.7K)
  const currentTier =
    marketCap < 12000 ? 0 :
    marketCap < 25000 ? 1 :
    marketCap < 40000 ? 2 : 3;

  currentTierRef.current = currentTier;

  // Active migration state: toggled manually or automatically achieved at $40K Market Cap
  const isMigrated = isForceMigrated !== null ? isForceMigrated : marketCap >= MIGRATION_TARGET;
  const migrationProgressPct = Math.min(
    100,
    Math.max(0, ((marketCap - 4700) / (MIGRATION_TARGET - 4700)) * 100)
  );

  const ASCENSION_MILESTONES = [
    { tier: 0, label: "T0", name: "Genesis", mcap: 4700, display: "$4.7K" },
    { tier: 1, label: "T1", name: "Warband", mcap: 12000, display: "$12K" },
    { tier: 2, label: "T2", name: "Dragon's Chasm", mcap: 25000, display: "$25K" },
    { tier: 3, label: "T3", name: "Citadel Migration", mcap: 40000, display: "$40K" },
    { tier: 4, label: "Ascend", name: "Final Ascension", mcap: 100000, display: "$100K" }
  ];

  const nextMilestone =
    marketCap < 12000 ? ASCENSION_MILESTONES[1] :
    marketCap < 25000 ? ASCENSION_MILESTONES[2] :
    marketCap < 40000 ? ASCENSION_MILESTONES[3] :
    ASCENSION_MILESTONES[4];

  const prevMilestoneMcap =
    marketCap < 12000 ? 4700 :
    marketCap < 25000 ? 12000 :
    marketCap < 40000 ? 25000 : 40000;

  const currentMilestoneProgress = Math.min(
    100,
    Math.max(0, ((marketCap - prevMilestoneMcap) / (nextMilestone.mcap - prevMilestoneMcap)) * 100)
  );

  const tierNames = [
    "Campfire Vigil (Genesis · $4.7K)",
    "Warband & Outpost Unlocked ($12K)",
    "Stronghold & Dragon's Chasm ($25K)",
    "Citadel & DEX Migration ($40K)"
  ];

  const tierNextTarget =
    currentTier === 0 ? 12000 :
    currentTier === 1 ? 25000 :
    currentTier === 2 ? 40000 : 100000;

  const tierBaseTarget =
    currentTier === 0 ? 4700 :
    currentTier === 1 ? 12000 :
    currentTier === 2 ? 25000 : 40000;

  const tierProgressPct = Math.min(100, Math.max(0, ((marketCap - tierBaseTarget) / (tierNextTarget - tierBaseTarget)) * 100));

  const tierDescriptions = [
    "At $12.0K Market Cap, the Chieftain Keep is fortified, the Warband gathers, and Crypt of the Memes unseals.",
    "At $25.0K Market Cap, the Castle expands, Goblin Mine opens, and Dragon's Chasm awakens for multi-token raids.",
    "At $40.0K Market Cap, Bonding Curve graduates, Citadel unlocks, and the Warband migrates to DEX.",
    "Ascended Realm ($100K+ MC) · Golden monument and eternal $HOARD supremacy."
  ];

  // Synchronous Tier Group Visibility Updater
  const updateTierVisuals = useCallback((tier: number) => {
    currentTierRef.current = tier;
    if (tier1WarbandGroupRef.current) {
      tier1WarbandGroupRef.current.visible = tier >= 1;
    }
    if (tier2MineGroupRef.current) {
      tier2MineGroupRef.current.visible = tier >= 2;
    }
    if (tier3StrongholdGroupRef.current) {
      tier3StrongholdGroupRef.current.visible = tier >= 3;
    }

    DUNGEONS.forEach((d) => {
      const g = dungeonGroupsRef.current[d.id];
      if (g) {
        g.visible = tier >= d.unlockedTier;
      }
    });
  }, []);

  // Update tier visuals whenever currentTier state changes
  useEffect(() => {
    updateTierVisuals(currentTier);
  }, [currentTier, updateTierVisuals]);

  // Sync navMode to ref to avoid restarting Three.js scene
  useEffect(() => {
    navModeRef.current = navMode;
  }, [navMode]);

  // Push Floating Notification Bubble (Uses CSS keyframe animation)
  const addFloatingBubble = useCallback((text: string, type: EventBubble["type"]) => {
    const newBubble: EventBubble = {
      id: `b-${Date.now()}-${Math.random()}`,
      text,
      type
    };
    setEventBubbles((prev) => [...prev.slice(-3), newBubble]);

    // Auto-dismiss after 2.6s
    setTimeout(() => {
      setEventBubbles((prev) => prev.filter((b) => b.id !== newBubble.id));
    }, 2600);
  }, []);

  // Procedural Sound FX Synthesizers
  const playHornSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(146.8, now); // D3
      osc1.frequency.exponentialRampToValueAtTime(164.8, now + 0.35); // E3

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(220.0, now); // A3
      osc2.frequency.exponentialRampToValueAtTime(246.9, now + 0.35);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.85);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.88);
      osc2.stop(now + 0.88);
    } catch {}
  }, []);

  const playCoinSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      [0, 0.045].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const freq = idx === 0 ? 1975 + Math.random() * 80 : 2637 + Math.random() * 90;
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.24);
      });
    } catch {}
  }, []);

  const playBurnSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.7);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.7);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.72);
    } catch {}
  }, []);

  // Visual Pyre Burn Flare
  const triggerPyreBurnEffect = useCallback((amount: number) => {
    setBurnedHoard((p) => p + amount);
    pyreFlareTimerRef.current = 1.6;
    playBurnSound();

    addFloatingBubble(`🔥 ${amount.toLocaleString()} $HOARD Burned at Pyre!`, "burn");

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setFeedItems((prev) => [
      {
        id: `burn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "burns",
        title: `Burn Pyre consumed ${amount.toLocaleString()} $HOARD`,
        subtitle: `Sacrificed to the hearth flame (-0.003 ETH)`,
        amount: `-${amount.toLocaleString()}`,
        isPositive: false,
        time: timeStr
      },
      ...prev.slice(0, 20)
    ]);
  }, [addFloatingBubble, playBurnSound]);

  // Dispatch a high-speed Goblin Raid to a target Dungeon
  const triggerRaid = useCallback((dungeonId?: string) => {
    const unlockedDungeons = DUNGEONS.filter((d) => currentTierRef.current >= d.unlockedTier);
    if (unlockedDungeons.length === 0) {
      addFloatingBubble(`⚔️ Scouts report perimeter quiet · Warband tier required`, "raid");
      return;
    }

    const chosenDungeon = dungeonId
      ? DUNGEONS.find((d) => d.id === dungeonId) || unlockedDungeons[0]
      : unlockedDungeons[Math.floor(Math.random() * unlockedDungeons.length)];

    const chosenTicker = chosenDungeon.tickers[Math.floor(Math.random() * chosenDungeon.tickers.length)];
    const lootEth = Number((0.0001 + Math.random() * 0.0004).toFixed(5));

    const raider = populationSystemRef.current?.dispatchRaid(
      chosenDungeon.position,
      chosenTicker,
      lootEth,
      // Plunder event
      (_agent, ticker, loot) => {
        addFloatingBubble(`⚔️ +${loot} ETH pillaged from ${ticker}!`, "raid");
      },
      // Return & deposit event at Treasury Hoard
      (agent, _ticker, loot) => {
        setGoblinBuysEth((p) => Number((p + loot).toFixed(4)));
        setVolume24h((p) => p + loot * 2800);
        setMarketCap((p) => p + loot * 1400);
        setRaidsLearned((p) => p + 1);

        // Sound & visual deposit feedback at Treasury Hoard
        playCoinSound();
        if (hoardLightRef.current) {
          hoardLightRef.current.intensity = 5.2;
        }
        hoardScaleTargetRef.current = Math.min(2.4, hoardScaleTargetRef.current + 0.035);

        // Burn 5% at pyre
        const hoardBurnAmount = Math.floor(loot * 85000);
        triggerPyreBurnEffect(hoardBurnAmount);

        // Hive-Mind learning
        if (Math.random() > 0.6) {
          addFloatingBubble(`🧠 ${agent.entity.displayName} evolved Take-Profit DNA!`, "brain");
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setFeedItems((prev) => [
          {
            id: `raid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: "raids",
            title: `Raid victory at ${chosenDungeon.name}!`,
            subtitle: `${agent.entity.displayName} returned with ${loot} ETH loot`,
            amount: `+${loot} ETH`,
            isPositive: true,
            time: timeStr
          },
          ...prev.slice(0, 20)
        ]);
      }
    );

    if (raider) {
      playHornSound();
      addFloatingBubble(`⚔️ ${raider.entity.displayName} dispatched to ${chosenDungeon.name}!`, "raid");
    }
  }, [addFloatingBubble, triggerPyreBurnEffect, playHornSound, playCoinSound]);

  // Simulate on-chain buy order
  const triggerBuyOrder = useCallback((ethAmount: number = 0.05) => {
    const newBuys = Number((goblinBuysEth + ethAmount).toFixed(3));
    setGoblinBuysEth(newBuys);
    const addedVol = ethAmount * 3000;
    setVolume24h((p) => p + addedVol);
    setMarketCap((p) => Number((p + addedVol * 0.85).toFixed(2)));

    // Audio & hoard expansion
    playCoinSound();
    hoardScaleTargetRef.current = Math.min(2.4, hoardScaleTargetRef.current + 0.02);

    // Accrue creator fee (1.5% fee on volume)
    const feeAccrued = ethAmount * 0.025;
    const newTotalFees = Number((creatorFees + feeAccrued).toFixed(4));
    setCreatorFees(newTotalFees);

    // Check if creator fees recruited next goblin (at 0.003 ETH per goblin)
    if (newTotalFees >= (goblinCount + 1) * FEE_PER_GOBLIN) {
      const newGoblin = populationSystemRef.current?.spawnOne();
      if (newGoblin) {
        setGoblinCount((p) => p + 1);
        addFloatingBubble(`👺 ${newGoblin.displayName} recruited to the Hoard!`, "buy");
      }
    }

    addFloatingBubble(`💰 Buy +${ethAmount} ETH ($HOARD)`, "buy");

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setFeedItems((prev) => [
      {
        id: `buy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "traders",
        title: `Trader bought $HOARD on Robinhood Chain`,
        subtitle: `Autonomous router executed swap`,
        amount: `+${ethAmount} ETH`,
        isPositive: true,
        time: timeStr
      },
      ...prev.slice(0, 20)
    ]);
  }, [goblinBuysEth, creatorFees, goblinCount, FEE_PER_GOBLIN, addFloatingBubble]);

  // Milestone Quick Jumps with Immediate Synchronous World Ascension
  const jumpToMilestone = useCallback((targetMc: number) => {
    setMarketCap(targetMc);
    setVolume24h(targetMc * 1.8);
    setIsForceMigrated(null);

    const newTier =
      targetMc < 15000 ? 0 :
      targetMc < 35000 ? 1 :
      targetMc < 70000 ? 2 : 3;

    // Instantly update 3D group visibilities
    updateTierVisuals(newTier);

    const neededGoblins =
      targetMc <= 4700 ? 3 :
      targetMc < 15000 ? 8 :
      targetMc < 35000 ? 18 :
      targetMc < 70000 ? 32 : 55;

    populationSystemRef.current?.setPopulation(neededGoblins);
    setGoblinCount(neededGoblins);
    setCreatorFees(Number((neededGoblins * FEE_PER_GOBLIN).toFixed(4)));
    setGoblinBuysEth(Number((neededGoblins * 0.08).toFixed(3)));
    setBurnedHoard(Math.floor(targetMc * 420));
    addFloatingBubble(`🏰 World Jump: $${(targetMc / 1000).toFixed(0)}k Market Cap!`, "ascend");
  }, [updateTierVisuals, FEE_PER_GOBLIN, addFloatingBubble]);

  // Auto-Simulation Tick (Runs when isSimulating is true)
  useEffect(() => {
    if (!isSimulating) return;

    const intervalMs = Math.floor(2800 / simSpeed);
    const timer = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.45) {
        const buyAmount = Number((0.02 + Math.random() * 0.08).toFixed(3));
        triggerBuyOrder(buyAmount);
      } else if (roll < 0.85) {
        triggerRaid();
      } else {
        const burnAmt = Math.floor(1000 + Math.random() * 15000);
        triggerPyreBurnEffect(burnAmt);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulating, simSpeed, triggerBuyOrder, triggerRaid, triggerPyreBurnEffect]);

  // Camera presets
  const applyPreset = useCallback((preset: "camp" | "chieftain" | "fortress" | "overview" | "crypt" | "chasm" | "voidmine") => {
    if (preset === "camp") {
      sphericalRef.current = { radius: 10.0, theta: 0.35, phi: 1.25 };
      lookTargetRef.current.set(0, 0.9, -0.4);
    } else if (preset === "chieftain") {
      sphericalRef.current = { radius: 7.0, theta: 3.14, phi: 1.22 };
      lookTargetRef.current.set(0, 1.4, -2.2);
    } else if (preset === "fortress") {
      sphericalRef.current = { radius: 15.0, theta: 0.0, phi: 1.28 };
      lookTargetRef.current.set(0, 2.0, -11.5);
    } else if (preset === "overview") {
      sphericalRef.current = { radius: 26.0, theta: 0.55, phi: 0.95 };
      lookTargetRef.current.set(0, 0.5, -1.0);
    } else if (preset === "crypt") {
      sphericalRef.current = { radius: 10.5, theta: 0.95, phi: 1.24 };
      lookTargetRef.current.set(14.5, getTerrainHeight(14.5, 12.0) + 1.2, 12.0);
    } else if (preset === "chasm") {
      sphericalRef.current = { radius: 11.5, theta: -1.35, phi: 1.22 };
      lookTargetRef.current.set(-15.0, getTerrainHeight(-15.0, -14.0) + 1.1, -14.0);
    } else if (preset === "voidmine") {
      sphericalRef.current = { radius: 11.0, theta: -2.45, phi: 1.22 };
      lookTargetRef.current.set(-17.5, getTerrainHeight(-17.5, 3.5) + 1.2, 3.5);
    }
  }, []);

  const focusOnGoblin = useCallback((entity: GoblinEntity) => {
    setSelectedGoblin(entity);
    selectedGoblinRef.current = entity;
    setNavMode("follow");
    navModeRef.current = "follow";
    const agent = populationSystemRef.current?.getAgentByEntityId(entity.id);
    if (agent) {
      lookTargetRef.current.set(agent.mesh.position.x, agent.mesh.position.y + 0.65, agent.mesh.position.z);
      sphericalRef.current.radius = 5.2;
      sphericalRef.current.phi = 1.22;
    }
  }, []);

  const followRandomGoblin = useCallback(() => {
    const pop = populationSystemRef.current;
    if (!pop || pop.goblins.length === 0) {
      addFloatingBubble(`Scouts report perimeter quiet · No goblins in camp`, "raid");
      return;
    }
    // Prioritize an active raider sprinting to or returning from a dungeon
    const raider = pop.goblins.find((g) => g.isRaiding);
    let target = raider;
    if (!target) {
      const candidates = pop.goblins.filter((g) => g.entity.id !== selectedGoblinRef.current?.id);
      target = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : pop.goblins[0];
    }
    if (target) {
      setSelectedGoblin({ ...target.entity });
      selectedGoblinRef.current = { ...target.entity };
      setNavMode("follow");
      navModeRef.current = "follow";
      const icon = target.isRaiding ? "⚔️" : "👺";
      addFloatingBubble(`${icon} Tracking ${target.entity.displayName} [Press R to cycle]`, "brain");
    }
  }, [addFloatingBubble]);

  const handlePrevGoblin = useCallback(() => {
    const allEntities = populationSystemRef.current?.getAllEntities() || [];
    if (allEntities.length === 0) return;
    const currentIdx = selectedGoblin ? allEntities.findIndex((g) => g.id === selectedGoblin.id) : 0;
    const prevIdx = (currentIdx - 1 + allEntities.length) % allEntities.length;
    const prevGoblin = allEntities[prevIdx];
    setSelectedGoblin({ ...prevGoblin });
    selectedGoblinRef.current = { ...prevGoblin };
    if (navModeRef.current === "follow") {
      focusOnGoblin(prevGoblin);
    }
  }, [selectedGoblin, focusOnGoblin]);

  const handleNextGoblin = useCallback(() => {
    const allEntities = populationSystemRef.current?.getAllEntities() || [];
    if (allEntities.length === 0) return;
    const currentIdx = selectedGoblin ? allEntities.findIndex((g) => g.id === selectedGoblin.id) : 0;
    const nextIdx = (currentIdx + 1) % allEntities.length;
    const nextGoblin = allEntities[nextIdx];
    setSelectedGoblin({ ...nextGoblin });
    selectedGoblinRef.current = { ...nextGoblin };
    if (navModeRef.current === "follow") {
      focusOnGoblin(nextGoblin);
    }
  }, [selectedGoblin, focusOnGoblin]);

  const toggleFollowSelected = useCallback(() => {
    if (!selectedGoblin) return;
    if (navMode === "follow" && selectedGoblinRef.current?.id === selectedGoblin.id) {
      setNavMode("orbit");
      navModeRef.current = "orbit";
    } else {
      focusOnGoblin(selectedGoblin);
    }
  }, [selectedGoblin, navMode, focusOnGoblin]);

  const handleCopyCA = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("0x4663...HOARD");
      setCopiedCA(true);
      setTimeout(() => setCopiedCA(false), 2000);
    }
  }, []);

  const handleCopyWallet = useCallback((addr: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(addr);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  }, []);

  // Ambient Audio Synthesizer
  const toggleAudio = useCallback(() => {
    if (!audioEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.28, ctx.currentTime);
        masterGain.connect(ctx.destination);

        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(260, ctx.currentTime);
        filter.Q.setValueAtTime(3.0, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.04, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(windGain);
        windGain.connect(masterGain);
        whiteNoise.start();

        const crackleTimer = setInterval(() => {
          if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
            clearInterval(crackleTimer);
            return;
          }
          if (Math.random() > 0.45) {
            const crackle = ctx.createBufferSource();
            const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 0.035, ctx.sampleRate);
            const data = crackleBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25));
            }
            crackle.buffer = crackleBuf;
            const cGain = ctx.createGain();
            cGain.gain.setValueAtTime(0.07 + Math.random() * 0.1, ctx.currentTime);
            crackle.connect(cGain);
            cGain.connect(masterGain);
            crackle.start();
          }
        }, 130);

        // Distant gentle night crickets in forest periphery
        const cricketTimer = setInterval(() => {
          if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
            clearInterval(cricketTimer);
            return;
          }
          if (Math.random() > 0.52) {
            const now = ctx.currentTime;
            [0, 0.05, 0.1].forEach((delay) => {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(4600 + Math.random() * 250, now + delay);
              g.gain.setValueAtTime(0.0001, now + delay);
              g.gain.linearRampToValueAtTime(0.012, now + delay + 0.012);
              g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.038);
              osc.connect(g);
              g.connect(masterGain);
              osc.start(now + delay);
              osc.stop(now + delay + 0.04);
            });
          }
        }, 850);

        setAudioEnabled(true);
      } catch (err) {
        console.error("Audio error:", err);
      }
    } else {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      setAudioEnabled(false);
    }
  }, [audioEnabled]);

  // Main Three.js Scene Setup (RUNS ONCE ON MOUNT, NEVER TEARS DOWN)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, High-Performance WebGL Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.background = new THREE.Color(0x070b10);
    scene.fog = new THREE.FogExp2(0x070b10, 0.024);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 200);
    cameraRef.current = camera;
    camera.position.set(8, 7, 10);
    camera.lookAt(lookTargetRef.current);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 2. Atmospheric Night Lighting
    const ambientLight = new THREE.AmbientLight(0x152232, 1.1);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Moon directional light for crisp shadows
    const moonLight = new THREE.DirectionalLight(0x4a7c9f, 1.25);
    moonLight.position.set(-16, 28, -16);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 5;
    moonLight.shadow.camera.far = 70;
    moonLight.shadow.camera.left = -20;
    moonLight.shadow.camera.right = 20;
    moonLight.shadow.camera.top = 20;
    moonLight.shadow.camera.bottom = -20;
    moonLight.shadow.bias = -0.0006;
    scene.add(moonLight);
    moonLightRef.current = moonLight;

    // Central Pyre / Campfire Light
    const campfireLight = new THREE.PointLight(0xff6a14, 5.8, 32, 1.6);
    campfireLight.position.set(0, 1.0, 0);
    scene.add(campfireLight);
    campfireLightRef.current = campfireLight;

    const fireFill = new THREE.PointLight(0xffaa33, 2.8, 12, 1.8);
    fireFill.position.set(0, 0.4, 0);
    scene.add(fireFill);

    // 3. Ground Terrain with Natural Dirt Paths
    // Create rich earthen ground texture using an HTML5 Canvas matching the original aesthetic
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const toX = (wx: number) => Math.round(((wx + 40) / 80) * 2048);
      const toY = (wz: number) => Math.round(((wz + 40) / 80) * 2048);

      // Base: Deep dark loam and forest humus
      ctx.fillStyle = "#101612";
      ctx.fillRect(0, 0, 2048, 2048);

      // Layer 1: Multi-scale organic earth mottling (rich forest soil, moss patches, loam)
      for (let i = 0; i < 9000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const r = Math.random() * 45 + 15;
        const rand = Math.random();
        ctx.fillStyle =
          rand < 0.35 ? "rgba(16, 26, 18, 0.5)" :
          rand < 0.65 ? "rgba(10, 14, 11, 0.45)" :
          rand < 0.85 ? "rgba(24, 20, 15, 0.35)" :
          "rgba(8, 11, 9, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Enhanced Arterial Path Painter with 3 blend tiers (soft verge, packed loam, trodden gravel tread)
      const drawPath = (
        p0x: number, p0z: number,
        p1x: number, p1z: number,
        ctrlX: number, ctrlZ: number,
        width: number,
        pathColor = "#3d2c1c",
        treadColor = "#4f3b28"
      ) => {
        const fromX = toX(p0x);
        const fromY = toY(p0z);
        const toXPos = toX(p1x);
        const toYPos = toY(p1z);
        const cX = toX(ctrlX);
        const cY = toY(ctrlZ);

        // 1. Soft trampled grass verge
        ctx.strokeStyle = "rgba(42, 32, 22, 0.42)";
        ctx.lineWidth = width * 1.8;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.quadraticCurveTo(cX, cY, toXPos, toYPos);
        ctx.stroke();

        // 2. Packed dirt body
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.quadraticCurveTo(cX, cY, toXPos, toYPos);
        ctx.stroke();

        // 3. Central trodden gravel / tread groove
        ctx.strokeStyle = treadColor;
        ctx.lineWidth = width * 0.48;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.quadraticCurveTo(cX, cY, toXPos, toYPos);
        ctx.stroke();
      };

      // Contact Ambient Occlusion (AO) / Foundation Apron helper
      const drawFoundationApron = (
        wx: number, wz: number,
        radius: number,
        innerColor: string,
        outerColor = "rgba(10, 14, 11, 0)"
      ) => {
        const cx = toX(wx);
        const cy = toY(wz);
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(1, outerColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      // 1. Central Campfire Clearing
      drawFoundationApron(0, 0, 160, "rgba(52, 38, 25, 0.95)", "rgba(16, 22, 18, 0)");
      drawFoundationApron(0, 0, 70, "rgba(22, 16, 12, 0.9)", "rgba(42, 32, 22, 0)");

      // 2. High Chieftain Fortress Citadel Plaza (North)
      drawFoundationApron(0, -11.5, 240, "rgba(42, 32, 22, 0.9)", "rgba(14, 18, 14, 0)");
      drawFoundationApron(0, -11.5, 150, "rgba(28, 20, 15, 0.95)", "rgba(38, 28, 18, 0)");

      // 3. Treasury Hoard Apron (North-East)
      drawFoundationApron(3.4, -6.8, 95, "rgba(55, 42, 24, 0.85)", "rgba(18, 24, 18, 0)");

      // 4. West Goblin Mine & Quarry Apron
      drawFoundationApron(-12.4, 4.0, 130, "rgba(35, 30, 24, 0.9)", "rgba(14, 18, 14, 0)");

      // 5. OUTER DUNGEON CONTACT APRONS
      // Crypt of the Memes (South-East) - Weathered ancient flagstone platform & cursed purple soil
      drawFoundationApron(14.5, 12.0, 145, "rgba(38, 30, 48, 0.95)", "rgba(14, 18, 15, 0)");
      drawFoundationApron(14.5, 12.0, 80, "rgba(58, 42, 72, 0.85)", "rgba(32, 24, 40, 0)");

      // Dragon's Chasm (North-West) - Scorched obsidian caldera with glowing fiery magma veins
      drawFoundationApron(-15.0, -14.0, 155, "rgba(30, 14, 10, 0.98)", "rgba(12, 15, 12, 0)");
      drawFoundationApron(-15.0, -14.0, 85, "rgba(52, 18, 12, 0.9)", "rgba(28, 12, 8, 0)");

      // Void Mine (Far-West) - Excavated quarry shelf with cyan crystal dust
      drawFoundationApron(-17.5, 3.5, 145, "rgba(20, 36, 46, 0.92)", "rgba(13, 17, 14, 0)");
      drawFoundationApron(-17.5, 3.5, 75, "rgba(16, 52, 68, 0.85)", "rgba(18, 32, 42, 0)");

      // 6. MAIN HIGHWAY TRAILS
      // A. Path to Chieftain Fortress (North)
      drawPath(0, 0, 0, -11.5, 0.6, -5.5, 62, "#423020", "#543f2c");

      // B. Path to Goblin Hoard Treasury (North-East)
      drawPath(0, 0, 3.4, -6.8, 1.8, -3.2, 44, "#3d2c1c", "#503c28");

      // C. Path to West Goblin Mine & Tents (West)
      drawPath(0, 0, -12.4, 4.0, -6.2, 2.8, 48, "#3a2b1c", "#4c3826");

      // D. Path from Goblin Mine extending into VOID MINE (Far-West Quarry Highway)
      drawPath(-12.4, 4.0, -17.5, 3.5, -15.0, 3.9, 42, "#2b3438", "#384a52");

      // E. Arterial Trail to DRAGON'S CHASM (North-West Volcanic Highway)
      drawPath(0, -6.0, -15.0, -14.0, -7.5, -11.2, 46, "#361a12", "#4a2418");

      // F. Arterial Trail to CRYPT OF THE MEMES (South-East Ancient Catacomb Highway)
      drawPath(0, 0, 14.5, 12.0, 8.2, 6.8, 46, "#342b3b", "#463b4f");

      // G. Path to South Forest Gate
      drawPath(0, 0, 0.5, 24.0, -0.4, 12.0, 48, "#38291a", "#483624");

      // H. Secondary camp paths to living tents
      drawPath(0, 0, -9.8, 1.2, -4.5, 0.4, 34, "#38291c", "#4a3625");
      drawPath(0, 0, 7.2, 6.2, 3.8, 3.4, 32, "#38291c", "#4a3625");
      drawPath(0, 0, 6.8, -8.2, 4.2, -4.0, 32, "#38291c", "#4a3625");

      // 7. DUNGEON SPECIALIZED TERRAIN MOTIFS
      // Crypt of the Memes: Cracked ancient paving stones & purple soul specks
      for (let i = 0; i < 26; i++) {
        const stoneAngle = Math.random() * Math.PI * 2;
        const stoneDist = Math.random() * 4.2;
        const sx = toX(14.5 + Math.cos(stoneAngle) * stoneDist);
        const sy = toY(12.0 + Math.sin(stoneAngle) * stoneDist);
        ctx.fillStyle = "rgba(75, 68, 88, 0.75)";
        ctx.fillRect(sx - 4, sy - 3, Math.random() * 10 + 6, Math.random() * 8 + 5);
        ctx.strokeStyle = "rgba(22, 18, 28, 0.8)";
        ctx.strokeRect(sx - 4, sy - 3, Math.random() * 10 + 6, Math.random() * 8 + 5);
      }

      // Dragon's Chasm: Magma fissure cracks radiating from center
      for (let i = 0; i < 16; i++) {
        const crackAngle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const startR = 1.0 + Math.random() * 0.8;
        const endR = 3.6 + Math.random() * 1.5;
        const sx = toX(-15.0 + Math.cos(crackAngle) * startR);
        const sy = toY(-14.0 + Math.sin(crackAngle) * startR);
        const ex = toX(-15.0 + Math.cos(crackAngle) * endR);
        const ey = toY(-14.0 + Math.sin(crackAngle) * endR);
        ctx.strokeStyle = Math.random() > 0.4 ? "rgba(255, 68, 17, 0.42)" : "rgba(180, 40, 10, 0.58)";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Void Mine: Cyan crystal veins and heavy cart track ruts
      for (let i = 0; i < 22; i++) {
        const vAngle = Math.random() * Math.PI * 2;
        const vDist = Math.random() * 3.8;
        const vx = toX(-17.5 + Math.cos(vAngle) * vDist);
        const vy = toY(3.5 + Math.sin(vAngle) * vDist);
        ctx.fillStyle = "rgba(6, 182, 212, 0.58)";
        ctx.beginPath();
        ctx.arc(vx, vy, Math.random() * 3.5 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 8. Natural Scattered Pebbles, Fallen Leaves, and Loam Specks (4,000 particles)
      for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const rand = Math.random();
        ctx.fillStyle =
          rand < 0.4 ? "rgba(82, 68, 52, 0.65)" :
          rand < 0.7 ? "rgba(28, 38, 26, 0.55)" :
          rand < 0.9 ? "rgba(48, 36, 28, 0.7)" :
          "rgba(110, 92, 70, 0.5)";
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 3.5 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const groundTexture = new THREE.CanvasTexture(canvas);
    groundTexture.wrapS = THREE.ClampToEdgeWrapping;
    groundTexture.wrapT = THREE.ClampToEdgeWrapping;
    groundTexture.anisotropy = 16;

    const terrainGeo = new THREE.PlaneGeometry(80, 80, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: 0.88,
        metalness: 0.08,
        flatShading: true
      })
    );
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // 4. Pyre Embers Particle System
    const emberCount = 40;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberSpeed = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = (Math.random() - 0.5) * 0.9;
      emberPos[i * 3 + 1] = 0.2 + Math.random() * 2.2;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
      emberSpeed[i] = 0.015 + Math.random() * 0.022;
    }
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    const emberParticles = new THREE.Points(
      emberGeo,
      new THREE.PointsMaterial({ color: 0xffaa22, size: 0.08, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    scene.add(emberParticles);

    // 4B. Enchanted Night Fireflies Particle System (Gently drifting between perimeter pines and clearing outskirts)
    const fireflyCount = 48;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPos = new Float32Array(fireflyCount * 3);
    const fireflyBasePos = new Float32Array(fireflyCount * 3);
    const fireflySpeeds = new Float32Array(fireflyCount);
    const fireflyPhases = new Float32Array(fireflyCount);

    for (let i = 0; i < fireflyCount; i++) {
      const angle = (i / fireflyCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const dist = 4.8 + Math.random() * 11.5;
      const fx = Math.cos(angle) * dist;
      const fz = Math.sin(angle) * dist;
      const fy = getTerrainHeight(fx, fz) + 0.6 + Math.random() * 1.8;

      fireflyPos[i * 3] = fx;
      fireflyPos[i * 3 + 1] = fy;
      fireflyPos[i * 3 + 2] = fz;

      fireflyBasePos[i * 3] = fx;
      fireflyBasePos[i * 3 + 1] = fy;
      fireflyBasePos[i * 3 + 2] = fz;

      fireflySpeeds[i] = 0.45 + Math.random() * 0.6;
      fireflyPhases[i] = Math.random() * Math.PI * 2;
    }

    fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPos, 3));
    const fireflyMat = new THREE.PointsMaterial({
      color: 0xa3e635, // Luminous lime-yellow bio-luminescent glow
      size: 0.16,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const fireflyParticles = new THREE.Points(fireflyGeo, fireflyMat);
    scene.add(fireflyParticles);

    // Animated central flame cluster
    const flameGeo = new THREE.ConeGeometry(0.38, 1.25, 6);
    flameGeo.translate(0, 0.62, 0);
    const flameMesh = new THREE.Mesh(
      flameGeo,
      new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    scene.add(flameMesh);
    flameMeshRef.current = flameMesh;
    flameMesh.userData = { landmark: "pyre" };
    landmarksRef.current = [flameMesh];

    // 5. GLTF Loader
    const gltfLoader = new GLTFLoader();
    const loadModel = (url: string): Promise<THREE.Group> => {
      return new Promise((resolve) => {
        gltfLoader.load(
          url,
          (gltf) => {
            const group = gltf.scene;
            group.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
              }
            });
            resolve(group);
          },
          undefined,
          () => resolve(new THREE.Group())
        );
      });
    };

    const loadGLTF = (url: string): Promise<GLTF | null> => {
      return new Promise((resolve) => {
        gltfLoader.load(url, (gltf) => resolve(gltf), undefined, () => resolve(null));
      });
    };

    // Animated Rift & Dungeon Particle Registry
    const animatedDungeonRifts: {
      id: string;
      portal: THREE.Mesh;
      ring: THREE.Mesh;
      light: THREE.PointLight;
      particles: THREE.Points;
      particlePositions: Float32Array;
      particleSpeeds: Float32Array;
      particleCount: number;
    }[] = [];

    // 6. Build the World with Complete Dynamic Ascension Tiers
    const buildAscensionWorld = async () => {
      let loadedCount = 0;
      const totalToTrack = 10;
      const tick = () => {
        loadedCount++;
        setLoadProgress(Math.min(100, Math.round((loadedCount / totalToTrack) * 100)));
      };

      // TIER 0: Genesis Core (Campfire + High Chieftain) - Always visible
      const genesisGroup = new THREE.Group();
      genesisGroup.name = "GenesisGroup";
      scene.add(genesisGroup);

      // Load all curated models in a single parallel batch
      const [
        campfireStones, campfireLogs, campfirePit, logModel, logStackModel, crateModel, barrelModel,
        treeForest, treeCrooked, treeForestHigh, treeHighCrooked,
        swordModel, roundShieldModel, spearModel, rectShieldModel, pickaxeModel,
        hutBase, hutRoof, flagPirateModel, flagModel, pirateChestModel,
        chestModel, goldCoinModel, miniCoinModel, chaliceModel, jewelModel, platformPlanks,
        tentCanvas, tentSurvival, tentDetailedOpen, tentDetailedClosed, tentSmallOpen, tentSmallClosed,
        cartModel, watchTowerModel, fortifiedFenceModel, crystalModel, woodSupportModel, woodStructureModel,
        oreStoneModel, resourceWoodModel, trapSpikesModel, fireBasketModel,
        rockLargeA, rockLargeB, rockSmallA
      ] = await Promise.all([
        loadModel("/models/campfire_stones.glb"),
        loadModel("/models/campfire_logs.glb"),
        loadModel("/models/campfire_pit.glb"),
        loadModel("/models/log.glb"),
        loadModel("/models/log_stack.glb"),
        loadModel("/models/crate_ropes.glb"),
        loadModel("/models/barrel.glb"),
        loadModel("/models/tree_forest.glb"),
        loadModel("/models/tree_crooked.glb"),
        loadModel("/models/tree_forest_high.glb"),
        loadModel("/models/tree_high_crooked.glb"),
        loadModel("/models/weapon_sword.glb"),
        loadModel("/models/shield_round.glb"),
        loadModel("/models/weapon_spear.glb"),
        loadModel("/models/shield_rectangle.glb"),
        loadModel("/models/tool_pickaxe.glb"),
        loadModel("/models/chieftain_hut_base.glb"),
        loadModel("/models/chieftain_hut_roof.glb"),
        loadModel("/models/flag_pirate.glb"),
        loadModel("/models/flag.glb"),
        loadModel("/models/pirate_chest.glb"),
        loadModel("/models/chest.glb"),
        loadModel("/models/coin_gold.glb"),
        loadModel("/models/mini_coin.glb"),
        loadModel("/models/chalice.glb"),
        loadModel("/models/jewel.glb"),
        loadModel("/models/platform_planks.glb"),
        loadModel("/models/tent_canvas.glb"),
        loadModel("/models/tent_survival.glb"),
        loadModel("/models/tent_detailed_open.glb"),
        loadModel("/models/tent_detailed_closed.glb"),
        loadModel("/models/tent_small_open.glb"),
        loadModel("/models/tent_small_closed.glb"),
        loadModel("/models/cart.glb"),
        loadModel("/models/tower_watch.glb"),
        loadModel("/models/fence_fortified.glb"),
        loadModel("/models/crystal.glb"),
        loadModel("/models/wood_support.glb"),
        loadModel("/models/wood_structure.glb"),
        loadModel("/models/ore_stone.glb"),
        loadModel("/models/resource_wood.glb"),
        loadModel("/models/trap_spikes.glb"),
        loadModel("/models/fire_basket.glb"),
        loadModel("/models/rock_large_a.glb"),
        loadModel("/models/rock_large_b.glb"),
        loadModel("/models/rock_small_a.glb")
      ]);
      tick();

      // Central Campfire & Seating Logs
      campfireStones.position.set(0, 0.05, 0);
      campfireStones.scale.set(1.4, 1.4, 1.4);
      genesisGroup.add(campfireStones);

      campfireLogs.position.set(0, 0.12, 0);
      campfireLogs.scale.set(1.3, 1.3, 1.3);
      genesisGroup.add(campfireLogs);

      campfirePit.position.set(0, 0.06, 0);
      campfirePit.scale.set(1.3, 1.3, 1.3);
      genesisGroup.add(campfirePit);

      [campfireStones, campfireLogs, campfirePit].forEach((m) => {
        m.userData = { landmark: "pyre" };
        m.traverse((c) => {
          c.userData = { landmark: "pyre" };
        });
      });
      landmarksRef.current.push(campfireStones, campfireLogs, campfirePit);

      const log1 = logModel.clone();
      log1.position.set(2.0, getTerrainHeight(2.0, 1.2), 1.2);
      log1.rotation.y = -Math.PI / 4;
      log1.scale.set(1.2, 1.2, 1.2);
      genesisGroup.add(log1);

      const log2 = logModel.clone();
      log2.position.set(-2.0, getTerrainHeight(-2.0, 1.1), 1.1);
      log2.rotation.y = Math.PI / 3;
      log2.scale.set(1.2, 1.2, 1.2);
      genesisGroup.add(log2);

      const hearthLogStack = logStackModel.clone();
      hearthLogStack.position.set(-2.4, getTerrainHeight(-2.4, -2.0), -2.0);
      hearthLogStack.rotation.y = 0.4;
      hearthLogStack.scale.set(1.15, 1.15, 1.15);
      genesisGroup.add(hearthLogStack);

      const fireCrate = crateModel.clone();
      fireCrate.position.set(2.4, getTerrainHeight(2.4, 0.8), 0.8);
      fireCrate.scale.set(0.7, 0.7, 0.7);
      genesisGroup.add(fireCrate);
      tick();

      // Encircling Forest Trees & Perimeter Vegetation
      const perimeterTrees = new THREE.Group();
      const treeLibrary = [treeForest, treeCrooked, treeForestHigh, treeHighCrooked];
      for (let i = 0; i < 26; i++) {
        const angle = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        // Keep south path slightly open
        if (angle > 1.3 && angle < 1.8 && Math.random() > 0.3) continue;
        const dist = 16.5 + Math.random() * 8.0;
        const tx = Math.cos(angle) * dist;
        const tz = Math.sin(angle) * dist;
        const template = treeLibrary[i % treeLibrary.length];
        const tMesh = template.clone();
        const s = 1.05 + Math.random() * 0.6;
        tMesh.position.set(tx, getTerrainHeight(tx, tz), tz);
        tMesh.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
        tMesh.rotation.y = Math.random() * Math.PI * 2;
        perimeterTrees.add(tMesh);
      }
      genesisGroup.add(perimeterTrees);
      tick();

      // High Chieftain Grimjaw (Stands vigil at camp)
      const orcGltf = await loadGLTF("/models/character_orc.glb");
      if (orcGltf) {
        const chiefMesh = SkeletonUtils.clone(orcGltf.scene) as THREE.Group;
        chiefMesh.scale.set(1.15, 1.15, 1.15);
        chiefMesh.position.set(0, getTerrainHeight(0, -2.2), -2.2);
        chiefMesh.rotation.y = 0.08;

        chiefMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const rightArm = chiefMesh.getObjectByName("arm-right");
        if (rightArm) {
          const w = swordModel.clone();
          w.position.set(0, -0.22, 0.22);
          w.rotation.set(Math.PI * 0.45, 0, 0);
          rightArm.add(w);
        }

        const leftArm = chiefMesh.getObjectByName("arm-left");
        if (leftArm) {
          const s = roundShieldModel.clone();
          s.position.set(0, -0.15, 0.12);
          s.rotation.set(0, Math.PI * 0.5, 0);
          leftArm.add(s);
        }

        const mixer = new THREE.AnimationMixer(chiefMesh);
        const idleClip = orcGltf.animations.find((a) => a.name === "idle") || orcGltf.animations[0];
        if (idleClip) mixer.clipAction(idleClip).play();
        chieftainMixerRef.current = mixer;

        chiefMesh.userData = { landmark: "chieftain" };
        chiefMesh.traverse((c) => {
          c.userData = { landmark: "chieftain" };
        });
        landmarksRef.current.push(chiefMesh);

        genesisGroup.add(chiefMesh);

        // Goblin Population System
        const populationSystem = new GoblinPopulationSystem(scene);
        populationSystemRef.current = populationSystem;

        populationSystem.init(orcGltf, getTerrainHeight, CAMP_OBSTACLES, 0, {
          pickaxe: pickaxeModel,
          spear: spearModel,
          sword: swordModel,
          roundShield: roundShieldModel,
          rectShield: rectShieldModel
        });
        tick();
      }

      // =========================================================================
      // TIER 1: Warband, Chieftain Cabin & Treasury Hoard (Unlocked at $5K MC)
      // =========================================================================
      const tier1Group = new THREE.Group();
      tier1Group.name = "Tier1WarbandGroup";
      tier1Group.visible = currentTierRef.current >= 1;
      scene.add(tier1Group);
      tier1WarbandGroupRef.current = tier1Group;

      // 1. High Chieftain's Small Castle Keep at North Hill (0, -11.5)
      const chieftainCabin = new THREE.Group();
      const cabinY = getTerrainHeight(0, -11.5);
      chieftainCabin.position.set(0, cabinY, -11.5);

      // A. Solid Stone Masonry Courtyard Plinth (Clean stone foundation - ZERO rubble/loose planks)
      const plinthGeo = new THREE.CylinderGeometry(2.7, 3.1, 0.45, 20);
      plinthGeo.translate(0, 0.22, 0);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x221d18,
        roughness: 0.94,
        metalness: 0.08,
        flatShading: true
      });
      const castlePlinth = new THREE.Mesh(plinthGeo, plinthMat);
      castlePlinth.receiveShadow = true;
      chieftainCabin.add(castlePlinth);

      // Front Stone Approach Step
      const stepGeo = new THREE.BoxGeometry(2.2, 0.2, 0.8);
      const stepMesh = new THREE.Mesh(stepGeo, plinthMat);
      stepMesh.position.set(0, 0.1, 1.8);
      stepMesh.receiveShadow = true;
      chieftainCabin.add(stepMesh);

      // Bedrock boulders locking the stone castle plinth into the hill terrain
      const deckRockL = rockSmallA.clone();
      deckRockL.position.set(-2.4, 0.1, -0.6);
      deckRockL.scale.set(1.3, 1.2, 1.3);
      chieftainCabin.add(deckRockL);

      const deckRockR = rockSmallA.clone();
      deckRockR.position.set(2.4, 0.1, -0.6);
      deckRockR.scale.set(1.3, 1.2, 1.3);
      deckRockR.rotation.y = 1.8;
      chieftainCabin.add(deckRockR);

      // B. Level 1: Fortified Castle Great Hall & Gatehouse
      // Main Lower Castle Hall Structure
      const castleHall = woodStructureModel.clone();
      castleHall.position.set(0, 0.45, -0.2);
      castleHall.scale.set(2.1, 1.5, 1.9);
      chieftainCabin.add(castleHall);

      // Fortified Stone Corner Bastions
      const bastionRockL = rockSmallA.clone();
      bastionRockL.position.set(-1.65, 0.35, 0.95);
      bastionRockL.scale.set(1.15, 1.5, 1.15);
      chieftainCabin.add(bastionRockL);

      const bastionRockR = rockSmallA.clone();
      bastionRockR.position.set(1.65, 0.35, 0.95);
      bastionRockR.scale.set(1.15, 1.5, 1.15);
      bastionRockR.rotation.y = 1.6;
      chieftainCabin.add(bastionRockR);

      // Fortified Gatehouse Archway
      const gateArch = woodSupportModel.clone();
      gateArch.position.set(0, 0.45, 0.95);
      gateArch.scale.set(1.5, 1.35, 1.4);
      chieftainCabin.add(gateArch);

      // Level 2: Raised Crenellated Castle Watch Tower Keep
      const castleTower = watchTowerModel.clone();
      castleTower.position.set(0, 1.9, -0.2);
      castleTower.scale.set(1.3, 1.3, 1.3);
      chieftainCabin.add(castleTower);

      // Clan War Standard planted atop the castle battlements
      const clanFlag = flagModel.clone();
      clanFlag.position.set(0, 5.5, -0.2);
      clanFlag.scale.set(1.25, 1.25, 1.25);
      clanFlag.rotation.y = -0.3;
      chieftainCabin.add(clanFlag);

      // Warrior Shield mounted on the Castle Gatehouse Facade
      const gateShield = roundShieldModel.clone();
      gateShield.position.set(0, 1.85, 1.05);
      gateShield.scale.set(1.15, 1.15, 1.15);
      chieftainCabin.add(gateShield);

      // C. Castle Courtyard Supplies & Chests
      const porchChest = chestModel.clone();
      porchChest.position.set(-1.4, 0.45, 1.45);
      porchChest.scale.set(0.85, 0.85, 0.85);
      porchChest.rotation.y = 0.4;
      chieftainCabin.add(porchChest);

      const porchBarrel = barrelModel.clone();
      porchBarrel.position.set(-1.8, 0.45, 0.7);
      porchBarrel.scale.set(0.8, 0.8, 0.8);
      chieftainCabin.add(porchBarrel);

      const porchCrate = crateModel.clone();
      porchCrate.position.set(1.5, 0.45, 1.4);
      porchCrate.scale.set(0.75, 0.75, 0.75);
      porchCrate.rotation.y = 0.25;
      chieftainCabin.add(porchCrate);

      // D. Warm Atmosphere & Lighting (Interior Hearth + Facade Fill + Castle Wash)
      const interiorHearth = new THREE.PointLight(0xffa520, 3.8, 12, 1.6);
      interiorHearth.position.set(0, 1.4, 0);
      chieftainCabin.add(interiorHearth);

      const porchLantern = new THREE.PointLight(0xf59e0b, 2.6, 9, 1.8);
      porchLantern.position.set(0, 2.3, 1.25);
      chieftainCabin.add(porchLantern);

      const fortressRoofLight = new THREE.PointLight(0xffdfa0, 2.8, 22, 1.5);
      fortressRoofLight.position.set(0, 7.0, 4.0);
      chieftainCabin.add(fortressRoofLight);

      const roofRimLight = new THREE.PointLight(0x7da4d9, 1.6, 15, 1.8);
      roofRimLight.position.set(0, 5.8, -1.8);
      chieftainCabin.add(roofRimLight);

      tier1Group.add(chieftainCabin);

      // 2. The Physical Goblin Hoard / Treasury (East of campfire trail)
      const hoardGroup = new THREE.Group();
      const hoardY = getTerrainHeight(3.4, -6.8);
      hoardGroup.position.set(3.4, hoardY, -6.8);

      // Backing natural rock anchoring the stash
      const hoardRock = rockSmallA.clone();
      hoardRock.position.set(0.65, 0, -0.6);
      hoardRock.scale.set(1.4, 1.25, 1.4);
      hoardRock.rotation.y = 1.1;
      hoardGroup.add(hoardRock);

      // Stolen supply barrel tilted into the stash
      const hoardBarrel = barrelModel.clone();
      hoardBarrel.position.set(0.72, 0.05, 0.42);
      hoardBarrel.scale.set(0.8, 0.8, 0.8);
      hoardBarrel.rotation.set(0.12, 0.35, -0.15);
      hoardGroup.add(hoardBarrel);

      // Stolen knight's round shield propped against the boulder
      const stolenShield = roundShieldModel.clone();
      stolenShield.position.set(0.48, 0.24, -0.42);
      stolenShield.scale.set(1.15, 1.15, 1.15);
      stolenShield.rotation.set(0.28, 0.52, -0.2);
      hoardGroup.add(stolenShield);

      // Knight's sword planted into the earth
      const stolenSword = swordModel.clone();
      stolenSword.position.set(-0.78, 0.46, -0.38);
      stolenSword.scale.set(1.25, 1.25, 1.25);
      stolenSword.rotation.set(0.22, 0.38, 0.32);
      hoardGroup.add(stolenSword);

      // A. Grounded Dark Stone Dais (Elevates hoard above earth, prevents terrain overlap)
      const daisGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.14, 24);
      daisGeo.translate(0, 0.07, 0);
      const daisMat = new THREE.MeshStandardMaterial({
        color: 0x2c221a,
        roughness: 0.92,
        metalness: 0.06,
        flatShading: true
      });
      const daisMesh = new THREE.Mesh(daisGeo, daisMat);
      daisMesh.receiveShadow = true;
      hoardGroup.add(daisMesh);

      // B. Sculpted Golden Treasure Bed (Smooth shaded, lustrous gold alloy)
      const goldMoundGeo = new THREE.CylinderGeometry(1.0, 1.25, 0.12, 32);
      goldMoundGeo.translate(0, 0.15, 0);
      const goldMoundMat = new THREE.MeshStandardMaterial({
        color: 0xdf9d08,
        metalness: 0.88,
        roughness: 0.28,
        flatShading: false
      });
      const goldMound = new THREE.Mesh(goldMoundGeo, goldMoundMat);
      goldMound.receiveShadow = true;
      goldMound.castShadow = true;
      hoardGroup.add(goldMound);
      goldMoundMeshRef.current = goldMound;

      // Raised Coin Plateau directly beneath the open chest
      const upperCoinGeo = new THREE.CylinderGeometry(0.65, 0.85, 0.08, 24);
      upperCoinGeo.translate(-0.15, 0.23, -0.05);
      const upperCoin = new THREE.Mesh(upperCoinGeo, goldMoundMat);
      upperCoin.receiveShadow = true;
      upperCoin.castShadow = true;
      goldMound.add(upperCoin);

      // Cascading Front Coin Apron spilling towards raider approach path
      const spillCoinGeo = new THREE.CylinderGeometry(0.45, 0.65, 0.06, 20);
      spillCoinGeo.translate(-0.1, 0.12, 0.62);
      const spillCoin = new THREE.Mesh(spillCoinGeo, goldMoundMat);
      spillCoin.receiveShadow = true;
      goldMound.add(spillCoin);

      // C. Primary Open Treasure Chest (Elevated proudly on top of coin plateau)
      const openChest = chestModel.clone();
      openChest.position.set(-0.15, 0.26, -0.05);
      openChest.scale.set(0.92, 0.92, 0.92);
      openChest.rotation.y = 0.28;
      const chestLid = openChest.getObjectByName("lid");
      if (chestLid) {
        chestLid.rotation.x = -Math.PI * 0.62;
      }
      // Glowing interior gold bed inside open chest
      const chestGoldGeo = new THREE.BoxGeometry(0.52, 0.14, 0.32);
      chestGoldGeo.translate(0, 0.14, 0);
      const chestGoldMesh = new THREE.Mesh(chestGoldGeo, goldMoundMat);
      openChest.add(chestGoldMesh);
      hoardGroup.add(openChest);

      // Secondary Pirate Chest (Rests on south-east flank of dais)
      const closedChest = pirateChestModel.clone();
      closedChest.position.set(0.82, 0.15, 0.24);
      closedChest.scale.set(0.72, 0.72, 0.72);
      closedChest.rotation.y = -0.55;
      hoardGroup.add(closedChest);

      // Ornate Golden Chalice tipped on the treasure mound
      const chalice = chaliceModel.clone();
      chalice.position.set(0.24, 0.27, 0.38);
      chalice.scale.set(0.9, 0.9, 0.9);
      chalice.rotation.set(1.35, 0.2, 0.7);
      chalice.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.92,
            roughness: 0.18
          });
        }
      });
      hoardGroup.add(chalice);

      // Faceted gems & jewels elevated on chest and coins
      const gemColors = [0xe11d48, 0x2563eb, 0x10b981, 0x9333ea, 0xf59e0b];
      const gemPositions: [number, number, number, number][] = [
        [-0.15, 0.38, -0.02, 0.45],  // Inside open chest on gold bed
        [-0.22, 0.36, 0.05, 0.4],    // Chest lip
        [0.12, 0.28, 0.24, 0.42],   // On gold mound
        [-0.38, 0.23, 0.42, 0.38],  // Spilled forward
        [0.34, 0.26, -0.15, 0.4]    // Near chalice
      ];
      gemPositions.forEach(([gx, gy, gz, gs], idx) => {
        const gem = jewelModel.clone();
        gem.position.set(gx, gy, gz);
        gem.scale.set(gs, gs, gs);
        gem.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        gem.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
              color: gemColors[idx % gemColors.length],
              metalness: 0.1,
              roughness: 0.08,
              transparent: true,
              opacity: 0.92
            });
          }
        });
        hoardGroup.add(gem);
      });

      // Individual 3D chunky gold coins cascading down the mound
      const goldCoinMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        metalness: 0.92,
        roughness: 0.18
      });

      const coinPlacements: [number, number, number, number, number, number][] = [
        [-0.08, 0.36, -0.02, 0.28, 0.15, 0.2],
        [-0.14, 0.35, 0.02, 0.28, -0.2, 0.4],
        [-0.22, 0.33, 0.06, 0.28, 0.3, -0.1],
        [-0.18, 0.37, -0.05, 0.26, 0.1, 0.6],
        [-0.05, 0.34, 0.04, 0.26, -0.3, 0.2],
        [-0.26, 0.26, 0.18, 0.28, 0.4, 0.3],
        [-0.32, 0.23, 0.26, 0.28, 0.1, -0.4],
        [-0.38, 0.21, 0.36, 0.28, -0.2, 0.5],
        [0.05, 0.27, 0.12, 0.3, 0.1, 0.1],
        [0.18, 0.26, 0.18, 0.3, -0.25, 0.3],
        [-0.02, 0.27, 0.32, 0.28, 0.35, -0.2],
        [0.12, 0.26, 0.38, 0.28, 0.1, 0.4],
        [-0.15, 0.25, 0.36, 0.3, -0.15, -0.3],
        [0.28, 0.24, 0.12, 0.28, 0.3, 0.2],
        [-0.05, 0.26, -0.16, 0.28, 0.2, -0.1],
        [0.22, 0.25, -0.08, 0.28, -0.3, 0.3],
        [-0.52, 0.14, 0.48, 0.28, 0.1, 0.8],
        [-0.65, 0.13, 0.36, 0.26, -0.15, 0.4],
        [-0.48, 0.14, 0.62, 0.28, 0.2, -0.5],
        [0.02, 0.15, 0.56, 0.28, 0.1, 0.3],
        [0.38, 0.15, 0.46, 0.26, -0.2, 0.1],
        [-0.72, 0.12, 0.56, 0.26, 0.1, 0.2]
      ];

      coinPlacements.forEach(([cx, cy, cz, cs, rx, rz]) => {
        const coin = goldCoinModel.clone();
        coin.position.set(cx, cy, cz);
        coin.scale.set(cs, cs, cs);
        coin.rotation.set(rx, Math.random() * Math.PI * 2, rz);
        coin.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            (c as THREE.Mesh).material = goldCoinMat;
            c.castShadow = true;
          }
        });
        hoardGroup.add(coin);
      });

      // Warm localized treasure gleam light
      const hoardGlintLight = new THREE.PointLight(0xffd043, 2.2, 6.0, 1.8);
      hoardGlintLight.position.set(0, 0.65, 0.1);
      hoardGroup.add(hoardGlintLight);
      hoardLightRef.current = hoardGlintLight;

      // Delicate golden sparkle glints
      const glintCount = 14;
      const glintGeo = new THREE.BufferGeometry();
      const glintPos = new Float32Array(glintCount * 3);
      for (let i = 0; i < glintCount; i++) {
        glintPos[i * 3] = (Math.random() - 0.5) * 1.4;
        glintPos[i * 3 + 1] = Math.random() * 0.7 + 0.15;
        glintPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
      }
      glintGeo.setAttribute("position", new THREE.BufferAttribute(glintPos, 3));
      const glintMat = new THREE.PointsMaterial({
        color: 0xffe066,
        size: 0.12,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const glintPoints = new THREE.Points(glintGeo, glintMat);
      hoardGroup.add(glintPoints);
      hoardGlintsRef.current = glintPoints;

      tier1Group.add(hoardGroup);

      // 3. First 3 Goblin Tents
      // North-West Tent
      const nwTent = tentDetailedOpen.clone();
      nwTent.position.set(-7.5, getTerrainHeight(-7.5, -6.5) + 0.05, -6.5);
      nwTent.rotation.y = Math.PI / 4 + 0.2;
      nwTent.scale.set(1.4, 1.4, 1.4);
      tier1Group.add(nwTent);

      // South-West Canvas Tent
      const swTent = tentCanvas.clone();
      swTent.position.set(-6.8, getTerrainHeight(-6.8, 7.5) + 0.05, 7.5);
      swTent.rotation.y = (3 * Math.PI) / 4 - 0.3;
      swTent.scale.set(1.3, 1.3, 1.3);
      tier1Group.add(swTent);

      // East Large Tent
      const eastTent = tentDetailedClosed.clone();
      eastTent.position.set(8.5, getTerrainHeight(8.5, -1.5) + 0.05, -1.5);
      eastTent.rotation.y = -Math.PI / 2 + 0.3;
      eastTent.scale.set(1.45, 1.45, 1.45);
      tier1Group.add(eastTent);

      tick();

      // =========================================================================
      // TIER 2: Fortified Mine, All 6 Tents & Defenses (Unlocked at $15K MC)
      // =========================================================================
      const tier2Group = new THREE.Group();
      tier2Group.name = "Tier2MineGroup";
      tier2Group.visible = currentTierRef.current >= 2;
      scene.add(tier2Group);
      tier2MineGroupRef.current = tier2Group;

      // 1. Chieftain's Stronghold Expansions (East Watchtower, Palisade Perimeter, Twin Braziers)
      const chieftainT2Upgrade = new THREE.Group();
      chieftainT2Upgrade.position.set(0, cabinY, -11.5);

      // East Flank Bastion Watchtower (Anchored into hill terrain)
      const eastTower = watchTowerModel.clone();
      eastTower.position.set(4.8, getTerrainHeight(4.8, -11.5) - cabinY, 0);
      eastTower.scale.set(1.35, 1.35, 1.35);
      eastTower.rotation.y = -0.3;
      chieftainT2Upgrade.add(eastTower);

      // Clan banner atop east watchtower platform (grounded on tower platform floor)
      const eastTowerFlag = flagModel.clone();
      eastTowerFlag.position.set(4.8, getTerrainHeight(4.8, -11.5) - cabinY + 3.8, 0);
      eastTowerFlag.scale.set(1.1, 1.1, 1.1);
      eastTowerFlag.rotation.y = -0.3;
      chieftainT2Upgrade.add(eastTowerFlag);

      // Connecting Fortified Rampart Curtain Wall linking keep to East Bastion
      const eastCurtain = woodStructureModel.clone();
      eastCurtain.position.set(2.6, 0.45, 0);
      eastCurtain.scale.set(1.9, 1.35, 1.1);
      chieftainT2Upgrade.add(eastCurtain);

      // Fortified Palisade Courtyard Walls (grounded firmly along hill perimeter)
      // Left / West palisade curve
      const palisadeL1 = fortifiedFenceModel.clone();
      palisadeL1.position.set(-2.8, getTerrainHeight(-2.8, -10.2) - cabinY, 1.3);
      palisadeL1.scale.set(1.35, 1.35, 1.35);
      palisadeL1.rotation.y = 0.55;
      chieftainT2Upgrade.add(palisadeL1);

      const palisadeL2 = fortifiedFenceModel.clone();
      palisadeL2.position.set(-3.7, getTerrainHeight(-3.7, -10.8) - cabinY, 0.7);
      palisadeL2.scale.set(1.35, 1.35, 1.35);
      palisadeL2.rotation.y = 0.85;
      chieftainT2Upgrade.add(palisadeL2);

      // Right / East palisade connecting keep to East Tower
      const palisadeR1 = fortifiedFenceModel.clone();
      palisadeR1.position.set(2.8, getTerrainHeight(2.8, -10.2) - cabinY, 1.3);
      palisadeR1.scale.set(1.35, 1.35, 1.35);
      palisadeR1.rotation.y = -0.55;
      chieftainT2Upgrade.add(palisadeR1);

      const palisadeR2 = fortifiedFenceModel.clone();
      palisadeR2.position.set(3.7, getTerrainHeight(3.7, -10.8) - cabinY, 0.7);
      palisadeR2.scale.set(1.35, 1.35, 1.35);
      palisadeR2.rotation.y = -0.85;
      chieftainT2Upgrade.add(palisadeR2);

      // Twin Flaming Fire Braziers at Entrance Path
      const brazierL = fireBasketModel.clone();
      brazierL.position.set(-2.2, getTerrainHeight(-2.2, -9.0) - cabinY, 2.5);
      brazierL.scale.set(1.1, 1.1, 1.1);
      chieftainT2Upgrade.add(brazierL);

      const brazierLightL = new THREE.PointLight(0xff7711, 2.8, 8.5, 1.8);
      brazierLightL.position.set(-2.2, getTerrainHeight(-2.2, -9.0) - cabinY + 1.2, 2.5);
      chieftainT2Upgrade.add(brazierLightL);

      const brazierR = fireBasketModel.clone();
      brazierR.position.set(2.2, getTerrainHeight(2.2, -9.0) - cabinY, 2.5);
      brazierR.scale.set(1.1, 1.1, 1.1);
      chieftainT2Upgrade.add(brazierR);

      const brazierLightR = new THREE.PointLight(0xff7711, 2.8, 8.5, 1.8);
      brazierLightR.position.set(2.2, getTerrainHeight(2.2, -9.0) - cabinY + 1.2, 2.5);
      chieftainT2Upgrade.add(brazierLightR);

      // Perimeter Defensive Spikes
      const spikesL = trapSpikesModel.clone();
      spikesL.position.set(-3.2, getTerrainHeight(-3.2, -8.6) - cabinY, 2.9);
      spikesL.scale.set(1.2, 1.2, 1.2);
      spikesL.rotation.y = 0.3;
      chieftainT2Upgrade.add(spikesL);

      const spikesR = trapSpikesModel.clone();
      spikesR.position.set(3.2, getTerrainHeight(3.2, -8.6) - cabinY, 2.9);
      spikesR.scale.set(1.2, 1.2, 1.2);
      spikesR.rotation.y = -0.3;
      chieftainT2Upgrade.add(spikesR);

      tier2Group.add(chieftainT2Upgrade);

      // 2. The Goblin Mine Landmark at (-11.8, 3.6), facing southeast towards the camp path
      const mineGroup = new THREE.Group();
      const mineY = getTerrainHeight(-11.8, 3.6);
      mineGroup.position.set(-11.8, mineY, 3.6);
      mineGroup.rotation.y = 1.15;

      // 1. Dark Interior Tunnel Cavity (giving the feeling the mine goes deep underground)
      const tunnelLength = 4.2;
      const tunnelGeo = new THREE.CylinderGeometry(1.05, 1.15, tunnelLength, 14, 1, true);
      tunnelGeo.rotateX(Math.PI / 2);
      tunnelGeo.translate(0, 0.95, -tunnelLength / 2);
      const tunnelMat = new THREE.MeshStandardMaterial({
        color: 0x07090b,
        roughness: 0.98,
        metalness: 0.05,
        side: THREE.BackSide
      });
      const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
      mineGroup.add(tunnelMesh);

      // Pitch-black void backdrop at the deepest recess of the shaft
      const tunnelBackdropGeo = new THREE.CircleGeometry(1.12, 14);
      tunnelBackdropGeo.translate(0, 0.95, -tunnelLength + 0.05);
      const tunnelBackdropMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const tunnelBackdrop = new THREE.Mesh(tunnelBackdropGeo, tunnelBackdropMat);
      mineGroup.add(tunnelBackdrop);

      // Deep subterranean cavern glow (faint greenish/teal light deep inside the shaft)
      const deepMineLight = new THREE.PointLight(0x059669, 0.45, 4.0, 2.0);
      deepMineLight.position.set(0, 0.95, -2.8);
      mineGroup.add(deepMineLight);

      // 2. Heavy Timber Portal Framing (Outer entrance & inner shoring)
      const outerTimber = woodSupportModel.clone();
      outerTimber.position.set(0, 0, 0);
      outerTimber.scale.set(1.95, 1.9, 1.95);
      mineGroup.add(outerTimber);

      // Reinforcing heavy timber lintel across the top
      const topBeam = logModel.clone();
      topBeam.position.set(0, 1.9, 0.05);
      topBeam.rotation.z = Math.PI / 2;
      topBeam.scale.set(1.1, 1.25, 1.1);
      mineGroup.add(topBeam);

      // Inner timber shoring frame visible down the tunnel
      const innerTimber = woodSupportModel.clone();
      innerTimber.position.set(0, 0, -1.8);
      innerTimber.scale.set(1.85, 1.8, 1.85);
      mineGroup.add(innerTimber);

      // 3. Natural Rock Enclosure (wedging the mine mouth into the cliff)
      const leftRock = rockLargeB.clone();
      leftRock.position.set(-1.45, -0.1, 0.2);
      leftRock.scale.set(1.7, 1.8, 1.7);
      leftRock.rotation.y = 0.8;
      mineGroup.add(leftRock);

      const rightRock = rockLargeA.clone();
      rightRock.position.set(1.4, -0.1, -0.3);
      rightRock.scale.set(1.65, 1.85, 1.65);
      rightRock.rotation.y = -0.5;
      mineGroup.add(rightRock);

      const topRock = rockSmallA.clone();
      topRock.position.set(0, 2.15, -0.15);
      topRock.scale.set(1.9, 1.2, 1.5);
      topRock.rotation.y = 0.4;
      mineGroup.add(topRock);

      // 4. Raw Ore Crystals Embedded in the Rock Face
      const oreCrystalMat = new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        roughness: 0.25,
        metalness: 0.15,
        emissive: 0x064e3b,
        emissiveIntensity: 0.35
      });

      const crystal1 = crystalModel.clone();
      crystal1.position.set(-0.95, 1.3, -0.2);
      crystal1.scale.set(0.65, 0.65, 0.65);
      crystal1.rotation.set(0.3, 0.2, -0.5);
      crystal1.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = oreCrystalMat;
      });
      mineGroup.add(crystal1);

      const crystal2 = crystalModel.clone();
      crystal2.position.set(0.9, 0.8, -0.4);
      crystal2.scale.set(0.55, 0.55, 0.55);
      crystal2.rotation.set(-0.2, 0.4, 0.6);
      crystal2.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = oreCrystalMat;
      });
      mineGroup.add(crystal2);

      // 5. Mining Hand Ore Cart & Extracted Ore Piles
      const oreCart = cartModel.clone();
      oreCart.position.set(1.35, 0.05, 1.25);
      oreCart.scale.set(0.95, 0.95, 0.95);
      oreCart.rotation.y = 0.35;
      mineGroup.add(oreCart);

      const cartOre1 = oreStoneModel.clone();
      cartOre1.position.set(1.35, 0.42, 1.25);
      cartOre1.scale.set(1.1, 1.1, 1.1);
      mineGroup.add(cartOre1);

      const cartOre2 = oreStoneModel.clone();
      cartOre2.position.set(1.48, 0.45, 1.05);
      cartOre2.scale.set(0.9, 0.9, 0.9);
      cartOre2.rotation.y = 0.8;
      mineGroup.add(cartOre2);

      const orePiles: [number, number, number, number, number][] = [
        [-1.15, 0.05, 1.1, 1.3, 0.4],
        [-0.75, 0.05, 1.45, 1.1, -0.5],
        [-1.4, 0.05, 1.5, 0.95, 0.9],
        [1.85, 0.05, 0.65, 1.2, 0.3],
        [0.75, 0.04, 1.85, 0.85, -0.2]
      ];
      orePiles.forEach(([ox, oy, oz, os, orot]) => {
        const ore = oreStoneModel.clone();
        ore.position.set(ox, oy, oz);
        ore.scale.set(os, os, os);
        ore.rotation.y = orot;
        mineGroup.add(ore);
      });

      // 6. Mining Tools (Pickaxes)
      const pickaxe1 = pickaxeModel.clone();
      pickaxe1.position.set(-0.95, 0.55, 0.15);
      pickaxe1.scale.set(1.3, 1.3, 1.3);
      pickaxe1.rotation.set(0.15, 0.25, -0.45);
      mineGroup.add(pickaxe1);

      const pickaxe2 = pickaxeModel.clone();
      pickaxe2.position.set(0.72, 0.28, 1.82);
      pickaxe2.scale.set(1.25, 1.25, 1.25);
      pickaxe2.rotation.set(-0.4, 0.5, 0.7);
      mineGroup.add(pickaxe2);

      // 7. Explosives Supply Barrel
      const mineBarrel = barrelModel.clone();
      mineBarrel.position.set(-1.45, 0.05, 0.65);
      mineBarrel.scale.set(0.8, 0.8, 0.8);
      mineBarrel.rotation.y = 0.3;
      mineGroup.add(mineBarrel);

      // 8. Crude Hanging Mining Lantern
      const mineLantern = new THREE.PointLight(0xf59e0b, 2.4, 9.0, 1.8);
      mineLantern.position.set(0, 1.75, 0.25);
      mineLantern.castShadow = true;
      mineGroup.add(mineLantern);

      tier2Group.add(mineGroup);

      // 3. The 3 Remaining Tents (Completes all 6 tents in settlement)
      // West Tent
      const westTent = tentSmallClosed.clone();
      westTent.position.set(-9.8, getTerrainHeight(-9.8, 1.2) + 0.05, 1.2);
      westTent.rotation.y = Math.PI / 2 - 0.2;
      westTent.scale.set(1.35, 1.35, 1.35);
      tier2Group.add(westTent);

      // South-East Tent
      const seTent = tentSmallOpen.clone();
      seTent.position.set(7.2, getTerrainHeight(7.2, 6.2) + 0.05, 6.2);
      seTent.rotation.y = -(3 * Math.PI) / 4 + 0.2;
      seTent.scale.set(1.35, 1.35, 1.35);
      tier2Group.add(seTent);

      // North-East Survival Tent
      const neTent = tentSurvival.clone();
      neTent.position.set(6.8, getTerrainHeight(6.8, -8.2) + 0.05, -8.2);
      neTent.rotation.y = -Math.PI / 4 - 0.3;
      neTent.scale.set(1.3, 1.3, 1.3);
      tier2Group.add(neTent);

      // 4. Defenses & Clutter
      const southTower = watchTowerModel.clone();
      southTower.position.set(-8.2, getTerrainHeight(-8.2, 9.2), 9.2);
      southTower.rotation.y = 0.4;
      southTower.scale.set(1.2, 1.2, 1.2);
      tier2Group.add(southTower);

      const fenceSouth = fortifiedFenceModel.clone();
      fenceSouth.position.set(-4.5, getTerrainHeight(-4.5, 9.2), 9.2);
      tier2Group.add(fenceSouth);

      const fenceEast = fortifiedFenceModel.clone();
      fenceEast.position.set(11.0, getTerrainHeight(11.0, 3.2), 3.2);
      fenceEast.scale.set(0.85, 0.75, 0.85);
      fenceEast.rotation.y = -1.9;
      tier2Group.add(fenceEast);

      const trapSpikes1 = trapSpikesModel.clone();
      trapSpikes1.position.set(-7.0, getTerrainHeight(-7.0, 9.5), 9.5);
      tier2Group.add(trapSpikes1);

      const trapSpikes2 = trapSpikesModel.clone();
      trapSpikes2.position.set(10.2, getTerrainHeight(10.2, 4.0), 4.0);
      tier2Group.add(trapSpikes2);

      const lumberStack = resourceWoodModel.clone();
      lumberStack.position.set(-6.5, getTerrainHeight(-6.5, -5.8) + 0.05, -5.8);
      lumberStack.scale.set(1.1, 1.1, 1.1);
      lumberStack.rotation.y = 0.6;
      tier2Group.add(lumberStack);

      tick();

      // =========================================================================
      // TIER 3: Great Stronghold Citadel & Void Chasm (Unlocked at $30K MC)
      // =========================================================================
      const tier3Group = new THREE.Group();
      tier3Group.name = "Tier3StrongholdGroup";
      tier3Group.visible = currentTierRef.current >= 3;
      scene.add(tier3Group);
      tier3StrongholdGroupRef.current = tier3Group;

      // 1. High Chieftain's Grand Citadel (West Bastion Watchtower, War Trophies, Battlements)
      const chieftainCitadel = new THREE.Group();
      chieftainCitadel.position.set(0, cabinY, -11.5);

      // West Flank Bastion Watchtower (Completes Twin Watchtowers flanking the fortress)
      const westTower = watchTowerModel.clone();
      westTower.position.set(-4.8, getTerrainHeight(-4.8, -11.5) - cabinY, 0);
      westTower.scale.set(1.35, 1.35, 1.35);
      westTower.rotation.y = 0.3;
      chieftainCitadel.add(westTower);

      // Connecting Fortified Rampart Curtain Wall linking West Bastion to central keep
      const westCurtain = woodStructureModel.clone();
      westCurtain.position.set(-2.6, 0.45, 0);
      westCurtain.scale.set(1.9, 1.35, 1.1);
      chieftainCitadel.add(westCurtain);

      // High Chieftain's Great Pirate / Clan War Standard hoisted high atop the Central Keep
      const centralGrandFlag = flagPirateModel.clone();
      centralGrandFlag.position.set(0, 5.8, -0.2);
      centralGrandFlag.scale.set(1.35, 1.35, 1.35);
      centralGrandFlag.rotation.y = -0.3;
      chieftainCitadel.add(centralGrandFlag);

      // Twin Bastion War Standard on west tower platform
      const westTowerFlag = flagModel.clone();
      westTowerFlag.position.set(-4.8, getTerrainHeight(-4.8, -11.5) - cabinY + 3.8, 0);
      westTowerFlag.scale.set(1.1, 1.1, 1.1);
      westTowerFlag.rotation.y = 0.3;
      chieftainCitadel.add(westTowerFlag);

      // War Trophies mounted on the Fortress Keep Facade
      // Central Rectangular War Shield above entrance
      const citadelShieldCenter = rectShieldModel.clone();
      citadelShieldCenter.position.set(0, 2.3, 1.15);
      citadelShieldCenter.scale.set(1.2, 1.2, 1.2);
      chieftainCitadel.add(citadelShieldCenter);

      // Flanking Round War Shields on the keep lintel
      const citadelShieldL = roundShieldModel.clone();
      citadelShieldL.position.set(-0.85, 2.15, 1.12);
      citadelShieldL.scale.set(1.1, 1.1, 1.1);
      citadelShieldL.rotation.y = 0.2;
      chieftainCitadel.add(citadelShieldL);

      const citadelShieldR = roundShieldModel.clone();
      citadelShieldR.position.set(0.85, 2.15, 1.12);
      citadelShieldR.scale.set(1.1, 1.1, 1.1);
      citadelShieldR.rotation.y = -0.2;
      chieftainCitadel.add(citadelShieldR);

      // Crossed War Spears mounted above the doorway
      const spear1 = spearModel.clone();
      spear1.position.set(-0.15, 2.4, 1.18);
      spear1.rotation.set(0, 0, Math.PI / 4);
      spear1.scale.set(1.15, 1.15, 1.15);
      chieftainCitadel.add(spear1);

      const spear2 = spearModel.clone();
      spear2.position.set(0.15, 2.4, 1.18);
      spear2.rotation.set(0, 0, -Math.PI / 4);
      spear2.scale.set(1.15, 1.15, 1.15);
      chieftainCitadel.add(spear2);

      // High Citadel Blazing Golden Hearth Fire (Rich golden amber flame)
      const citadelHearth = new THREE.PointLight(0xff9922, 4.2, 18, 1.6);
      citadelHearth.position.set(0, 2.2, 0);
      chieftainCitadel.add(citadelHearth);

      // Tower Braziers on the bastion platforms
      const towerBrazierL = fireBasketModel.clone();
      towerBrazierL.position.set(-4.8, getTerrainHeight(-4.8, -11.5) - cabinY + 3.8, 1.0);
      towerBrazierL.scale.set(0.8, 0.8, 0.8);
      chieftainCitadel.add(towerBrazierL);

      const towerBrazierR = fireBasketModel.clone();
      towerBrazierR.position.set(4.8, getTerrainHeight(4.8, -11.5) - cabinY + 3.8, 1.0);
      towerBrazierR.scale.set(0.8, 0.8, 0.8);
      chieftainCitadel.add(towerBrazierR);

      tier3Group.add(chieftainCitadel);
      tick();

      // =========================================================================
      // 3 DISTINCT CURATED OUTER DUNGEONS (FIRM GROUNDED FOUNDATIONS & THEMATIC ASSETS)
      // =========================================================================

      // Helper to generate rising atmospheric particles for a dungeon portal
      const createDungeonParticles = (
        count: number,
        color: number,
        size: number,
        spawnRadius: number,
        maxHeight: number
      ) => {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * spawnRadius;
          pos[i * 3 + 1] = 0.2 + Math.random() * maxHeight;
          pos[i * 3 + 2] = (Math.random() - 0.5) * spawnRadius;
          speeds[i] = 0.012 + Math.random() * 0.02;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending
          })
        );
        return { points: pts, pos, speeds, count };
      };

      // -------------------------------------------------------------------------
      // DUNGEON 1: CRYPT OF THE MEMES (SE, Tier 1 - Sunken Mausoleum & Reliquary)
      // -------------------------------------------------------------------------
      const cryptDef = DUNGEONS[0];
      const cryptGroup = new THREE.Group();
      cryptGroup.name = "Dungeon_Crypt";
      const cryptY = getTerrainHeight(cryptDef.position.x, cryptDef.position.z);
      cryptGroup.position.set(cryptDef.position.x, cryptY, cryptDef.position.z);
      cryptGroup.rotation.y = Math.atan2(-cryptDef.position.x, -cryptDef.position.z);
      cryptGroup.visible = currentTierRef.current >= cryptDef.unlockedTier;

      // 1. Ancient Tiered Granite Pedestal (embeds firmly into bedrock)
      const cryptBaseGeo = new THREE.CylinderGeometry(3.6, 4.4, 0.7, 16);
      cryptBaseGeo.translate(0, 0.2, 0);
      const cryptBaseMat = new THREE.MeshStandardMaterial({
        color: 0x1d1822,
        roughness: 0.94,
        metalness: 0.08,
        flatShading: true
      });
      const cryptBase = new THREE.Mesh(cryptBaseGeo, cryptBaseMat);
      cryptBase.receiveShadow = true;
      cryptGroup.add(cryptBase);

      // Flanking Ancient Bedrock Megaliths
      const cryptBedrockL = rockLargeA.clone();
      cryptBedrockL.position.set(-2.3, 0.2, 0.3);
      cryptBedrockL.scale.set(1.5, 1.3, 1.5);
      cryptBedrockL.rotation.y = 0.6;
      cryptGroup.add(cryptBedrockL);

      const cryptBedrockR = rockLargeB.clone();
      cryptBedrockR.position.set(2.3, 0.2, -0.3);
      cryptBedrockR.scale.set(1.5, 1.4, 1.5);
      cryptBedrockR.rotation.y = -0.7;
      cryptGroup.add(cryptBedrockR);

      // Monolithic Standing Stones forming Trilithon Archway
      const cryptColL = rockLargeA.clone();
      cryptColL.position.set(-1.3, 0.6, 0);
      cryptColL.scale.set(1.35, 2.5, 1.35);
      cryptColL.rotation.y = 0.45;
      cryptGroup.add(cryptColL);

      const cryptColR = rockLargeB.clone();
      cryptColR.position.set(1.3, 0.6, 0);
      cryptColR.scale.set(1.4, 2.6, 1.4);
      cryptColR.rotation.y = -0.4;
      cryptGroup.add(cryptColR);

      // Heavy Carved Timber & Stone Arch Lintel
      const cryptLintel = woodStructureModel.clone();
      cryptLintel.position.set(0, 2.6, 0);
      cryptLintel.scale.set(1.35, 0.88, 1.35);
      cryptGroup.add(cryptLintel);

      // Swirling Violet Void Portal
      const cryptPortalGeo = new THREE.CircleGeometry(1.05, 24);
      const cryptPortalMat = new THREE.MeshBasicMaterial({
        color: 0x9333ea,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const cryptPortal = new THREE.Mesh(cryptPortalGeo, cryptPortalMat);
      cryptPortal.position.set(0, 1.45, 0.04);
      cryptGroup.add(cryptPortal);

      const cryptRingGeo = new THREE.RingGeometry(0.85, 1.25, 24);
      const cryptRingMat = new THREE.MeshBasicMaterial({
        color: 0xc026d3,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const cryptRing = new THREE.Mesh(cryptRingGeo, cryptRingMat);
      cryptRing.position.set(0, 1.45, 0.05);
      cryptGroup.add(cryptRing);

      const cryptVoidCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x07020e, side: THREE.DoubleSide })
      );
      cryptVoidCore.position.set(0, 1.45, 0.06);
      cryptGroup.add(cryptVoidCore);

      // Reliquary & Treasure of Fallen Memes
      const cryptChest = pirateChestModel.clone();
      cryptChest.position.set(-1.25, 0.35, 1.35);
      cryptChest.rotation.y = 0.45;
      cryptChest.scale.set(0.85, 0.85, 0.85);
      cryptGroup.add(cryptChest);

      const cryptCoins = miniCoinModel.clone();
      cryptCoins.position.set(-0.95, 0.35, 1.45);
      cryptCoins.scale.set(1.2, 1.2, 1.2);
      cryptGroup.add(cryptCoins);

      const cryptGold = goldCoinModel.clone();
      cryptGold.position.set(-1.15, 0.36, 1.2);
      cryptGold.scale.set(1.1, 1.1, 1.1);
      cryptGroup.add(cryptGold);

      const cryptChalice = chaliceModel.clone();
      cryptChalice.position.set(-0.8, 0.35, 1.15);
      cryptChalice.rotation.z = 0.8;
      cryptChalice.scale.set(0.85, 0.85, 0.85);
      cryptGroup.add(cryptChalice);

      const cryptIronChest = chestModel.clone();
      cryptIronChest.position.set(1.35, 0.35, 1.35);
      cryptIronChest.rotation.y = -0.35;
      cryptIronChest.scale.set(0.8, 0.8, 0.8);
      cryptGroup.add(cryptIronChest);

      // Fallen Hero Relics (Shield, Sword, Spear)
      const cryptShield = roundShieldModel.clone();
      cryptShield.position.set(-1.55, 0.45, 0.7);
      cryptShield.rotation.set(0.2, 0.4, 0.3);
      cryptShield.scale.set(1.2, 1.2, 1.2);
      cryptGroup.add(cryptShield);

      const cryptSword = swordModel.clone();
      cryptSword.position.set(1.05, 0.48, 0.85);
      cryptSword.rotation.set(0.1, 0.2, -0.45);
      cryptSword.scale.set(1.25, 1.25, 1.25);
      cryptGroup.add(cryptSword);

      const cryptSpear = spearModel.clone();
      cryptSpear.position.set(-1.75, 0.4, 1.15);
      cryptSpear.rotation.set(-0.25, 0.2, 0.35);
      cryptSpear.scale.set(1.3, 1.3, 1.3);
      cryptGroup.add(cryptSpear);

      // Twin Cursed Soul Braziers
      const cryptBrazierL = fireBasketModel.clone();
      cryptBrazierL.position.set(-2.3, 0.35, 1.35);
      cryptBrazierL.scale.set(0.85, 0.85, 0.85);
      cryptGroup.add(cryptBrazierL);

      const cryptBrazierR = fireBasketModel.clone();
      cryptBrazierR.position.set(2.3, 0.35, 1.35);
      cryptBrazierR.scale.set(0.85, 0.85, 0.85);
      cryptGroup.add(cryptBrazierR);

      // Flanking Violet Point Light
      const cryptLight = new THREE.PointLight(0xa855f7, 3.8, 11, 1.7);
      cryptLight.position.set(0, 1.7, 0.5);
      cryptGroup.add(cryptLight);

      // Rising Violet Soul Wisps Particle System
      const cryptPartData = createDungeonParticles(35, 0xc084fc, 0.09, 1.2, 2.6);
      cryptGroup.userData = { landmark: "crypt" };
      cryptGroup.traverse((c) => {
        c.userData = { landmark: "crypt" };
      });
      landmarksRef.current.push(cryptGroup);
      scene.add(cryptGroup);
      dungeonGroupsRef.current[cryptDef.id] = cryptGroup;
      animatedDungeonRifts.push({
        id: "crypt",
        portal: cryptPortal,
        ring: cryptRing,
        light: cryptLight,
        particles: cryptPartData.points,
        particlePositions: cryptPartData.pos,
        particleSpeeds: cryptPartData.speeds,
        particleCount: cryptPartData.count
      });

      // -------------------------------------------------------------------------
      // DUNGEON 2: DRAGON'S CHASM (NW, Tier 2 - Volcanic Caldera & Scorched Lair)
      // -------------------------------------------------------------------------
      const chasmDef = DUNGEONS[1];
      const chasmGroup = new THREE.Group();
      chasmGroup.name = "Dungeon_Chasm";
      const chasmY = getTerrainHeight(chasmDef.position.x, chasmDef.position.z);
      chasmGroup.position.set(chasmDef.position.x, chasmY, chasmDef.position.z);
      chasmGroup.rotation.y = Math.atan2(-chasmDef.position.x, -chasmDef.position.z);
      chasmGroup.visible = currentTierRef.current >= chasmDef.unlockedTier;

      // 1. Scorched Volcanic Obsidian Mound
      const chasmBaseGeo = new THREE.CylinderGeometry(3.8, 4.6, 0.72, 16);
      chasmBaseGeo.translate(0, 0.2, 0);
      const chasmBaseMat = new THREE.MeshStandardMaterial({
        color: 0x160a06,
        roughness: 0.96,
        metalness: 0.04,
        flatShading: true
      });
      const chasmBase = new THREE.Mesh(chasmBaseGeo, chasmBaseMat);
      chasmBase.receiveShadow = true;
      chasmGroup.add(chasmBase);

      // Jagged Volcanic Fang Spires
      const chasmSpireL = rockLargeA.clone();
      chasmSpireL.position.set(-2.1, 0.35, -0.8);
      chasmSpireL.scale.set(1.6, 2.7, 1.6);
      chasmSpireL.rotation.set(0.1, 0.4, -0.15);
      chasmGroup.add(chasmSpireL);

      const chasmSpireR = rockLargeB.clone();
      chasmSpireR.position.set(2.0, 0.35, -0.7);
      chasmSpireR.scale.set(1.7, 2.8, 1.7);
      chasmSpireR.rotation.set(0.1, -0.5, 0.2);
      chasmGroup.add(chasmSpireR);

      const chasmFangL = rockSmallA.clone();
      chasmFangL.position.set(-1.6, 0.28, 1.5);
      chasmFangL.scale.set(1.5, 1.9, 1.5);
      chasmFangL.rotation.y = 0.7;
      chasmGroup.add(chasmFangL);

      const chasmFangR = rockLargeB.clone();
      chasmFangR.position.set(1.7, 0.28, 1.5);
      chasmFangR.scale.set(1.4, 2.0, 1.4);
      chasmFangR.rotation.y = -0.6;
      chasmGroup.add(chasmFangR);

      // Scorched Dragon Hoard & Defenses
      const chasmSpikes = trapSpikesModel.clone();
      chasmSpikes.position.set(-2.0, 0.35, 1.9);
      chasmSpikes.rotation.y = 0.4;
      chasmGroup.add(chasmSpikes);

      const chasmBanner = flagPirateModel.clone();
      chasmBanner.position.set(-2.2, 2.1, -0.5);
      chasmBanner.scale.set(1.2, 1.2, 1.2);
      chasmBanner.rotation.y = 0.3;
      chasmGroup.add(chasmBanner);

      const chasmGantry = woodSupportModel.clone();
      chasmGantry.position.set(0, 2.7, 0);
      chasmGantry.scale.set(1.3, 1.0, 1.3);
      chasmGroup.add(chasmGantry);

      const chasmCart = cartModel.clone();
      chasmCart.position.set(1.35, 0.35, 1.3);
      chasmCart.rotation.y = -0.5;
      chasmCart.scale.set(0.9, 0.9, 0.9);
      chasmGroup.add(chasmCart);

      const chasmCartGold = goldCoinModel.clone();
      chasmCartGold.position.set(1.35, 0.7, 1.3);
      chasmCartGold.scale.set(1.3, 1.3, 1.3);
      chasmGroup.add(chasmCartGold);

      const chasmJewel = jewelModel.clone();
      chasmJewel.position.set(1.05, 0.38, 1.55);
      chasmJewel.scale.set(1.15, 1.15, 1.15);
      chasmGroup.add(chasmJewel);

      // Molten Core Fissure Portal
      const chasmPortalGeo = new THREE.CircleGeometry(1.15, 24);
      const chasmPortalMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const chasmPortal = new THREE.Mesh(chasmPortalGeo, chasmPortalMat);
      chasmPortal.position.set(0, 1.5, 0.04);
      chasmGroup.add(chasmPortal);

      const chasmRingGeo = new THREE.RingGeometry(0.9, 1.35, 24);
      const chasmRingMat = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const chasmRing = new THREE.Mesh(chasmRingGeo, chasmRingMat);
      chasmRing.position.set(0, 1.5, 0.05);
      chasmGroup.add(chasmRing);

      const chasmInfernoCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.75, 24),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
      );
      chasmInfernoCore.position.set(0, 1.5, 0.06);
      chasmGroup.add(chasmInfernoCore);

      // Roaring Twin Flame Braziers
      const chasmBrazierL = fireBasketModel.clone();
      chasmBrazierL.position.set(-2.5, 0.38, 1.45);
      chasmBrazierL.scale.set(0.9, 0.9, 0.9);
      chasmGroup.add(chasmBrazierL);

      const chasmBrazierR = fireBasketModel.clone();
      chasmBrazierR.position.set(2.5, 0.38, 1.45);
      chasmBrazierR.scale.set(0.9, 0.9, 0.9);
      chasmGroup.add(chasmBrazierR);

      // Intense Crimson Firelight
      const chasmLight = new THREE.PointLight(0xff3300, 4.8, 13, 1.6);
      chasmLight.position.set(0, 1.8, 0.5);
      chasmGroup.add(chasmLight);

      // Rising Volcanic Cinders Particle System
      const chasmPartData = createDungeonParticles(45, 0xff6b22, 0.11, 1.4, 2.8);
      chasmGroup.userData = { landmark: "chasm" };
      chasmGroup.traverse((c) => {
        c.userData = { landmark: "chasm" };
      });
      landmarksRef.current.push(chasmGroup);
      scene.add(chasmGroup);
      dungeonGroupsRef.current[chasmDef.id] = chasmGroup;
      animatedDungeonRifts.push({
        id: "chasm",
        portal: chasmPortal,
        ring: chasmRing,
        light: chasmLight,
        particles: chasmPartData.points,
        particlePositions: chasmPartData.pos,
        particleSpeeds: chasmPartData.speeds,
        particleCount: chasmPartData.count
      });

      // -------------------------------------------------------------------------
      // DUNGEON 3: VOID MINE (Far-West, Tier 3 - Arcane Crystal Extraction Quarry)
      // -------------------------------------------------------------------------
      const voidDef = DUNGEONS[2];
      const voidGroup = new THREE.Group();
      voidGroup.name = "Dungeon_VoidMine";
      const voidY = getTerrainHeight(voidDef.position.x, voidDef.position.z);
      voidGroup.position.set(voidDef.position.x, voidY, voidDef.position.z);
      voidGroup.rotation.y = Math.atan2(-voidDef.position.x, -voidDef.position.z);
      voidGroup.visible = currentTierRef.current >= voidDef.unlockedTier;

      // 1. Excavated Quarry Shelf Foundation
      const voidBaseGeo = new THREE.CylinderGeometry(3.6, 4.4, 0.68, 16);
      voidBaseGeo.translate(0, 0.2, 0);
      const voidBaseMat = new THREE.MeshStandardMaterial({
        color: 0x141f26,
        roughness: 0.92,
        metalness: 0.08,
        flatShading: true
      });
      const voidBase = new THREE.Mesh(voidBaseGeo, voidBaseMat);
      voidBase.receiveShadow = true;
      voidGroup.add(voidBase);

      // Heavy Industrial Timber Headframe & Staging Platform
      const voidGantry = woodStructureModel.clone();
      voidGantry.position.set(0, 1.6, 0);
      voidGantry.scale.set(1.3, 1.35, 1.3);
      voidGroup.add(voidGantry);

      const voidPlanks = platformPlanks.clone();
      voidPlanks.position.set(0, 0.35, 1.25);
      voidPlanks.scale.set(1.2, 1.0, 1.2);
      voidGroup.add(voidPlanks);

      const voidFence = fortifiedFenceModel.clone();
      voidFence.position.set(-2.2, 0.35, 0.5);
      voidFence.rotation.y = 1.3;
      voidFence.scale.set(0.85, 0.85, 0.85);
      voidGroup.add(voidFence);

      // Massive Radiant Cyan Mana Crystals
      const voidCrystal1 = crystalModel.clone();
      voidCrystal1.position.set(1.5, 0.45, -0.6);
      voidCrystal1.scale.set(1.8, 2.3, 1.8);
      voidCrystal1.rotation.set(0.15, 0.4, 0.15);
      voidGroup.add(voidCrystal1);

      const voidCrystal2 = crystalModel.clone();
      voidCrystal2.position.set(-1.6, 0.4, 0.8);
      voidCrystal2.scale.set(1.4, 1.8, 1.4);
      voidCrystal2.rotation.set(-0.2, -0.5, 0.1);
      voidGroup.add(voidCrystal2);

      const voidCrystal3 = crystalModel.clone();
      voidCrystal3.position.set(0.9, 0.35, 1.6);
      voidCrystal3.scale.set(1.2, 1.4, 1.2);
      voidCrystal3.rotation.y = 0.8;
      voidGroup.add(voidCrystal3);

      // Mining Infrastructure (Ore Cart, Pickaxe, Ore chunks, Barrels)
      const voidCart = cartModel.clone();
      voidCart.position.set(-1.1, 0.38, 1.55);
      voidCart.rotation.y = 0.3;
      voidCart.scale.set(0.95, 0.95, 0.95);
      voidGroup.add(voidCart);

      const voidCartOre1 = oreStoneModel.clone();
      voidCartOre1.position.set(-1.1, 0.72, 1.55);
      voidCartOre1.scale.set(1.2, 1.2, 1.2);
      voidGroup.add(voidCartOre1);

      const voidCartOre2 = oreStoneModel.clone();
      voidCartOre2.position.set(-1.25, 0.75, 1.35);
      voidCartOre2.scale.set(1.0, 1.0, 1.0);
      voidGroup.add(voidCartOre2);

      const voidFloorOre = oreStoneModel.clone();
      voidFloorOre.position.set(1.2, 0.36, 1.4);
      voidFloorOre.scale.set(1.1, 1.1, 1.1);
      voidGroup.add(voidFloorOre);

      const voidPickaxe = pickaxeModel.clone();
      voidPickaxe.position.set(1.1, 0.65, -0.2);
      voidPickaxe.rotation.set(0.3, 0.2, -0.7);
      voidPickaxe.scale.set(1.3, 1.3, 1.3);
      voidGroup.add(voidPickaxe);

      const voidBarrel = barrelModel.clone();
      voidBarrel.position.set(-1.7, 0.35, 1.65);
      voidBarrel.scale.set(0.8, 0.8, 0.8);
      voidGroup.add(voidBarrel);

      const voidCrate = crateModel.clone();
      voidCrate.position.set(1.6, 0.35, 1.2);
      voidCrate.scale.set(0.7, 0.7, 0.7);
      voidGroup.add(voidCrate);

      // Dimensional Void Rift Vortex
      const voidPortalGeo = new THREE.CircleGeometry(1.05, 24);
      const voidPortalMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const voidPortal = new THREE.Mesh(voidPortalGeo, voidPortalMat);
      voidPortal.position.set(0, 1.45, 0.04);
      voidGroup.add(voidPortal);

      const voidRingGeo = new THREE.RingGeometry(0.85, 1.25, 24);
      const voidRingMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const voidRing = new THREE.Mesh(voidRingGeo, voidRingMat);
      voidRing.position.set(0, 1.45, 0.05);
      voidGroup.add(voidRing);

      const voidCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x021622, side: THREE.DoubleSide })
      );
      voidCore.position.set(0, 1.45, 0.06);
      voidGroup.add(voidCore);

      // Brilliant Cyan Quarry Spotlight
      const voidLight = new THREE.PointLight(0x00e5ff, 4.4, 12, 1.6);
      voidLight.position.set(0, 1.75, 0.5);
      voidGroup.add(voidLight);

      // Rising Cyan Mana Sparks Particle System
      const voidPartData = createDungeonParticles(35, 0x22d3ee, 0.08, 1.2, 2.6);
      voidGroup.userData = { landmark: "voidmine" };
      voidGroup.traverse((c) => {
        c.userData = { landmark: "voidmine" };
      });
      landmarksRef.current.push(voidGroup);
      scene.add(voidGroup);
      dungeonGroupsRef.current[voidDef.id] = voidGroup;
      animatedDungeonRifts.push({
        id: "voidmine",
        portal: voidPortal,
        ring: voidRing,
        light: voidLight,
        particles: voidPartData.points,
        particlePositions: voidPartData.pos,
        particleSpeeds: voidPartData.speeds,
        particleCount: voidPartData.count
      });

      tick();

      setIsLoaded(true);
      if (onLoaded) onLoaded();
    };

    buildAscensionWorld();

    // 7. Interaction Listeners
    let lastHoverCheck = 0;
    const handleMouseDown = (e: MouseEvent) => {
      isIntroFlyInRef.current = false;
      isDraggingRef.current = true;
      setHoveredGoblin(null);
      prevMousePos.current = { x: e.clientX, y: e.clientY };
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        setHoveredGoblin(null);
        const dx = e.clientX - prevMousePos.current.x;
        const dy = e.clientY - prevMousePos.current.y;

        sphericalRef.current.theta -= dx * 0.0055;
        sphericalRef.current.phi -= dy * 0.0055;
        sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.08, sphericalRef.current.phi));

        prevMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Throttled raycasting for hover tooltip & pointer cursor (~50ms)
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      if (!cameraRef.current || !rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const clickableGoblins = populationSystemRef.current?.getClickableObjects() || [];
      const clickableLandmarks = landmarksRef.current || [];
      const intersects = raycaster.intersectObjects([...clickableGoblins, ...clickableLandmarks], true);

      let isInteractive = false;
      if (intersects.length > 0) {
        let cur: THREE.Object3D | null = intersects[0].object;
        let foundId: string | null = null;
        let foundLandmark: string | null = null;
        while (cur && !foundId && !foundLandmark) {
          if (cur.userData?.goblinId) foundId = cur.userData.goblinId;
          if (cur.userData?.landmark) foundLandmark = cur.userData.landmark;
          cur = cur.parent;
        }

        if (foundId || foundLandmark) {
          isInteractive = true;
        }

        if (foundId) {
          const agent = populationSystemRef.current?.getAgentByEntityId(foundId);
          if (agent) {
            const headPos = agent.mesh.position.clone();
            headPos.y += 1.4;
            headPos.project(cameraRef.current);
            if (headPos.z < 1) {
              const sx = ((headPos.x + 1) * rect.width) / 2 + rect.left;
              const sy = ((-headPos.y + 1) * rect.height) / 2 + rect.top;
              setHoveredGoblin({
                id: agent.entity.id,
                displayName: agent.entity.displayName,
                role: agent.entity.role,
                status: agent.entity.status,
                activity: agent.entity.activity,
                balance: agent.entity.balance,
                lootEth: agent.entity.strategyDNA?.totalLootEth ?? (0.005 + (agent.entity.balance / 10000) * 0.015),
                raids: agent.entity.strategyDNA?.raidsCount ?? Math.floor(agent.entity.balance / 300) + 1,
                screenX: Math.max(20, Math.min(window.innerWidth - 220, sx)),
                screenY: Math.max(60, Math.min(window.innerHeight - 150, sy))
              });
              if (rendererRef.current) rendererRef.current.domElement.style.cursor = "pointer";
              return;
            }
          }
        }
      }
      setHoveredGoblin(null);
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = isInteractive ? "pointer" : "default";
      }
    };

    const handleMouseLeave = () => {
      setHoveredGoblin(null);
      if (rendererRef.current) rendererRef.current.domElement.style.cursor = "default";
    };

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingRef.current = false;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
      if (moveDist < 6 && cameraRef.current && rendererRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const clickableGoblins = populationSystemRef.current?.getClickableObjects() || [];
        const clickableLandmarks = landmarksRef.current || [];
        const intersects = raycaster.intersectObjects([...clickableGoblins, ...clickableLandmarks], true);
        if (intersects.length > 0) {
          let cur: THREE.Object3D | null = intersects[0].object;
          let foundId: string | null = null;
          let foundLandmark: string | null = null;
          while (cur && !foundId && !foundLandmark) {
            if (cur.userData?.goblinId) foundId = cur.userData.goblinId;
            if (cur.userData?.landmark) foundLandmark = cur.userData.landmark;
            cur = cur.parent;
          }
          if (foundId) {
            const agent = populationSystemRef.current?.getAgentByEntityId(foundId);
            if (agent) {
              setSelectedGoblin({ ...agent.entity });
              selectedGoblinRef.current = { ...agent.entity };
            }
          } else if (foundLandmark) {
            if (foundLandmark === "pyre") {
              applyPreset("camp");
              triggerPyreBurnEffect(0);
              addFloatingBubble("Sacred Campfire Pyre · Burn $HOARD", "burn");
            } else if (foundLandmark === "chieftain") {
              applyPreset("chieftain");
              setActiveRightTab("chieftain");
              setSelectedGoblin(null);
              addFloatingBubble("High Chieftain Grimjaw · Vigil of the Hoard", "buy");
            } else if (foundLandmark === "crypt" || foundLandmark === "chasm" || foundLandmark === "voidmine") {
              applyPreset(foundLandmark as "crypt" | "chasm" | "voidmine");
              setActiveRightTab("dungeons");
              setSelectedGoblin(null);
            }
          }
        }
      }
    };

    // Mobile Touch Navigation (1-finger orbit, 2-finger pinch zoom)
    let initialTouchDist = 0;
    let touchStartPos = { x: 0, y: 0 };
    let isTouchDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      isIntroFlyInRef.current = false;
      if (e.touches.length === 1) {
        isTouchDragging = true;
        isTouchDraggingRef.current = true;
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        prevMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isTouchDragging = false;
        isTouchDraggingRef.current = false;
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isTouchDragging) {
        const dx = e.touches[0].clientX - prevMousePos.current.x;
        const dy = e.touches[0].clientY - prevMousePos.current.y;
        sphericalRef.current.theta -= dx * 0.006;
        sphericalRef.current.phi -= dy * 0.006;
        sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.08, sphericalRef.current.phi));
        prevMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = initialTouchDist - currentDist;
        sphericalRef.current.radius += diff * 0.035;
        sphericalRef.current.radius = Math.max(4.5, Math.min(50, sphericalRef.current.radius));
        initialTouchDist = currentDist;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTouchDragging && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const moveDist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
        if (moveDist < 10 && cameraRef.current && rendererRef.current) {
          const rect = rendererRef.current.domElement.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((touch.clientX - rect.left) / rect.width) * 2 - 1,
            -((touch.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);
          const clickableGoblins = populationSystemRef.current?.getClickableObjects() || [];
          const clickableLandmarks = landmarksRef.current || [];
          const intersects = raycaster.intersectObjects([...clickableGoblins, ...clickableLandmarks], true);
          if (intersects.length > 0) {
            let cur: THREE.Object3D | null = intersects[0].object;
            let foundId: string | null = null;
            let foundLandmark: string | null = null;
            while (cur && !foundId && !foundLandmark) {
              if (cur.userData?.goblinId) foundId = cur.userData.goblinId;
              if (cur.userData?.landmark) foundLandmark = cur.userData.landmark;
              cur = cur.parent;
            }
            if (foundId) {
              const agent = populationSystemRef.current?.getAgentByEntityId(foundId);
              if (agent) {
                setSelectedGoblin({ ...agent.entity });
                selectedGoblinRef.current = { ...agent.entity };
              }
            } else if (foundLandmark) {
              if (foundLandmark === "pyre") {
                applyPreset("camp");
                triggerPyreBurnEffect(0);
                addFloatingBubble("Sacred Campfire Pyre · Burn $HOARD", "burn");
              } else if (foundLandmark === "chieftain") {
                applyPreset("chieftain");
                setActiveRightTab("chieftain");
                setSelectedGoblin(null);
                addFloatingBubble("High Chieftain Grimjaw · Vigil of the Hoard", "buy");
              } else if (foundLandmark === "crypt" || foundLandmark === "chasm" || foundLandmark === "voidmine") {
                applyPreset(foundLandmark as "crypt" | "chasm" | "voidmine");
                setActiveRightTab("dungeons");
                setSelectedGoblin(null);
              }
            }
          }
        }
      }
      isTouchDragging = false;
      isTouchDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      isIntroFlyInRef.current = false;
      sphericalRef.current.radius += e.deltaY * 0.02;
      sphericalRef.current.radius = Math.max(4.5, Math.min(50, sphericalRef.current.radius));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === "r" || e.key === "R") {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          followRandomGoblin();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", handleResize);

    // 8. Render & Animation Loop (ZERO REACT SETSTATE PER FRAME)
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // High Chieftain & Goblins update
      if (chieftainMixerRef.current) chieftainMixerRef.current.update(delta);
      if (populationSystemRef.current) populationSystemRef.current.update(delta);

      // Cinematic Fly-In Arc on Initial Load
      if (isIntroFlyInRef.current) {
        introProgressRef.current += delta / 2.4;
        const t = Math.min(1.0, introProgressRef.current);
        const ease = 1 - Math.pow(1 - t, 3);
        sphericalRef.current.radius = THREE.MathUtils.lerp(42.0, 13.5, ease);
        sphericalRef.current.phi = THREE.MathUtils.lerp(0.38, 1.22, ease);
        sphericalRef.current.theta = THREE.MathUtils.lerp(0.15, 0.55, ease);
        if (t >= 1.0) {
          isIntroFlyInRef.current = false;
        }
      }

      // Camera navigation
      if (navModeRef.current === "orbit") {
        if (!isDraggingRef.current && !isTouchDraggingRef.current && !isIntroFlyInRef.current) {
          sphericalRef.current.theta += delta * 0.09;
        }
      } else if (navModeRef.current === "fly") {
        const flySpeed = 7.0 * delta;
        const forward = new THREE.Vector3(-Math.sin(sphericalRef.current.theta), 0, -Math.cos(sphericalRef.current.theta));
        const right = new THREE.Vector3(Math.cos(sphericalRef.current.theta), 0, -Math.sin(sphericalRef.current.theta));
        if (keysPressed.current["w"]) lookTargetRef.current.addScaledVector(forward, flySpeed);
        if (keysPressed.current["s"]) lookTargetRef.current.addScaledVector(forward, -flySpeed);
        if (keysPressed.current["a"]) lookTargetRef.current.addScaledVector(right, -flySpeed);
        if (keysPressed.current["d"]) lookTargetRef.current.addScaledVector(right, flySpeed);
      } else if (navModeRef.current === "follow") {
        let targetAgent: GoblinAgent | undefined;
        if (selectedGoblinRef.current) {
          targetAgent = populationSystemRef.current?.getAgentByEntityId(selectedGoblinRef.current.id);
        }
        if (!targetAgent && populationSystemRef.current && populationSystemRef.current.goblins.length > 0) {
          const raider = populationSystemRef.current.goblins.find((g) => g.isRaiding);
          targetAgent = raider || populationSystemRef.current.goblins[0];
          if (targetAgent) {
            setSelectedGoblin({ ...targetAgent.entity });
            selectedGoblinRef.current = { ...targetAgent.entity };
          }
        }
        if (targetAgent) {
          const gp = targetAgent.mesh.position;
          // Smoothly track the goblin's real-time position in 3D space
          lookTargetRef.current.lerp(
            new THREE.Vector3(gp.x, gp.y + 0.65, gp.z),
            delta * 8.0
          );
          // Gently hold third-person follow distance
          sphericalRef.current.radius = THREE.MathUtils.lerp(
            sphericalRef.current.radius,
            5.2,
            delta * 3.5
          );
          sphericalRef.current.phi = THREE.MathUtils.lerp(
            sphericalRef.current.phi,
            1.22,
            delta * 3.5
          );
        }
      }

      // Pyre flare and campfire light flicker
      if (pyreFlareTimerRef.current > 0) {
        pyreFlareTimerRef.current = Math.max(0, pyreFlareTimerRef.current - delta);
      }
      const flareRatio = Math.min(1.0, pyreFlareTimerRef.current / 1.4);

      if (campfireLightRef.current) {
        const baseIntensity = 5.6 + Math.sin(elapsedTime * 14) * 0.45 + Math.sin(elapsedTime * 31) * 0.25;
        campfireLightRef.current.intensity = THREE.MathUtils.lerp(
          campfireLightRef.current.intensity,
          baseIntensity + flareRatio * 10.5,
          delta * 4.0
        );
      }

      if (flameMeshRef.current) {
        const baseScaleY = 1.0 + Math.sin(elapsedTime * 18) * 0.12;
        const baseScaleX = 1.0 + Math.cos(elapsedTime * 14) * 0.08;
        flameMeshRef.current.scale.y = THREE.MathUtils.lerp(
          flameMeshRef.current.scale.y,
          baseScaleY + flareRatio * 2.6,
          delta * 4.5
        );
        flameMeshRef.current.scale.x = THREE.MathUtils.lerp(
          flameMeshRef.current.scale.x,
          baseScaleX + flareRatio * 1.1,
          delta * 4.5
        );
        flameMeshRef.current.scale.z = flameMeshRef.current.scale.x;
        flameMeshRef.current.rotation.y = elapsedTime * (2.5 + flareRatio * 5.0);
      }

      // Animate Treasury Hoard growth & sparkle glints
      if (goldMoundMeshRef.current) {
        // Clamp hoard scaling cleanly so it never intrudes on neighboring roads or the castle
        const targetS = Math.min(1.35, hoardScaleTargetRef.current);
        goldMoundMeshRef.current.scale.lerp(
          new THREE.Vector3(targetS, 1.0 + (targetS - 1.0) * 0.15, targetS),
          delta * 3.5
        );
      }
      if (hoardLightRef.current) {
        hoardLightRef.current.intensity = THREE.MathUtils.lerp(
          hoardLightRef.current.intensity,
          1.4 + Math.sin(elapsedTime * 4) * 0.2,
          delta * 2.5
        );
      }
      if (hoardGlintsRef.current) {
        hoardGlintsRef.current.rotation.y += delta * 0.35;
      }

      // Animate embers
      const emberArray = emberGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < emberCount; i++) {
        emberArray[i * 3 + 1] += emberSpeed[i];
        emberArray[i * 3] += Math.sin(elapsedTime * 4 + i) * 0.003;
        if (emberArray[i * 3 + 1] > 2.6) {
          emberArray[i * 3 + 1] = 0.25;
          emberArray[i * 3] = (Math.random() - 0.5) * 0.8;
          emberArray[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        }
      }
      emberGeo.attributes.position.needsUpdate = true;

      // Animate Enchanted Night Fireflies
      const ffPos = fireflyGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < fireflyCount; i++) {
        const speed = fireflySpeeds[i];
        const phase = fireflyPhases[i];
        const bx = fireflyBasePos[i * 3];
        const by = fireflyBasePos[i * 3 + 1];
        const bz = fireflyBasePos[i * 3 + 2];

        // Smooth sinusoidal 3D orbital bobbing
        ffPos[i * 3] = bx + Math.sin(elapsedTime * speed * 0.6 + phase) * 0.7;
        ffPos[i * 3 + 1] = by + Math.sin(elapsedTime * speed * 1.2 + phase * 1.5) * 0.35 + Math.cos(elapsedTime * 0.4 + phase) * 0.15;
        ffPos[i * 3 + 2] = bz + Math.cos(elapsedTime * speed * 0.7 + phase) * 0.7;
      }
      fireflyGeo.attributes.position.needsUpdate = true;
      fireflyMat.opacity = 0.65 + Math.sin(elapsedTime * 3.5) * 0.25;

      // Animate Outer Dungeon Rifts & Atmospheric Particles
      animatedDungeonRifts.forEach((rift) => {
        const isDungeonUnlocked = currentTierRef.current >= (rift.id === "crypt" ? 1 : rift.id === "chasm" ? 2 : 3);
        if (!isDungeonUnlocked) return;

        // Rotate swirling portal disks
        rift.portal.rotation.z = rift.id === "chasm" ? -elapsedTime * 0.45 : elapsedTime * 0.4;
        if (rift.ring) {
          rift.ring.rotation.z = rift.id === "chasm" ? elapsedTime * 0.7 : -elapsedTime * 0.6;
        }

        // Realistic light pulse
        const freq = rift.id === "chasm" ? 11 : 7;
        rift.light.intensity = THREE.MathUtils.lerp(
          rift.light.intensity,
          (rift.id === "chasm" ? 4.4 : 3.6) + Math.sin(elapsedTime * freq) * 0.6,
          delta * 2.8
        );

        // Animate particles
        const posArr = rift.particlePositions;
        for (let i = 0; i < rift.particleCount; i++) {
          posArr[i * 3 + 1] += rift.particleSpeeds[i];
          posArr[i * 3] += Math.sin(elapsedTime * 3 + i) * 0.0025;
          if (posArr[i * 3 + 1] > 2.6) {
            posArr[i * 3 + 1] = 0.2;
            posArr[i * 3] = (Math.random() - 0.5) * 1.1;
            posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
          }
        }
        rift.particles.geometry.attributes.position.needsUpdate = true;
      });

      // Camera lerp
      const cam = cameraRef.current;
      if (cam) {
        const { radius, theta, phi } = sphericalRef.current;
        const targetPos = new THREE.Vector3(
          lookTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta),
          lookTargetRef.current.y + radius * Math.cos(phi),
          lookTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta)
        );
        cam.position.lerp(targetPos, 0.08);
        cam.lookAt(lookTargetRef.current);

        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;

        // DIRECT DOM UPDATES FOR 3D BADGES (ZERO React Overhead)
        if (chieftainTagRef.current) {
          const chiefWorldPos = new THREE.Vector3(0, getTerrainHeight(0, -2.2) + 1.95, -2.2);
          chiefWorldPos.project(cam);
          if (chiefWorldPos.z < 1) {
            const sx = ((chiefWorldPos.x + 1) * w) / 2;
            const sy = ((-chiefWorldPos.y + 1) * h) / 2;
            chieftainTagRef.current.style.display = "block";
            chieftainTagRef.current.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
          } else {
            chieftainTagRef.current.style.display = "none";
          }
        }

        if (pyreTagRef.current) {
          const pyreWorldPos = new THREE.Vector3(0, 1.45, 0);
          pyreWorldPos.project(cam);
          if (pyreWorldPos.z < 1) {
            const sx = ((pyreWorldPos.x + 1) * w) / 2;
            const sy = ((-pyreWorldPos.y + 1) * h) / 2;
            pyreTagRef.current.style.display = "block";
            pyreTagRef.current.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
          } else {
            pyreTagRef.current.style.display = "none";
          }
        }

        DUNGEONS.forEach((d) => {
          const el = dungeonTagRefs.current[d.id];
          if (!el) return;
          if (currentTierRef.current < d.unlockedTier) {
            el.style.display = "none";
            return;
          }
          const dPos = new THREE.Vector3(d.position.x, getTerrainHeight(d.position.x, d.position.z) + 2.4, d.position.z);
          dPos.project(cam);
          if (dPos.z < 1) {
            const sx = ((dPos.x + 1) * w) / 2;
            const sy = ((-dPos.y + 1) * h) / 2;
            el.style.display = "block";
            el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
          } else {
            el.style.display = "none";
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", handleResize);
      if (audioCtxRef.current) audioCtxRef.current.close();
      renderer.dispose();
    };
  }, []); // Run once! Never restart scene on navMode or milestone clicks!

  // Lighting Toggle
  useEffect(() => {
    if (!sceneRef.current) return;
    if (isDayMode) {
      sceneRef.current.background = new THREE.Color(0x352818);
      if (sceneRef.current.fog) (sceneRef.current.fog as THREE.FogExp2).color.setHex(0x352818);
      ambientLightRef.current?.color.setHex(0xffecc6);
      if (ambientLightRef.current) ambientLightRef.current.intensity = 1.6;
      moonLightRef.current?.color.setHex(0xffc570);
    } else {
      sceneRef.current.background = new THREE.Color(0x070b10);
      if (sceneRef.current.fog) (sceneRef.current.fog as THREE.FogExp2).color.setHex(0x070b10);
      ambientLightRef.current?.color.setHex(0x152232);
      if (ambientLightRef.current) ambientLightRef.current.intensity = 1.1;
      moonLightRef.current?.color.setHex(0x4a7c9f);
    }
  }, [isDayMode]);

  // Radial Ring calculation for Next Goblin (0.003 ETH)
  const feeRemainder = Number((creatorFees % FEE_PER_GOBLIN).toFixed(4));
  const nextGoblinPercent = Math.min(100, Math.round((feeRemainder / FEE_PER_GOBLIN) * 100));
  const strokeDash = 88;
  const strokeOffset = strokeDash - (strokeDash * nextGoblinPercent) / 100;

  // Filter live feed items
  const filteredFeed = feedItems.filter((item) => {
    if (activeFeedTab === "all") return true;
    return item.type === activeFeedTab;
  });

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#070b10] text-[#e6ded5] font-sans">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Cinematic Vignette */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(4,6,9,0.7)] z-10" />

      {/* Spectator Follow Mode Pill */}
      {navMode === "follow" && selectedGoblin && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-panel border border-amber-500/50 shadow-2xl font-mono text-xs text-amber-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
          <span>
            Spectating: <strong className="text-white">{selectedGoblin.displayName}</strong> ({selectedGoblin.role})
          </span>
          <button
            onClick={() => followRandomGoblin()}
            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 font-bold transition-all"
            title="Press R on keyboard to cycle"
          >
            🎲 Next (R)
          </button>
          <button
            onClick={() => setNavMode("orbit")}
            className="text-[10px] text-gray-400 hover:text-white ml-0.5 font-bold"
            title="Exit follow mode"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#070b10] flex flex-col items-center justify-center gap-4 z-50">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          <div className="flex flex-col items-center gap-1.5 font-mono">
            <span className="text-sm font-bold text-amber-400 tracking-wider">IGNITING THE CAMPFIRE PYRE</span>
            <span className="text-xs text-gray-500">Assembling Ascension Tiers &amp; Dungeons ({loadProgress}%)</span>
          </div>
        </div>
      )}

      {/* 3D In-World Projected Badges (Direct DOM Transform - ZERO Re-render Overhead) */}
      <div
        ref={chieftainTagRef}
        style={{ display: "none" }}
        className="absolute top-0 left-0 pointer-events-auto cursor-pointer z-20 group"
        onClick={() => applyPreset("chieftain")}
      >
        <div className="px-3 py-1 rounded-full glass-panel border border-amber-500/60 shadow-xl flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:border-amber-400 hover:scale-105 transition-all">
          <span>👑</span>
          <span className="tracking-wide">HIGH CHIEFTAIN</span>
        </div>
      </div>

      <div
        ref={pyreTagRef}
        style={{ display: "none" }}
        className="absolute top-0 left-0 pointer-events-auto cursor-pointer z-20 group"
        onClick={() => applyPreset("camp")}
      >
        <div className="px-3.5 py-1.5 rounded-full glass-panel border border-orange-500/70 shadow-2xl flex items-center gap-2 text-xs font-black text-amber-200 hover:border-orange-400 hover:scale-105 transition-all">
          <span className="text-sm animate-pulse">🔥</span>
          <span className="tracking-wider">
            BURN PYRE · {burnedHoard > 1000000 ? `${(burnedHoard / 1000000).toFixed(2)}M` : burnedHoard.toLocaleString()}
          </span>
        </div>
      </div>

      {DUNGEONS.map((dungeon) => (
        <div
          key={dungeon.id}
          ref={(el) => {
            dungeonTagRefs.current[dungeon.id] = el;
          }}
          style={{ display: "none" }}
          className="absolute top-0 left-0 pointer-events-auto cursor-pointer z-20 group"
          onClick={() => {
            applyPreset(dungeon.id as "crypt" | "chasm" | "voidmine");
            setActiveRightTab("dungeons");
          }}
        >
          <div
            className={`px-3 py-1 rounded-full glass-panel shadow-xl flex items-center gap-1.5 text-[10px] font-bold border transition-all hover:scale-105 ${
              dungeon.id === "crypt"
                ? "border-purple-500/70 text-purple-300"
                : dungeon.id === "chasm"
                ? "border-red-500/70 text-rose-300"
                : "border-cyan-500/70 text-cyan-300"
            }`}
          >
            <span>⚔️</span>
            <span>{dungeon.name.toUpperCase()}</span>
            <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px]">{dungeon.tickers.length} Targets</span>
          </div>
        </div>
      ))}

      {/* Floating 3D Event Notification Bubbles */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center gap-2">
        {eventBubbles.slice(-3).map((bubble) => {
          const cleanText = bubble.text.replace(/^[^\w\s+$-]+/, "").trim();
          const category =
            bubble.type === "burn"
              ? "SACRIFICE"
              : bubble.type === "raid"
              ? "RAID"
              : bubble.type === "buy"
              ? "TRIBUTE"
              : bubble.type === "brain"
              ? "EVOLUTION"
              : "ASCENSION";

          const bubbleStyle =
            bubble.type === "burn"
              ? "border-orange-500/60 text-orange-200 shadow-[0_4px_24px_rgba(249,115,22,0.25)]"
              : bubble.type === "raid"
              ? "border-rose-500/60 text-rose-200 shadow-[0_4px_24px_rgba(244,63,94,0.25)]"
              : bubble.type === "buy"
              ? "border-amber-400/60 text-amber-200 shadow-[0_4px_24px_rgba(251,191,36,0.25)]"
              : bubble.type === "brain"
              ? "border-purple-500/60 text-purple-200 shadow-[0_4px_24px_rgba(168,85,247,0.25)]"
              : "border-yellow-400/70 text-yellow-200 shadow-[0_4px_24px_rgba(250,204,21,0.3)]";

          const dotColor =
            bubble.type === "burn"
              ? "bg-orange-400"
              : bubble.type === "raid"
              ? "bg-rose-400"
              : bubble.type === "buy"
              ? "bg-amber-400"
              : bubble.type === "brain"
              ? "bg-purple-400"
              : "bg-yellow-300";

          return (
            <div
              key={bubble.id}
              className={`animate-float-bubble px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border ${bubbleStyle} flex items-center gap-2 text-xs font-medium tracking-wide shadow-2xl`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse flex-shrink-0`} />
              <span className="text-[9.5px] uppercase font-bold tracking-[0.08em] opacity-80 flex-shrink-0">
                {category}
              </span>
              <span className="w-px h-2.5 bg-white/20 flex-shrink-0" />
              <span className="font-semibold text-zinc-100 whitespace-nowrap">
                {cleanText}
              </span>
            </div>
          );
        })}
      </div>

      {isLoaded && (
        <>
          {/* 0. IN-WORLD HOVER CARD TOOLTIP (RESTRAINED TACTICAL DOSSIER) */}
          {hoveredGoblin && !selectedGoblin && (
            <div
              className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-full transition-all duration-75"
              style={{ left: hoveredGoblin.screenX, top: hoveredGoblin.screenY - 14 }}
            >
              <div className="w-64 rounded-lg glass-panel border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-3 flex flex-col gap-2 font-sans">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src="/goblin-logo.png"
                      alt={hoveredGoblin.displayName}
                      className="w-6 h-6 object-contain flex-shrink-0"
                    />
                    <span className="text-zinc-100 font-bold text-xs truncate">
                      {hoveredGoblin.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-mono font-semibold border border-white/10 flex-shrink-0">
                    {hoveredGoblin.id}
                  </span>
                </div>

                <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <span className="truncate text-zinc-300">{hoveredGoblin.activity}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 glass-panel-sub rounded p-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block uppercase font-medium text-[8.5px] tracking-[0.08em]">Balance</span>
                    <span className="text-zinc-100 font-mono font-bold text-[11px] truncate block mt-0.5 tabular-nums">
                      {hoveredGoblin.balance.toLocaleString()} $H
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase font-medium text-[8.5px] tracking-[0.08em]">Loot home</span>
                    <span className="text-amber-300 font-mono font-bold text-[11px] truncate block mt-0.5 tabular-nums">
                      {hoveredGoblin.lootEth.toFixed(4)} ETH
                    </span>
                  </div>
                </div>

                <div className="text-[9.5px] text-zinc-400 text-center font-medium tracking-wide flex items-center justify-center gap-1.5 pt-1 border-t border-white/[0.06]">
                  <Crosshair className="w-3 h-3 text-zinc-400" />
                  <span>Click to inspect &amp; lock camera</span>
                </div>
              </div>
            </div>
          )}

          {/* 1. TOP LEFT: BRAND & WARBAND ATTACK / MIGRATION CARD */}
          <div className="absolute top-4 left-4 z-30 pointer-events-auto flex flex-col gap-2.5 font-sans">
            {/* Card 1: Brand & Attack / Migration Status */}
            <div className="w-[calc(100vw-2rem)] sm:w-[360px] rounded-lg glass-panel p-3.5 flex flex-col gap-2.5">
              {/* Brand Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/goblin-logo.png"
                    alt="The Hoard Logo"
                    className="w-8 h-8 object-contain"
                  />
                  <div className="flex flex-col">
                    <h1 className="font-bold text-base tracking-[0.08em] text-zinc-100 leading-none">
                      THE HOARD
                    </h1>
                    <span className="text-[9px] font-semibold text-zinc-400 tracking-[0.1em] uppercase mt-0.5">
                      ROBINHOOD CHAIN
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* On Mobile (< sm): Compact Utility Strip directly in Header so it NEVER overlaps */}
                  <div className="flex sm:hidden items-center gap-1.5 p-1 rounded-md bg-white/[0.04] border border-white/10 text-xs">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                      <span className="text-[8.5px] bg-white/5 px-1 py-0.2 rounded border border-white/10 font-bold">CA</span>
                      <span className="text-[9px] text-zinc-400">soon</span>
                      <button onClick={handleCopyCA} className="hover:text-zinc-200 transition-colors p-0.5">
                        {copiedCA ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5 text-zinc-500" />}
                      </button>
                    </div>

                    <div className="w-px h-3 bg-white/10" />

                    <a
                      href="https://x.com/hoardedfun"
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-white font-bold text-xs p-0.5"
                      title="Twitter / X (@hoardedfun)"
                    >
                      𝕏
                    </a>

                    <a
                      href="https://t.me/hoardedfun"
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-[#229ED9] p-0.5"
                      title="Telegram (@hoardedfun)"
                    >
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z"/>
                      </svg>
                    </a>

                    <button
                      onClick={toggleAudio}
                      className={`p-0.5 transition-colors ${audioEnabled ? "text-amber-400" : "text-zinc-500"}`}
                      title={audioEnabled ? "Mute ambient audio" : "Play ambient audio"}
                    >
                      {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    </button>
                  </div>

                  <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs tracking-wider uppercase">
                    $HOARD
                  </span>
                </div>
              </div>

              {/* Dynamic Phase: Pre-Migration vs Warband is Out */}
              {!isMigrated ? (
                /* PRE-MIGRATION PHASE */
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="tracking-wide">The Hoard is gathering</span>
                    </div>
                    <span className="text-zinc-300 font-mono font-bold text-[11px] tabular-nums">
                      {migrationProgressPct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Clean thin progress bar */}
                  <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${migrationProgressPct}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Until migration, every goblin buys $HOARD
                  </p>
                </div>
              ) : (
                /* POST-MIGRATION WARBAND PHASE */
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="tracking-wide">The warband is out</span>
                    </div>
                    <span className="text-rose-400 font-mono font-bold text-[11px]">
                      {DUNGEONS.filter((d) => currentTier >= d.unlockedTier).length} targets
                    </span>
                  </div>

                  <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 w-full" />
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Every new Robinhood Chain launch gets attacked.
                  </p>
                </div>
              )}

              {/* Mobile Drawer Toggles (prominent, touch-friendly bar on mobile) */}
              <div className="flex md:hidden items-center gap-2 pt-2 border-t border-white/[0.08] text-xs">
                <button
                  onClick={() => setMobileDrawer((p) => (p === "feed" ? "none" : "feed"))}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center font-mono font-bold text-[11px] uppercase transition-all border flex items-center justify-center gap-1.5 min-h-[36px] ${
                    mobileDrawer === "feed"
                      ? "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm"
                      : "bg-white/5 text-zinc-300 border-white/10 active:bg-white/10"
                  }`}
                >
                  <span>📜</span>
                  <span>{mobileDrawer === "feed" ? "Hide Feed" : "Live Feed"}</span>
                </button>
                <button
                  onClick={() => setMobileDrawer((p) => (p === "settlement" ? "none" : "settlement"))}
                  className={`flex-1 py-1.5 px-2 rounded-md text-center font-mono font-bold text-[11px] uppercase transition-all border flex items-center justify-center gap-1.5 min-h-[36px] ${
                    mobileDrawer === "settlement"
                      ? "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm"
                      : "bg-white/5 text-zinc-300 border-white/10 active:bg-white/10"
                  }`}
                >
                  <span>⚔️</span>
                  <span>{mobileDrawer === "settlement" ? "Hide Camp" : "Camp / Mind"}</span>
                </button>
              </div>
            </div>

            {/* Card 2: LIVE FROM THE HOARD Feed (Desktop always visible, mobile toggleable) */}
            <div className={`w-[calc(100vw-2rem)] sm:w-[360px] max-h-[50vh] sm:max-h-[480px] rounded-lg glass-panel p-3.5 flex-col gap-2.5 shadow-2xl ${
              mobileDrawer === "feed" ? "flex" : "hidden md:flex"
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                  <span className="font-bold text-[11px] uppercase tracking-[0.08em] text-zinc-200">
                    LIVE FROM THE HOARD
                  </span>
                </div>

                {/* Filter Tabs Strip */}
                <div className="flex items-center gap-2 text-[10px] font-mono overflow-x-auto no-scrollbar py-0.5">
                  {(["all", "goblins", "raids", "burns", "traders"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFeedTab(tab)}
                      className={`uppercase tracking-wider transition-colors pb-0.5 whitespace-nowrap ${
                        activeFeedTab === tab
                          ? "text-amber-300 font-bold border-b border-amber-400"
                          : "text-zinc-500 hover:text-zinc-300 border-b border-transparent"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed Entries: Terminal Event Readout */}
              <div className="overflow-y-auto max-h-[38vh] sm:max-h-[340px] pr-0.5 flex flex-col">
                {filteredFeed.map((item) => (
                  <div
                    key={item.id}
                    className="py-1.5 px-1.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1 h-3 rounded-full flex-shrink-0 ${
                          item.type === "raids"
                            ? "bg-rose-500"
                            : item.type === "burns"
                            ? "bg-orange-500"
                            : item.type === "traders"
                            ? "bg-emerald-500"
                            : "bg-zinc-600"
                        }`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-zinc-200 text-[11px] leading-tight truncate">
                          {item.title}
                        </span>
                        <span className="text-[9.5px] text-zinc-500 font-mono truncate">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 font-mono">
                      {item.amount && (
                        <span
                          className={`text-[11px] font-bold tabular-nums ${
                            item.isPositive ? "text-emerald-400" : "text-amber-300"
                          }`}
                        >
                          {item.amount}
                        </span>
                      )}
                      <span className="text-[9px] text-zinc-500">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. TOP RIGHT: UNIFIED COMMAND READOUT (Desktop/Tablet; hidden on xs mobile to prevent collision with logo card) */}
          <div className="hidden sm:block absolute top-4 right-4 z-30 pointer-events-auto font-sans">
            <div className="rounded-lg glass-panel px-4 py-2 flex items-center gap-4 shadow-xl">
              {/* MARKET CAP */}
              <div className="flex flex-col">
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 font-semibold leading-none">
                  MARKET CAP
                </span>
                <span className="text-sm font-bold text-zinc-100 font-mono tabular-nums leading-tight mt-1">
                  ${marketCap >= 1000 ? `${(marketCap / 1000).toFixed(1)}K` : marketCap.toFixed(2)}
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                  Vol ${marketCap >= 1000 ? `${(volume24h / 1000).toFixed(1)}K` : "0.00"}
                </span>
              </div>

              <div className="w-px h-6 bg-white/[0.08]" />

              {/* GOBLINS */}
              <div className="flex flex-col">
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 font-semibold leading-none">
                  GOBLINS
                </span>
                <span className="text-sm font-bold text-zinc-100 font-mono tabular-nums leading-tight mt-1">
                  {goblinCount} <span className="text-zinc-500 text-xs font-normal">/ 300</span>
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                  {isMigrated ? "Warband out" : "Gathering"}
                </span>
              </div>

              <div className="w-px h-6 bg-white/[0.08]" />

              {/* LOOT */}
              <div className="flex flex-col">
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 font-semibold leading-none">
                  LOOT
                </span>
                <span className="text-sm font-bold text-amber-300 font-mono tabular-nums leading-tight mt-1">
                  {goblinBuysEth.toFixed(2)} ETH
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                  into $HOARD
                </span>
              </div>

              <div className="w-px h-6 bg-white/[0.08] hidden sm:block" />

              {/* BURNED */}
              <div className="flex flex-col hidden sm:flex">
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 font-semibold leading-none">
                  BURNED
                </span>
                <span className="text-sm font-bold text-orange-400 font-mono tabular-nums leading-tight mt-1">
                  {burnedHoard > 1000000 ? `${(burnedHoard / 1000000).toFixed(2)}M` : burnedHoard.toLocaleString()}
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                  at pyre
                </span>
              </div>

              <div className="w-px h-6 bg-white/[0.08] hidden md:block" />

              {/* NEXT SPAWN */}
              <div className="flex flex-col hidden md:flex">
                <span className="text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 font-semibold leading-none">
                  NEXT SPAWN
                </span>
                <span className="text-sm font-bold text-zinc-200 font-mono tabular-nums leading-tight mt-1">
                  {feeRemainder.toFixed(4)} ETH
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono mt-0.5">
                  {nextGoblinPercent}% of threshold
                </span>
              </div>
            </div>
          </div>

          {/* 4. RIGHT PANEL: GOBLIN INSPECTION DRAWER OR SETTLEMENT TABS */}
          <div className={`fixed sm:absolute top-16 sm:top-[80px] right-4 left-4 sm:left-auto z-40 sm:z-30 pointer-events-auto ${
            selectedGoblin || mobileDrawer === "settlement" ? "block" : "hidden md:block"
          }`}>
            {selectedGoblin ? (
              /* RESTRAINED TACTICAL GOBLIN DOSSIER */
              <div className="w-[350px] max-w-[calc(100vw-2rem)] rounded-lg glass-panel p-3.5 flex flex-col gap-2.5 font-sans">
                {/* Header: Avatar, Name, ID, Status, Close */}
                <div className="flex items-start justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded bg-black/50 border border-white/10 flex items-center justify-center p-1 flex-shrink-0">
                      <img src="/goblin-logo.png" alt="Goblin" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-100 font-bold text-sm tracking-wide truncate">
                          {selectedGoblin.displayName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-zinc-300 font-mono font-semibold border border-white/10 flex-shrink-0">
                          {selectedGoblin.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] mt-0.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        <span className="text-zinc-300 truncate">
                          {selectedGoblin.status === "RAIDING" ? "Raiding in field" : selectedGoblin.activity}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedGoblin(null)}
                    className="text-zinc-500 hover:text-zinc-200 p-1 hover:bg-white/5 rounded transition-colors"
                    title="Close Inspector (Esc)"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Robinhood Chain Wallet Box */}
                <div className="glass-panel-sub rounded p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-zinc-400 font-semibold">ROBINHOOD CHAIN · 4663</span>
                    <div className="flex items-center gap-2 font-mono">
                      <button
                        onClick={() => handleCopyWallet(selectedGoblin.walletAddress)}
                        className="text-amber-400 hover:text-amber-300 font-semibold hover:underline flex items-center gap-1 text-[9.5px]"
                      >
                        {copiedWallet ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <a
                        href={`https://robinhoodchain.blockscout.com/address/${selectedGoblin.walletAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-400 hover:text-white flex items-center gap-0.5 font-semibold hover:underline text-[9.5px]"
                      >
                        <span>Explorer ↗</span>
                      </a>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-300 select-all break-all font-mono tracking-tight bg-black/40 px-2 py-0.5 rounded border border-white/[0.04]">
                    {selectedGoblin.walletAddress}
                  </span>
                </div>

                {/* Tactical Strategy DNA & Combat Parameters (Replaces rainbow pills) */}
                <div className="glass-panel-sub rounded p-2 flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between border-b border-white/[0.05] pb-1 text-[10px]">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-zinc-400 font-semibold">TACTICAL PARAMETERS</span>
                    <span className="text-purple-300 font-mono font-semibold">DNA Gen {hiveGen}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] font-mono pt-0.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-sans">Armament</span>
                      <span className="text-zinc-300 font-semibold">Steel Blade</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-sans">Take Profit</span>
                      <span className="text-emerald-400 font-semibold">+{selectedGoblin.strategyDNA?.takeProfitPct || 120}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-sans">Stop Loss</span>
                      <span className="text-rose-400 font-semibold">-{selectedGoblin.strategyDNA?.stopLossPct || 10}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-sans">Hold Cadence</span>
                      <span className="text-zinc-300 font-semibold">157s</span>
                    </div>
                  </div>
                </div>

                {/* 6-Metric Stat Grid (3 columns x 2 rows) */}
                <div className="glass-panel-sub rounded p-2 grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Balance</span>
                    <span className="text-zinc-100 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      {selectedGoblin.balance.toLocaleString()} $H
                    </span>
                  </div>
                  <div className="flex flex-col border-x border-white/[0.06]">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Loot home</span>
                    <span className="text-amber-300 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      {(selectedGoblin.strategyDNA?.totalLootEth ?? (0.005 + (selectedGoblin.balance / 10000) * 0.015)).toFixed(4)} ETH
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Win rate</span>
                    <span className="text-emerald-400 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      +{selectedGoblin.strategyDNA?.winRatePct ?? 68.4}%
                    </span>
                  </div>
                  <div className="flex flex-col pt-1.5 border-t border-white/[0.06]">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Bought</span>
                    <span className="text-zinc-300 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      {((selectedGoblin.balance / 10000) * 0.02).toFixed(3)} ETH
                    </span>
                  </div>
                  <div className="flex flex-col pt-1.5 border-t border-x border-white/[0.06]">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Burned</span>
                    <span className="text-orange-400 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      {Math.floor(selectedGoblin.balance * 0.08)} $H
                    </span>
                  </div>
                  <div className="flex flex-col pt-1.5 border-t border-white/[0.06]">
                    <span className="text-zinc-500 uppercase text-[8.5px] font-medium tracking-[0.08em]">Raids</span>
                    <span className="text-zinc-300 font-mono font-bold text-xs mt-0.5 truncate tabular-nums">
                      {selectedGoblin.strategyDNA?.raidsCount ?? Math.floor(selectedGoblin.balance / 300) + 1}
                    </span>
                  </div>
                </div>

                {/* Balance Over Time Sparkline */}
                <div className="glass-panel-sub rounded p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-zinc-400 font-semibold">BALANCE TRAJECTORY</span>
                    <span className="text-emerald-400 font-mono font-semibold text-[10px] tabular-nums">+240% since genesis</span>
                  </div>
                  <div className="w-full h-9 relative flex items-end">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 35" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0,30 Q 15,26 30,28 T 55,16 T 75,12 T 100,5 L 100,35 L 0,35 Z"
                        fill="url(#sparklineGrad)"
                      />
                      <path
                        d="M 0,30 Q 15,26 30,28 T 55,16 T 75,12 T 100,5"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Recent Activity Readout */}
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-[9px] uppercase tracking-[0.08em] text-zinc-400 font-semibold">RECENT OPERATIONS</span>
                  <div className="flex flex-col gap-0.5 font-mono text-[10.5px]">
                    <div className="p-1.5 rounded glass-panel-sub flex items-center justify-between">
                      <span className="text-zinc-300 font-sans">Pillaged Crypt of Memes</span>
                      <span className="text-emerald-400 font-bold tabular-nums">+0.0084 ETH</span>
                    </div>
                    <div className="p-1.5 rounded glass-panel-sub flex items-center justify-between">
                      <span className="text-zinc-300 font-sans">Bought $HOARD on LP</span>
                      <span className="text-amber-300 font-bold tabular-nums">+1,420 $H</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.08]">
                  <button
                    onClick={handlePrevGoblin}
                    className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-white/[0.06]"
                    title="Previous Raider"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Prev</span>
                  </button>
                  <button
                    onClick={toggleFollowSelected}
                    className={`flex-1 py-1 rounded font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${
                      navMode === "follow" && selectedGoblinRef.current?.id === selectedGoblin.id
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{navMode === "follow" && selectedGoblinRef.current?.id === selectedGoblin.id ? "CAMERA LOCKED" : "LOCK CAMERA"}</span>
                  </button>
                  <button
                    onClick={handleNextGoblin}
                    className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-white/[0.06]"
                    title="Next Raider"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              /* SETTLEMENT TABS (Chieftain, Mind, Dungeons) */
              <div className="w-full sm:w-[340px] max-h-[75vh] sm:max-h-[80vh] overflow-y-auto rounded-lg glass-panel p-3.5 flex flex-col gap-2.5 font-sans shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div className="flex items-center gap-1 text-[11px] p-0.5 rounded bg-black/40 border border-white/[0.06] overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setActiveRightTab("chieftain")}
                      className={`px-2 py-1 rounded transition-colors font-bold flex items-center gap-1.5 whitespace-nowrap ${
                        activeRightTab === "chieftain"
                          ? "bg-white/10 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>Chieftain</span>
                    </button>
                    <button
                      onClick={() => setActiveRightTab("hivemind")}
                      className={`px-2 py-1 rounded transition-colors font-bold flex items-center gap-1.5 whitespace-nowrap ${
                        activeRightTab === "hivemind"
                          ? "bg-white/10 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Mind [Gen {hiveGen}]</span>
                    </button>
                    <button
                      onClick={() => setActiveRightTab("dungeons")}
                      className={`px-2 py-1 rounded transition-colors font-bold flex items-center gap-1.5 whitespace-nowrap ${
                        activeRightTab === "dungeons"
                          ? "bg-white/10 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Swords className="w-3 h-3 text-rose-400" />
                      <span>Dungeons</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => applyPreset("chieftain")}
                      title="Focus Camera on High Chieftain"
                      className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {/* Mobile close button */}
                    <button
                      onClick={() => setMobileDrawer("none")}
                      className="sm:hidden w-7 h-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors"
                      title="Close panel"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* TAB 1: THE HIGH CHIEFTAIN */}
                {activeRightTab === "chieftain" && (
                  <div className="flex flex-col gap-2.5 font-sans">
                    <div className="glass-panel-sub border border-white/[0.06] rounded p-2 grid grid-cols-3 text-center gap-1 font-mono">
                      <div className="flex flex-col">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Tribute pool</span>
                        <span className="text-xs font-bold text-amber-300 mt-0.5 tabular-nums">
                          {creatorFees.toFixed(4)} ETH
                        </span>
                      </div>
                      <div className="flex flex-col border-x border-white/[0.06]">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Summons</span>
                        <span className="text-xs font-bold text-zinc-100 mt-0.5 tabular-nums">{goblinCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Hatch cost</span>
                        <span className="text-xs font-bold text-zinc-300 mt-0.5 tabular-nums">
                          {FEE_PER_GOBLIN.toFixed(4)} ETH
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-[0.08em]">
                          TOP HOARD PATRONS
                        </span>
                        <button
                          onClick={() => setShowRoster((p) => !p)}
                          className="px-2 py-0.5 rounded border border-white/10 text-zinc-300 hover:text-white text-[10px] font-semibold transition-colors"
                        >
                          Horde Roster (H)
                        </button>
                      </div>

                      <div className="p-2 rounded glass-panel-sub text-[10px] text-zinc-400 leading-relaxed">
                        {goblinCount === 0
                          ? `The first goblin spawns when the High Chieftain has collected ${FEE_PER_GOBLIN.toFixed(4)} ETH tribute.`
                          : `Active horde of ${goblinCount} autonomous goblins raiding and acquiring $HOARD.`}
                      </div>

                      <a
                        href="https://ponsfamily.com"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs tracking-wider uppercase transition-colors shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Acquire $HOARD on PonsFamily</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* TAB 2: GOBLIN HIVE-MIND */}
                {activeRightTab === "hivemind" && (
                  <div className="flex flex-col gap-2.5 font-sans">
                    <div className="p-2 rounded bg-purple-950/20 border border-purple-500/20 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-[0.08em]">
                        COLLECTIVE INTELLIGENCE · {goblinCount} UNITS
                      </span>
                      <span className="text-[9.5px] text-zinc-400">
                        Shared neural weight optimization across all raiders
                      </span>
                    </div>

                    <div className="glass-panel-sub rounded p-2 grid grid-cols-3 text-center gap-1 font-mono">
                      <div className="flex flex-col">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Win rate</span>
                        <span className="text-xs font-bold text-emerald-400 mt-0.5 tabular-nums">{hiveWinRate}%</span>
                      </div>
                      <div className="flex flex-col border-x border-white/[0.06]">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Avg P&amp;L</span>
                        <span className="text-xs font-bold text-purple-300 mt-0.5 tabular-nums">+{hiveAvgPnl}%</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8.5px] text-zinc-400 font-sans font-semibold">Analyzed</span>
                        <span className="text-xs font-bold text-zinc-200 mt-0.5 tabular-nums">{raidsLearned}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded glass-panel-sub flex flex-col gap-0.5 text-xs">
                      <span className="text-zinc-500 font-semibold text-[9px] uppercase tracking-[0.08em]">
                        Apex Strategy DNA
                      </span>
                      <span className="text-zinc-200 font-bold font-mono text-[11px]">
                        GOB-007 (Bloodfang Aggro) · +142.5% avg
                      </span>
                      <span className="text-zinc-500 text-[9.5px] font-mono">
                        TP: +150% · SL: -10% · Trailing: 20%
                      </span>
                    </div>

                    <div className="p-2 rounded bg-purple-950/30 border border-purple-500/20 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-purple-300">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      <span>Autonomous Strategy DNA: Gen {hiveGen} Active</span>
                    </div>
                  </div>
                )}

                {/* TAB 3: DUNGEONS & TARGET TICKERS */}
                {activeRightTab === "dungeons" && (
                  <div className="flex flex-col gap-2 font-sans">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="text-[9.5px] uppercase tracking-[0.08em] font-semibold">RAID DESTINATIONS</span>
                      <span className="font-mono text-[10px] text-zinc-300">{DUNGEONS.filter((d) => currentTier >= d.unlockedTier).length} ONLINE</span>
                    </div>

                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                      {DUNGEONS.map((dungeon) => {
                        const isUnlocked = currentTier >= dungeon.unlockedTier;
                        return (
                          <div
                            key={dungeon.id}
                            className={`p-2 rounded border transition-colors flex flex-col gap-1 ${
                              isUnlocked
                                ? "glass-panel-sub border-white/[0.06] hover:border-white/20"
                                : "bg-black/30 border-white/[0.03] opacity-40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
                                <Swords className="w-3 h-3 text-zinc-400" />
                                <span>{dungeon.name}</span>
                              </span>
                              <span
                                className={`text-[9.5px] font-mono font-semibold ${
                                  isUnlocked ? "text-emerald-400" : "text-zinc-500"
                                }`}
                              >
                                {isUnlocked ? "ONLINE" : `TIER ${dungeon.unlockedTier} LOCK`}
                              </span>
                            </div>

                            <span className="text-[9.5px] text-zinc-400 font-mono">
                              {dungeon.tickers.join(" · ")}
                            </span>

                            {isUnlocked && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <button
                                  onClick={() => applyPreset(dungeon.id as "crypt" | "chasm" | "voidmine")}
                                  className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-semibold text-[10px] transition-colors flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Inspect Landmark</span>
                                </button>
                                {process.env.NEXT_PUBLIC_ENABLE_SANDBOX === "true" && (
                                  <button
                                    onClick={() => triggerRaid(dungeon.id)}
                                    className="px-2 py-1 rounded bg-rose-700/80 hover:bg-rose-600 text-white font-semibold text-[10px] transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Swords className="w-3 h-3" />
                                    <span>Raid Target</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* 5. THE ASCENSION ROADMAP & TIER PROGRESSION */}
          <div className="absolute bottom-16 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[calc(100vw-1.5rem)] sm:w-[94%] max-w-[580px]">
            <div className="rounded-lg glass-panel px-2.5 sm:px-3.5 py-1.5 sm:py-2 flex flex-col gap-1 sm:gap-1.5 font-sans shadow-xl">
              {/* Header: Title + Active Milestone Target */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 sm:gap-1.5 font-bold text-zinc-200">
                  <Crown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-purple-400" />
                  <span className="tracking-[0.08em] uppercase text-[10px] sm:text-[11px]">THE ASCENSION</span>
                  <span className="text-[8.5px] sm:text-[9.5px] font-mono text-zinc-400 ml-0.5 sm:ml-1">
                    Target: {nextMilestone.name} ({nextMilestone.display})
                  </span>
                </div>
                <div className="text-zinc-200 font-mono text-[11px] sm:text-xs flex items-center gap-1 tabular-nums">
                  <span className="font-bold">${marketCap >= 1000 ? `${(marketCap / 1000).toFixed(1)}K` : marketCap.toFixed(0)}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-amber-300 font-bold">{nextMilestone.display}</span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-500 font-sans ml-0.5">
                    ({currentMilestoneProgress.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* T0 > T1 > T2 > T3 > Final Ascension Stepper */}
              <div className="flex items-center justify-between gap-0.5 sm:gap-1 relative my-0.5 overflow-x-auto no-scrollbar py-0.5">
                {ASCENSION_MILESTONES.map((m, idx) => {
                  const isPassed = marketCap >= m.mcap && (idx === 0 || marketCap >= m.mcap);
                  const isTarget = nextMilestone.tier === m.tier;

                  return (
                    <React.Fragment key={m.label}>
                      {/* Milestone Node */}
                      <div
                        title={`${m.name} (${m.display})`}
                        className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-mono font-semibold border flex-shrink-0 ${
                          isPassed && !isTarget
                            ? "bg-white/[0.04] text-zinc-300 border-white/10"
                            : isTarget
                            ? "bg-purple-950/40 text-purple-200 border-purple-500/50"
                            : "bg-white/[0.02] text-zinc-500 border-white/[0.04]"
                        }`}
                      >
                        <span className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full flex-shrink-0 ${
                          isPassed && !isTarget ? "bg-amber-400" : isTarget ? "bg-purple-400" : "bg-zinc-700"
                        }`} />
                        <span className="font-bold">{m.label}</span>
                        <span className={`text-[7.5px] sm:text-[8.5px] ${isTarget ? "text-purple-300 font-bold" : "text-zinc-500"}`}>
                          {m.display}
                        </span>
                      </div>

                      {/* Connector arrow / line between milestones */}
                      {idx < ASCENSION_MILESTONES.length - 1 && (
                        <div className="flex-1 flex items-center justify-center px-0.5 min-w-[8px]">
                          <div className="w-full h-px bg-white/10 rounded-full relative overflow-hidden">
                            <div
                              className="h-full bg-amber-500/80 transition-all duration-500"
                              style={{
                                width: marketCap >= ASCENSION_MILESTONES[idx + 1].mcap
                                  ? "100%"
                                  : idx === currentTier
                                  ? `${currentMilestoneProgress}%`
                                  : "0%"
                              }}
                            />
                          </div>
                          <span className={`text-[8px] sm:text-[9px] font-bold mx-0.5 ${idx < currentTier ? "text-amber-400" : "text-zinc-700"}`}>
                            &gt;
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Clean thin overall progress bar */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${currentMilestoneProgress}%` }}
                />
              </div>

              {/* Contextual Step Subtitle */}
              <div className="text-[8.5px] sm:text-[9.5px] text-zinc-400 text-center truncate">
                {currentTier === 0
                  ? "At $12.0K Market Cap: Warband gathers, Chieftain Keep fortified & Crypt unsealed"
                  : currentTier === 1
                  ? "At $25.0K Market Cap: Castle expands & Dragon's Chasm awakens"
                  : currentTier === 2
                  ? "At $40.0K Market Cap: Bonding Curve Graduates & Migrates to DEX — Full Warband Unleashed"
                  : "At $100.0K Market Cap: The Citadel Ascends — Golden Realm & Legendary Status"}
              </div>
            </div>
          </div>

          {/* 6. BOTTOM CENTER: NAVIGATION DOCK */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-1rem)]">
            <div className="rounded-lg glass-panel px-2 py-1 flex items-center gap-1 font-sans text-xs overflow-x-auto no-scrollbar shadow-xl">
              <button
                onClick={() => {
                  setNavMode("orbit");
                  navModeRef.current = "orbit";
                  sphericalRef.current.radius = 13.5;
                  sphericalRef.current.phi = 1.22;
                  lookTargetRef.current.set(0, 0.8, -0.4);
                }}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors text-xs font-semibold whitespace-nowrap ${
                  navMode === "orbit"
                    ? "bg-white/10 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span>Orbit</span>
              </button>

              <button
                onClick={() => setNavMode("fly")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors text-xs font-semibold whitespace-nowrap ${
                  navMode === "fly"
                    ? "bg-white/10 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Fly</span>
              </button>

              <button
                onClick={() => {
                  setNavMode("follow");
                  if (!selectedGoblinRef.current) {
                    followRandomGoblin();
                  }
                }}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors text-xs font-semibold whitespace-nowrap ${
                  navMode === "follow"
                    ? "bg-white/10 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Follow</span>
              </button>

              <button
                onClick={() => followRandomGoblin()}
                title="Follow Random Raider (Key: R)"
                className="px-2 py-1 rounded flex items-center gap-1 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-xs font-medium font-mono whitespace-nowrap"
              >
                <Dices className="w-3.5 h-3.5 text-amber-400" />
                <span>Raider (R)</span>
              </button>

              <div className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />

              <button
                onClick={() => applyPreset("camp")}
                title="Campfire Pyre"
                className="w-6 h-6 rounded hover:bg-white/10 text-zinc-400 hover:text-amber-300 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <button
                onClick={() => applyPreset("chieftain")}
                title="High Chieftain Vigil"
                className="w-6 h-6 rounded hover:bg-white/10 text-zinc-400 hover:text-amber-300 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Crown className="w-3.5 h-3.5 text-amber-300" />
              </button>

              <button
                onClick={() => applyPreset("fortress")}
                title="Chieftain's Fortress Citadel"
                className="w-6 h-6 rounded hover:bg-white/10 text-zinc-400 hover:text-amber-300 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Shield className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                onClick={() => applyPreset("overview")}
                title="Camp Overview"
                className="w-6 h-6 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <MapIcon className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <div className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />

              <button
                onClick={() => applyPreset("crypt")}
                title="Crypt of the Memes (Tier 1+)"
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                  currentTier >= 1
                    ? "hover:bg-white/10 text-purple-400 hover:text-purple-200"
                    : "text-zinc-700 opacity-40 cursor-not-allowed"
                }`}
              >
                <Skull className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => applyPreset("chasm")}
                title="Dragon's Chasm (Tier 2+)"
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                  currentTier >= 2
                    ? "hover:bg-white/10 text-rose-400 hover:text-rose-200"
                    : "text-zinc-700 opacity-40 cursor-not-allowed"
                }`}
              >
                <Mountain className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => applyPreset("voidmine")}
                title="Void Mine (Tier 3+)"
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                  currentTier >= 3
                    ? "hover:bg-white/10 text-cyan-400 hover:text-cyan-200"
                    : "text-zinc-700 opacity-40 cursor-not-allowed"
                }`}
              >
                <Gem className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-white/10 mx-0.5 flex-shrink-0" />

              <button
                onClick={() => setShowRoster((p) => !p)}
                className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white font-medium flex items-center gap-1 transition-colors text-xs font-mono whitespace-nowrap flex-shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Horde ({goblinCount})</span>
              </button>
            </div>
          </div>

          {/* 7. BOTTOM LEFT: MICRO CONTROL HINTS & SIMULATOR TOGGLE */}
          <div className="absolute bottom-4 left-4 z-30 pointer-events-auto flex items-center gap-2">
            {/* Refined tactical desktop control hints */}
            <div className="hidden lg:flex items-center gap-2.5 text-[10px] text-zinc-400 font-sans glass-panel px-3 py-1.5 rounded-lg shadow-xl">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[9.5px] font-mono text-zinc-300 border border-white/10">Drag</kbd>
                <span>Orbit</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[9.5px] font-mono text-zinc-300 border border-white/10">WASD</kbd>
                <span>Fly</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[9.5px] font-mono text-zinc-300 border border-white/10">Click</kbd>
                <span>Inspect</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9.5px] font-mono text-amber-300 border border-amber-500/20 font-bold">R</kbd>
                <span className="text-zinc-300">Raider</span>
              </span>
            </div>

            {/* Sandbox Gated for Production Ship */}
            {process.env.NEXT_PUBLIC_ENABLE_SANDBOX === "true" && (
              <button
                onClick={() => setShowSimulator((p) => !p)}
                className="px-3 py-1.5 rounded-lg glass-panel border border-white/10 text-zinc-300 hover:text-white font-sans text-xs font-semibold flex items-center gap-1.5 shadow-xl transition-colors"
              >
                <Dices className="w-3.5 h-3.5 text-zinc-400" />
                <span>Sandbox {showSimulator ? "▲" : "▼"}</span>
              </button>
            )}
          </div>

          {/* SIMULATION CONTROLLER PANEL (DEV ONLY) */}
          {process.env.NEXT_PUBLIC_ENABLE_SANDBOX === "true" && showSimulator && (
            <div className="absolute bottom-16 left-4 z-40 w-[300px] rounded-lg glass-panel p-3 flex flex-col gap-2 font-sans">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.08em] flex items-center gap-1.5">
                  <Dices className="w-3.5 h-3.5" />
                  <span>SIMULATION SANDBOX</span>
                </span>
                <button
                  onClick={() => setIsSimulating((p) => !p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    isSimulating
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-zinc-300 hover:text-white"
                  }`}
                >
                  {isSimulating ? "PAUSE" : "START"}
                </button>
              </div>

              {/* Migration Phase Switcher */}
              <div className="flex items-center justify-between text-[10px] glass-panel-sub p-1.5 rounded">
                <span className="text-zinc-400">Phase:</span>
                <button
                  onClick={() => setIsForceMigrated((p) => (p === null ? !isMigrated : !p))}
                  className={`px-2 py-0.5 rounded font-mono font-semibold text-[9.5px] transition-colors flex items-center gap-1 ${
                    isMigrated
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                  title="Toggle pre-migration gathering vs post-migration warband"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isMigrated ? "bg-rose-400" : "bg-amber-400"}`} />
                  <span>{isMigrated ? "Warband Out" : "Gathering ($HOARD)"}</span>
                </button>
              </div>

              {/* Speed Buttons */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="font-sans">Speed:</span>
                <div className="flex items-center gap-1 font-mono">
                  {([1, 2, 5] as const).map((sp) => (
                    <button
                      key={sp}
                      onClick={() => setSimSpeed(sp)}
                      className={`px-2 py-0.5 rounded font-bold ${
                        simSpeed === sp ? "bg-white/20 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Milestone Quick Jumps */}
              <div className="flex flex-col gap-1 text-[9px]">
                <span className="text-zinc-500 uppercase tracking-wider font-semibold">Preview Milestone:</span>
                <div className="grid grid-cols-4 gap-1 font-mono">
                  <button
                    onClick={() => jumpToMilestone(4700)}
                    className="p-1 rounded glass-panel-sub hover:border-white/20 text-zinc-300 text-center font-bold"
                  >
                    $4.7K (T0)
                  </button>
                  <button
                    onClick={() => jumpToMilestone(15000)}
                    className="p-1 rounded glass-panel-sub hover:border-white/20 text-zinc-300 text-center font-bold"
                  >
                    $15K (T1)
                  </button>
                  <button
                    onClick={() => jumpToMilestone(35000)}
                    className="p-1 rounded glass-panel-sub hover:border-white/20 text-zinc-300 text-center font-bold"
                  >
                    $35K (T2)
                  </button>
                  <button
                    onClick={() => jumpToMilestone(70000)}
                    className="p-1 rounded glass-panel-sub hover:border-white/20 text-zinc-300 text-center font-bold"
                  >
                    $70K (T3)
                  </button>
                </div>
              </div>

              {/* Manual Event Triggers */}
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/[0.08] text-[10px] font-mono">
                <button
                  onClick={() => triggerRaid()}
                  className="py-1 rounded bg-rose-800/60 hover:bg-rose-700 text-white font-semibold text-center flex items-center justify-center gap-1"
                >
                  <Swords className="w-3 h-3" />
                  <span>Raid</span>
                </button>
                <button
                  onClick={() => triggerBuyOrder(0.003)}
                  className="py-1 rounded bg-emerald-800/60 hover:bg-emerald-700 text-white font-semibold text-center flex items-center justify-center gap-1"
                >
                  <Coins className="w-3 h-3" />
                  <span>Buy</span>
                </button>
                <button
                  onClick={() => triggerPyreBurnEffect(10000)}
                  className="py-1 rounded bg-orange-800/60 hover:bg-orange-700 text-white font-semibold text-center flex items-center justify-center gap-1"
                >
                  <Flame className="w-3 h-3" />
                  <span>Burn</span>
                </button>
              </div>
            </div>
          )}

          {/* 8. DESKTOP UTILITY BAR (Bottom right on desktop; hidden on mobile since integrated in header) */}
          <div className="hidden sm:flex absolute bottom-4 right-4 z-30 pointer-events-auto items-center gap-2">
            <div className="rounded-lg glass-panel px-3 py-1.5 flex items-center gap-2.5 font-sans text-xs shadow-xl">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <span className="text-[9px] font-mono text-zinc-400 bg-white/5 px-1 py-0.5 rounded border border-white/10 font-bold">CA</span>
                <span className="text-zinc-400 font-mono text-[10px]">launching soon</span>
                <button onClick={handleCopyCA} className="hover:text-zinc-200 transition-colors ml-0.5 p-1">
                  {copiedCA ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                </button>
              </div>

              <div className="w-px h-3.5 bg-white/10" />

              <a
                href="https://x.com/hoardedfun"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white font-bold text-xs transition-colors flex items-center gap-1 p-1"
                title="Twitter / X (@hoardedfun)"
              >
                𝕏
              </a>

              <a
                href="https://t.me/hoardedfun"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-[#229ED9] transition-colors flex items-center gap-1 p-1"
                title="Telegram (@hoardedfun)"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z"/>
                </svg>
              </a>

              <button
                onClick={toggleAudio}
                className={`transition-colors p-1 ${audioEnabled ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
                title={audioEnabled ? "Mute ambient audio" : "Play ambient audio"}
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsDayMode((p) => !p)}
                className="text-zinc-400 hover:text-amber-400 transition-colors p-1"
                title="Toggle day/night lighting"
              >
                {isDayMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                  } else {
                    document.exitFullscreen();
                  }
                }}
                className="text-zinc-400 hover:text-white transition-colors hidden sm:block p-1"
                title="Fullscreen"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 9. GOBLIN ROSTER MODAL */}
          {showRoster && (
            <div className="absolute top-20 right-4 z-40 w-84 max-w-[calc(100vw-2rem)] rounded-2xl glass-panel p-4 flex flex-col gap-3 font-sans">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-white tracking-wider">SETTLEMENT HORDE</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                    {goblinCount} / 300
                  </span>
                </div>
                <button onClick={() => setShowRoster(false)} className="text-zinc-400 hover:text-white text-xs p-1">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {goblinCount === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl glass-panel-sub flex items-center justify-center p-1.5">
                    <img src="/goblin-logo.png" alt="Goblin" className="w-7 h-7 object-contain opacity-50" />
                  </div>
                  <span>The camp is currently empty.</span>
                  <span className="text-[10px] text-zinc-400">
                    Goblins will spawn as creator fees accumulate on Robinhood Chain!
                  </span>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[300px] flex flex-col gap-1.5 pr-1">
                  {populationSystemRef.current?.getAllEntities().map((g) => (
                    <div
                      key={g.id}
                      onClick={() => focusOnGoblin(g)}
                      className="p-2 rounded-xl glass-panel-sub hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-0.5 flex-shrink-0">
                          <img src="/goblin-logo.png" alt="Goblin" className="w-5 h-5 object-contain" />
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-white text-[11px] font-bold truncate">{g.displayName}</span>
                          <span className="text-[9px] text-zinc-400 font-mono">
                            {g.walletAddress.slice(0, 6)}...{g.walletAddress.slice(-4)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black font-mono text-amber-300">
                        {g.balance.toLocaleString()} $HOARD
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
