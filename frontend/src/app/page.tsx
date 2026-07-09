"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  Shield, 
  Coins, 
  Flame, 
  TrendingUp, 
  Crown, 
  Key, 
  Map as MapIcon, 
  ArrowUpRight, 
  Compass, 
  Clock, 
  Dice5,
  Lock,
  CheckCircle,
  HelpCircle,
  Sword,
  BookOpen,
  Info
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Particle class for flying JRPG canvas sparks
class EmbersParticle {
  x: number = 0;
  y: number = 0;
  size: number = 0;
  speedX: number = 0;
  speedY: number = 0;
  opacity: number = 0;
  color: string = "";

  constructor(width: number, height: number) {
    this.reset(width, height, true);
  }

  reset(width: number, height: number, init = false) {
    this.x = Math.random() * width;
    this.y = init ? Math.random() * height : height + 10;
    this.size = Math.random() * 2.5 + 1.2; // Slightly larger, more cinematic sparks
    this.speedX = Math.random() * 0.8 - 0.25; // wind drift effect
    this.speedY = -(Math.random() * 0.7 + 0.35); // upward float
    this.opacity = Math.random() * 0.5 + 0.15;
    // JRPG antique gold: "197, 160, 89", magic soft violet: "147, 112, 219"
    this.color = Math.random() > 0.2 ? "197, 160, 89" : "147, 112, 219";
  }

  update(width: number, height: number) {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.y < -10 || this.x < -10 || this.x > width + 10) {
      this.reset(width, height);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    // Add glowing heat-bloom around each spark
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(${this.color}, 0.75)`;
    ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
    ctx.fill();
    ctx.restore();
  }
}

// Live heist mock event type
interface HeistEvent {
  id: string;
  txHash: string;
  type: "blessing" | "tax" | "stash" | "legendary" | "safe";
  outcomeName: string;
  amount: string;
  bonus: string;
  time: string;
}

// Landmark description type
interface Landmark {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  lore: string;
  mechanic: string;
}

// Custom SVG Icons for high fidelity JRPG feel
const blessingIcon = (
  <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 4L48 16V36C48 46 32 58 32 58C32 58 16 46 16 36V16L32 4Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" fill="rgba(197, 160, 89, 0.1)"/>
    <path d="M32 14V44M22 28L32 18L42 28" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="32" cy="18" r="3" fill="currentColor"/>
  </svg>
);

const taxIcon = (
  <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 8L40 24L58 24L44 34L50 50L32 40L14 50L20 34L6 24L24 24L32 8Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" fill="rgba(244, 63, 94, 0.1)"/>
    <circle cx="32" cy="30" r="6" stroke="currentColor" strokeWidth="3.5"/>
  </svg>
);

const safeIcon = (
  <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="18" width="28" height="28" rx="14" stroke="currentColor" strokeWidth="3.5" fill="rgba(255,255,255,0.05)"/>
    <path d="M32 32V52M32 42H42M32 48H38" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
  </svg>
);

const stashIcon = (
  <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="20" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="3.5" fill="rgba(245, 158, 11, 0.1)"/>
    <path d="M12 32H52M28 32V38H36V32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="32" cy="35" r="2" fill="currentColor"/>
  </svg>
);

const legendaryIcon = (
  <svg viewBox="0 0 64 64" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 46L14 20L26 32L32 14L38 32L50 20L54 46H10Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" fill="rgba(197, 160, 89, 0.2)"/>
    <rect x="8" y="48" width="48" height="6" rx="2" fill="currentColor"/>
  </svg>
);

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLDivElement>(null);

  // States
  const [heists, setHeists] = useState<HeistEvent[]>([
    { id: "1", txHash: "0x7d...A3b2", type: "blessing", outcomeName: "Robin's Blessing", amount: "247,000", bonus: "+25%", time: "12s ago" },
    { id: "2", txHash: "0x91...C91f", type: "tax", outcomeName: "Sheriff's Tax", amount: "90,000", bonus: "-10%", time: "28s ago" },
    { id: "3", txHash: "0x34...E8d4", type: "stash", outcomeName: "Hidden Stash", amount: "94,000", bonus: "+50%", time: "1m ago" },
    { id: "4", txHash: "0x2a...Bb7e", type: "legendary", outcomeName: "Legendary Heist", amount: "52,000", bonus: "2X", time: "2m ago" },
  ]);

  // Landmark Tooltip States
  const [activeLandmark, setActiveLandmark] = useState<string | null>(null);

  // Heist Engine Outcome States
  const [activeOutcomeIndex, setActiveOutcomeIndex] = useState<number>(0);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [currentDiceFace, setCurrentDiceFace] = useState<string>("I");
  const [engineLog, setEngineLog] = useState<string>("⚔️ Ready to breach the Vault. Tap Roll Dice or wait for auto-scout.");

  // Landmark Database
  const landmarks: Record<string, Landmark> = {
    crown: {
      id: "crown",
      title: "The Crown",
      subtitle: "Central Sovereign Treasury",
      description: "Represents traditional finance, centralized liquidity, and the central system governing all assets in the old world.",
      lore: "Under the iron seal of the Sovereign, every silver coin was recorded, taxed, and trapped inside locked towers. They hold the baseline WETH reserves that our guild targets.",
      mechanic: "WETH pools locked in Uniswap V3. Transactions route through our engine to siphon this WETH out organically."
    },
    outlaw: {
      id: "outlaw",
      title: "Outlaw Capital",
      subtitle: "Decentralized Guild Hub",
      description: "The primary headquarters of the rebellion. Houses the token supply, controls LP keys, and organizes raids.",
      lore: "A secret sanctuary built upon the ruins of the old archives. Outlaws gather here to coordinate runs, sign permissions, and distribute siphoned rewards.",
      mechanic: "The central $OUTLAW ERC-20 contract, managing total supply and EIP-2612 permissions."
    },
    engine: {
      id: "engine",
      title: "The Heist Engine",
      subtitle: "Verifiable RNG Vault",
      description: "The core gameplay resolver. Processes all .67 transactions using secure block variable randomness to settle outcomes.",
      lore: "An intricate mechanical vault scanner that intercepts the Crown's treasury transfers and redirects a portion of the value back to the sender.",
      mechanic: "Calculates block.prevrandao and balances the outcome table (Sheriff's Tax, Safe Escape, Robin's Blessing, Hidden Stash, Legendary Heist)."
    },
    vault: {
      id: "vault",
      title: "Reward Vault",
      subtitle: "Guild Treasury reserves",
      description: "Stores siphoned $OUTLAW tokens. Backs the +25%, +50%, and +100% bonuses rolled in Heist Mode.",
      lore: "A subterranean network of chambers hidden in the sewers. Funded directly from launch parameters, holding supply that belongs to the guild.",
      mechanic: "Uses EIP-2612 Permits to gaslessly pull rewards from 20 rotating vaults on behalf of players."
    },
    guild: {
      id: "guild",
      title: "Launch Guild",
      subtitle: "Token Launch Foundry",
      description: "The launchpad foundry where new outlaws deploy customized tokens with custom game variables.",
      lore: "Every blacksmith and alchemist working to forge weapons for the rebellion. They allow anyone to spin up a token instantly.",
      mechanic: "Deploys custom ERC-20 token contracts and launches out-of-range Uniswap V3 pools with 0 upfront WETH."
    },
    bridge: {
      id: "bridge",
      title: "Liquidity Bridge",
      subtitle: "Uniswap LP Router",
      description: "The mechanism connecting local token reserves directly to Uniswap V3 liquidity positions.",
      lore: "A grand architectural stone bridge spanning the divide. It routes silver from the launch guild directly into the out-of-range V3 LP range.",
      mechanic: "Mints V3 LP positions directly to founder wallets using custom price ticks."
    },
    records: {
      id: "records",
      title: "Guild Records",
      subtitle: "Multilayer Logs & Ledger",
      description: "Tracks active heist logs, player statistics, leaderboard ranks, and general historical archives.",
      lore: "The Tower of Scrolls, where scribes record every legendary raid, every caught smuggler, and every successful escape.",
      mechanic: "Compiles onchain event triggers and transaction histories for live multiplayer updates."
    },
    treasury: {
      id: "treasury",
      title: "The Treasury",
      subtitle: "Long-term Guild Reserves",
      description: "Fortified safety vaults storing siphoned WETH to secure long-term backing for the guild ecosystem.",
      lore: "Buried beneath deep bedrock, where the guild locks away WETH extracted from successful raids. This WETH secures our liquidity permanently.",
      mechanic: "Holds the locked Uniswap V3 LP NFTs, generating fees that belong to the protocol."
    }
  };

  // Outcomes list
  const outcomes = [
    { name: "Normal Buy", chance: "Always", change: "100%", desc: "Receive 100% of purchased tokens. No RNG. No risk.", flavor: "A standard merchant transaction. Boring, but safe.", color: "text-slate-400" },
    { name: "Sheriff's Tax", chance: "30%", change: "90%", desc: "Receive 90% of purchased tokens. 10% is burned.", flavor: "The Sheriff intercepted your escape path.", color: "text-rose-500" },
    { name: "Safe Escape", chance: "40%", change: "100%", desc: "Receive 100% of purchased tokens.", flavor: "You slipped through the alleyways unnoticed.", color: "text-slate-200" },
    { name: "Robin's Blessing", chance: "20%", change: "125%", desc: "Receive 125% of tokens (+25% bonus).", flavor: "Robin rewarded your courage from the reserves.", color: "text-emerald-500" },
    { name: "Hidden Stash", chance: "8%", change: "150%", desc: "Receive 150% of tokens (+50% bonus).", flavor: "You discovered a forgotten supply chest.", color: "text-emerald-400" },
    { name: "Legendary Heist", chance: "2%", change: "200%", desc: "Receive 200% of tokens (Double payout).", flavor: "You successfully robbed the Crown itself.", color: "text-gold" }
  ];

  // Heist Engine Dice roll simulator
  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    setEngineLog("🎲 Rolling the 3D Dice... Breaching the Vault gates...");
    
    // Choose random outcome weighted roughly by chances
    const roll = Math.random() * 100;
    let selectedIndex = 2; // Default Safe Escape
    let face = "III";
    let outcomeText = "";

    if (roll < 30) {
      selectedIndex = 1; // Tax
      face = "I";
      outcomeText = "🚔 Caught! Sheriff's Tax applied (-10% Burn). The Crown confiscated a bag.";
    } else if (roll < 70) {
      selectedIndex = 2; // Safe
      face = "III";
      outcomeText = "🌲 Escaped cleanly! Safe Escape settled (100% payout). No trace left.";
    } else if (roll < 90) {
      selectedIndex = 3; // Blessing
      face = "IV";
      outcomeText = "🏹 Robin's Blessing! +25% bonus OUTLAW siphoned from the reserves.";
    } else if (roll < 98) {
      selectedIndex = 4; // Stash
      face = "V";
      outcomeText = "💰 Hidden Stash! +50% bonus OUTLAW siphoned from the sewage vaults.";
    } else {
      selectedIndex = 5; // Legendary
      face = "VI";
      outcomeText = "👑 Legendary Heist! Vault cracked! Double rewards (2X) granted!";
    }

    // Spin fast for 1.2s
    let spinCount = 0;
    const faces = ["I", "II", "III", "IV", "V", "VI"];
    const interval = setInterval(() => {
      setCurrentDiceFace(faces[spinCount % faces.length]);
      spinCount++;
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      setCurrentDiceFace(face);
      setActiveOutcomeIndex(selectedIndex);
      setIsRolling(false);
      setEngineLog(outcomeText);

      // Dynamically add to live heist feed
      const amountVal = Math.floor(Math.random() * 150) + 50;
      const formattedAmount = (amountVal * 1000).toLocaleString();
      const mockHex = "0x" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0") + "..." + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
      
      const heistTypes: Record<number, HeistEvent["type"]> = {
        1: "tax",
        2: "safe",
        3: "blessing",
        4: "stash",
        5: "legendary"
      };

      const bonuses = {
        tax: "-10%",
        safe: "Standard",
        blessing: "+25%",
        stash: "+50%",
        legendary: "2X"
      };

      const newHeist: HeistEvent = {
        id: Date.now().toString(),
        txHash: mockHex,
        type: heistTypes[selectedIndex] || "safe",
        outcomeName: outcomes[selectedIndex].name,
        amount: formattedAmount,
        bonus: bonuses[heistTypes[selectedIndex] || "safe"],
        time: "Just now"
      };

      setHeists(prev => [newHeist, ...prev.slice(0, 3)]);
    }, 1200);
  };

  // Auto roll every 7 seconds to keep page breathing
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isRolling) {
        rollDice();
      }
    }, 7000);
    return () => clearInterval(timer);
  }, [isRolling]);

  // Live Heists Feed random update ticker
  useEffect(() => {
    const heistTypes: Array<HeistEvent["type"]> = ["blessing", "tax", "stash", "legendary", "safe"];
    const outcomeNames = {
      blessing: "Robin's Blessing",
      tax: "Sheriff's Tax",
      stash: "Hidden Stash",
      legendary: "Legendary Heist",
      safe: "Safe Escape"
    };
    const bonuses = {
      blessing: "+25%",
      tax: "-10%",
      stash: "+50%",
      legendary: "2X",
      safe: "Standard"
    };

    const interval = setInterval(() => {
      const randomType = heistTypes[Math.floor(Math.random() * heistTypes.length)];
      const randomAmountVal = Math.floor(Math.random() * 200) + 50;
      const randomAmount = (randomAmountVal * 1000).toLocaleString();
      const mockHex = "0x" + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0") + "..." + Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
      
      const newHeist: HeistEvent = {
        id: Date.now().toString(),
        txHash: mockHex,
        type: randomType,
        outcomeName: outcomeNames[randomType],
        amount: randomAmount,
        bonus: bonuses[randomType],
        time: "Just now"
      };

      setHeists(prev => [newHeist, ...prev.slice(0, 4)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Ambient Canvas Embers/Sparks Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: EmbersParticle[] = [];
    const particleCount = 65; // Increased count for high fidelity sparks

    for (let i = 0; i < particleCount; i++) {
      particles.push(new EmbersParticle(width, height));
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update(width, height);
        p.draw(ctx);
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // GSAP Parallax scrolling choreography
  useGSAP(() => {
    if (!containerRef.current) return;

    // Background slow parallax translation
    gsap.to(backgroundRef.current, {
      yPercent: -15,
      ease: "none",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    // Fade out Hero details on scroll
    gsap.to(".hero-details", {
      opacity: 0,
      y: -60,
      ease: "power1.out",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "60% top",
        scrub: true
      }
    });

    // Fade out Live Feed on scroll
    gsap.to(".hero-feed", {
      opacity: 0,
      y: -40,
      ease: "power1.out",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "60% top",
        scrub: true
      }
    });

    // Scroll reveal sections
    gsap.from(".reveal-heist-engine > *", {
      opacity: 0,
      y: 40,
      duration: 0.8,
      stagger: 0.15,
      scrollTrigger: {
        trigger: ".reveal-heist-engine",
        start: "top 75%",
        toggleActions: "play none none reverse"
      }
    });

    gsap.from(".reveal-map > *", {
      opacity: 0,
      y: 45,
      duration: 0.9,
      stagger: 0.18,
      scrollTrigger: {
        trigger: ".reveal-map",
        start: "top 75%",
        toggleActions: "play none none reverse"
      }
    });

    gsap.from(".reveal-heists-stats > *", {
      opacity: 0,
      y: 40,
      duration: 0.8,
      stagger: 0.15,
      scrollTrigger: {
        trigger: ".reveal-heists-stats",
        start: "top 75%",
        toggleActions: "play none none reverse"
      }
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative min-h-screen bg-void text-foreground select-none overflow-x-hidden">
      
      {/* Background Embers Canvas (cinematic flying sparks) */}
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-10 opacity-75 mix-blend-screen"
      />

      {/* Volumetric Fog Layers */}
      <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
        <div className="absolute w-[200%] h-[50%] top-[35%] left-0 opacity-15 bg-gradient-to-t from-transparent via-[#6c5ce7]/10 to-transparent blur-3xl animate-fog-drift" style={{ willChange: 'transform' }} />
        <div className="absolute w-[200%] h-[35%] top-[15%] left-[-50%] opacity-10 bg-gradient-to-t from-transparent via-[#c5a059]/5 to-transparent blur-3xl animate-fog-drift" style={{ animationDirection: 'reverse', willChange: 'transform' }} />
      </div>

      {/* Floating Header */}
      <header className="fixed top-0 left-0 w-full z-50 transition-all duration-300 border-b border-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Real Logo image replacement */}
            <img 
              src="/assets/logo.png" 
              alt="Outlaw Capital Logo" 
              className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(197,160,89,0.5)] transition-transform duration-300 hover:scale-105" 
            />
            <div className="flex flex-col">
              <span className="font-serif text-lg tracking-[0.25em] text-white gold-glow font-bold">OUTLAW</span>
              <span className="text-[0.6rem] font-serif tracking-[0.45em] text-gold mt-[-3px]">CAPITAL</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-space text-[10px] tracking-[0.22em] text-slate-400 uppercase">
            <a href="#heist-engine" className="hover:text-gold transition-colors duration-200">Engine</a>
            <a href="#kingdom-map" className="hover:text-gold transition-colors duration-200">Kingdom Map</a>
            <a href="#guild-records" className="hover:text-gold transition-colors duration-200">Guild Records</a>
            <a href="#statistics" className="hover:text-gold transition-colors duration-200">Stats</a>
            <a href="#quest-log" className="hover:text-gold transition-colors duration-200">Saga Quest</a>
          </nav>

          <button className="jrpg-btn-gold text-[10px] md:text-xs">
            Connect Wallet
            <span className="absolute top-[3px] right-[4px] w-1.5 h-1.5 bg-gold rounded-full animate-ping" />
          </button>
        </div>
      </header>

      {/* SECTION 1: HERO VIEWPORT */}
      <section ref={heroRef} className="relative w-full min-h-screen flex flex-col justify-between pt-24 pb-20 z-20">
        
        {/* HIGH QUALITY PARALLAX BACKDROP LAYERS */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Base Layout Background (High Quality Image) */}
          <div 
            ref={backgroundRef} 
            className="absolute inset-0 bg-cover bg-center select-none"
            style={{ 
              backgroundImage: "url('/assets/castle_moon_bg.png')",
              transform: "scale(1.15)",
              willChange: "transform"
            }}
          />

          {/* Bottom void gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent pointer-events-none" />

          {/* Interactive HTML Floating Dice placed precisely over the illustrated glowing dice in the center */}
          <div 
            ref={diceRef}
            className="absolute bottom-[49%] md:bottom-[50.8%] left-[45%] md:left-[51.1%] z-20 pointer-events-none transform -translate-x-1/2"
            style={{ willChange: "transform" }}
          >
            {/* The 3D CSS dice spins slowly and glows over the JRPG background's dice */}
            <div className="scene-dice animate-float drop-shadow-[0_0_20px_rgba(197,160,89,0.7)] scale-[0.8] md:scale-100">
              <div className="dice-3d">
                <div className="dice-face dice-face-front">I</div>
                <div className="dice-face dice-face-back">VI</div>
                <div className="dice-face dice-face-right">III</div>
                <div className="dice-face dice-face-left">IV</div>
                <div className="dice-face dice-face-top">V</div>
                <div className="dice-face dice-face-bottom">II</div>
              </div>
            </div>
            {/* Ambient light blooms behind the dice */}
            <div className="absolute top-[10px] left-[10px] w-[30px] h-[30px] rounded-full bg-gold/20 blur-md animate-pulse pointer-events-none" />
          </div>
        </div>

        {/* HERO DETAILS */}
        <div className="max-w-7xl mx-auto px-6 w-full flex-grow flex items-center mt-12 md:mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-center">
            
            <div className="lg:col-span-7 hero-details flex flex-col items-start text-left select-none z-30">
              <span className="text-gold font-serif text-[10px] md:text-[11px] tracking-[0.35em] uppercase mb-4 block font-bold">
                Bootstrap Markets. Play To Earn.
              </span>
              
              <h1 className="font-serif text-5xl md:text-[5.5rem] font-bold tracking-[0.05em] text-white mb-6 leading-[1.1] md:leading-[1.12] gold-glow uppercase">
                Every Trade <br />
                <span className="text-gold gold-glow-strong">Is A Heist</span>
              </h1>

              {/* JRPG Core Lore Text & Description updated per instructions */}
              <div className="border-l-2 border-gold/40 pl-4 py-2 mb-8 max-w-xl">
                <p className="text-white/95 font-serif italic text-sm md:text-base leading-relaxed tracking-wide mb-2">
                  &ldquo;The Kingdom has fallen. The Crown owns every coin. Only the Outlaws remain. Every trade is another heist.&rdquo;
                </p>
                <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem]">
                  Outlaw Capital is an on-chain protocol where every trade is a gamble, and every gamble becomes a story.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <a href="#heist-engine" className="jrpg-btn-gold text-xs text-center min-w-[160px]">
                  Enter The Heist
                </a>
                <a href="#heist-engine" className="jrpg-btn-glass text-xs text-center min-w-[160px]">
                  Roll The Dice
                </a>
              </div>
            </div>

            {/* LIVE FEED PANEL - Polished solid black cards styled like game interface */}
            <div className="lg:col-span-5 hero-feed flex justify-end items-center z-30">
              <div className="w-full max-w-[340px] jrpg-panel-gold p-6 select-none relative overflow-hidden bg-[#000000] shadow-[0_15px_40px_rgba(0,0,0,0.85)]">
                {/* Gold corner brackets */}
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-gold" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-gold" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-gold" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-gold" />

                <div className="flex items-center justify-between border-b border-gold/15 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Dice5 className="w-4 h-4 text-gold" />
                    <span className="font-serif text-[10px] tracking-[0.25em] text-white uppercase font-bold">Live Heists</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-space tracking-widest text-emerald-500 uppercase font-bold">Live</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3.5 min-h-[220px]">
                  {heists.slice(0, 3).map((h) => (
                    <div 
                      key={h.id} 
                      className={`relative flex items-center justify-between p-3.5 rounded bg-[#000000] border transition-all duration-300 hover:border-gold/30 hover:bg-[#08080c] ${
                        h.type === "legendary" ? "shadow-[0_0_15px_rgba(197,160,89,0.25)] border-gold/45" : "border-gold/15"
                      }`}
                    >
                      {/* Sub-card gold JRPG corner notches */}
                      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold/60" />
                      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gold/60" />
                      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gold/60" />
                      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gold/60" />

                      <div className="flex items-center gap-3 w-full">
                        {/* Gold ringed custom SVG icon frame */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                          h.type === "blessing" ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5 shadow-[0_0_8px_rgba(16,185,129,0.15)]" :
                          h.type === "tax" ? "border-rose-500/40 text-rose-500 bg-rose-500/5 shadow-[0_0_8px_rgba(244,63,94,0.15)]" :
                          h.type === "stash" ? "border-amber-500/40 text-amber-500 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.15)]" :
                          h.type === "legendary" ? "border-gold text-gold bg-gold/10 shadow-[0_0_10px_rgba(197,160,89,0.3)]" :
                          "border-slate-500/40 text-slate-400 bg-slate-500/5"
                        }`}>
                          {h.type === "blessing" && blessingIcon}
                          {h.type === "tax" && taxIcon}
                          {h.type === "stash" && stashIcon}
                          {h.type === "legendary" && legendaryIcon}
                          {h.type === "safe" && safeIcon}
                        </div>

                        {/* Thin vertical JRPG divider */}
                        <div className="h-7 w-[1px] bg-gold/15" />

                        {/* Text Grid layout matching second mockup exactly */}
                        <div className="flex-grow flex flex-col justify-between">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[9px] font-space text-slate-400 font-bold uppercase tracking-wider">{h.txHash}</span>
                            <span className={`text-[10px] font-space font-bold uppercase tracking-wider ${
                              h.type === "tax" ? "text-rose-500" :
                              h.type === "legendary" ? "text-gold" : "text-emerald-500"
                            }`}>{h.bonus}</span>
                          </div>
                          <div className="flex justify-between items-center w-full mt-0.5">
                            <span className={`text-xs font-serif font-bold uppercase tracking-wide ${
                              h.type === "legendary" ? "text-gold" : "text-white"
                            }`}>{h.outcomeName}</span>
                            <span className="text-[9px] font-space text-slate-500 font-medium">{h.time}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
                
                <div className="border-t border-gold/10 mt-5 pt-3 text-center">
                  <a href="#guild-records" className="font-serif text-[10px] tracking-[0.25em] text-gold hover:text-white transition-colors duration-200 uppercase font-bold">
                    View All Heists &gt;
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* RE-ORDERED JRPG SECTIONS CONTAINER */}
      <main className="relative z-20 max-w-7xl mx-auto px-6 py-12 flex flex-col gap-28">

        {/* SECTION 2: THE HEIST ENGINE (OUTCOMES LEDGER & EXPANDED ARCHIVAL MANUAL) */}
        <section id="heist-engine" className="reveal-heist-engine flex flex-col items-center">
          <div className="max-w-3xl text-center mb-12">
            <span className="text-gold font-serif text-[10px] tracking-[0.35em] uppercase mb-3 block font-bold">
              Archival Manual
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 uppercase gold-glow">
              The Heist Engine
            </h2>
            <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem] mx-auto">
              Every trade ending in <span className="text-gold font-bold font-space">.67</span> triggers Heist Mode. Siphon value directly from the central Treasury.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-center">
            
            {/* Left side: Outcomes list styled as a medieval ledger */}
            <div className="lg:col-span-8 flex flex-col gap-3.5 w-full">
              <div className="font-serif text-xs tracking-widest text-gold uppercase border-b border-gold/15 pb-2 mb-2 grid grid-cols-12 px-4 font-bold">
                <span className="col-span-4 md:col-span-3">Outcome</span>
                <span className="col-span-2 text-center">Chance</span>
                <span className="col-span-2 text-center">Settle</span>
                <span className="col-span-4 md:col-span-5 text-left pl-6">Details</span>
              </div>
              
              {outcomes.map((outcome, idx) => (
                <div 
                  key={outcome.name} 
                  className={`relative grid grid-cols-12 items-center px-4 py-3.5 border transition-all duration-300 rounded ${
                    activeOutcomeIndex === idx 
                      ? "bg-gold/5 border-gold/80 shadow-[0_0_15px_rgba(197,160,89,0.2)] scale-[1.01]" 
                      : "bg-[#0d0e14]/90 border-white/5 hover:border-gold/15"
                  }`}
                >
                  {/* Ledger row corner notches */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold/40" />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gold/40" />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gold/40" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gold/40" />

                  <div className="col-span-4 md:col-span-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                    <span className="font-serif text-xs md:text-sm font-bold text-white tracking-wide">{outcome.name}</span>
                  </div>
                  <div className="col-span-2 text-center font-space text-xs text-slate-400 font-bold">{outcome.chance}</div>
                  <div className={`col-span-2 text-center font-space text-xs font-bold ${outcome.color}`}>{outcome.change}</div>
                  <div className="col-span-4 md:col-span-5 text-left text-[11px] md:text-xs text-slate-400 pl-6 leading-relaxed font-sans flex flex-col">
                    <span>{outcome.desc}</span>
                    <span className="text-[10px] text-gold/60 italic font-serif mt-0.5">&ldquo;{outcome.flavor}&rdquo;</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right side: Large 3D Gold Dice Simulator */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center jrpg-panel-gold p-8 border border-gold/15 rounded relative min-h-[380px]">
              
              {/* Gold borders */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gold" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gold" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gold" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gold" />

              <span className="font-serif text-[10px] tracking-widest text-gold uppercase font-bold mb-8">Simulation Roll</span>

              <div className="relative w-24 h-24 flex items-center justify-center mb-8">
                {/* Large 3D Dice */}
                <div 
                  className={`scene-dice ${
                    isRolling ? "scale-95 filter drop-shadow-[0_0_30px_rgba(197,160,89,0.9)]" : "drop-shadow-[0_0_20px_rgba(197,160,89,0.6)]"
                  }`}
                  style={{ width: '80px', height: '80px' }}
                >
                  <div 
                    className="dice-3d" 
                    style={{ 
                      animation: isRolling ? "diceSpin 0.3s linear infinite" : "diceSpin 20s linear infinite",
                      transform: isRolling ? "none" : undefined
                    }}
                  >
                    <div className="dice-face dice-face-front" style={{ width: '80px', height: '80px', transform: 'rotateY(0deg) translateZ(40px)', fontSize: '1.75rem' }}>{currentDiceFace}</div>
                    <div className="dice-face dice-face-back" style={{ width: '80px', height: '80px', transform: 'rotateY(180deg) translateZ(40px)', fontSize: '1.75rem' }}>VI</div>
                    <div className="dice-face dice-face-right" style={{ width: '80px', height: '80px', transform: 'rotateY(90deg) translateZ(40px)', fontSize: '1.75rem' }}>III</div>
                    <div className="dice-face dice-face-left" style={{ width: '80px', height: '80px', transform: 'rotateY(-90deg) translateZ(40px)', fontSize: '1.75rem' }}>IV</div>
                    <div className="dice-face dice-face-top" style={{ width: '80px', height: '80px', transform: 'rotateX(90deg) translateZ(40px)', fontSize: '1.75rem' }}>V</div>
                    <div className="dice-face dice-face-bottom" style={{ width: '80px', height: '80px', transform: 'rotateX(-90deg) translateZ(40px)', fontSize: '1.75rem' }}>II</div>
                  </div>
                </div>
                {/* Dice shadow base */}
                <div className="absolute bottom-[-15px] w-16 h-2 bg-black/40 rounded-full blur-sm" />
              </div>

              {/* Controls */}
              <button 
                onClick={rollDice} 
                disabled={isRolling}
                className="jrpg-btn-gold text-[10px] w-full max-w-[200px]"
              >
                {isRolling ? "Breaching..." : "Roll Dice"}
              </button>

              {/* Action logs */}
              <div className="mt-6 p-3 rounded bg-void/50 border border-white/5 w-full text-center text-xs min-h-[50px] flex items-center justify-center font-serif tracking-wide border-l-2 border-gold/40">
                <span className="text-slate-300 text-[11px] leading-relaxed">{engineLog}</span>
              </div>
            </div>

          </div>

          {/* EXPANDED ARCHIVAL MANUAL: ON-CHAIN PSEUDO RNG DETAILS */}
          <div className="w-full mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch text-left">
            
            {/* Column 1: Cryptographic Entropy */}
            <div className="jrpg-panel p-6 rounded relative bg-[#000000]/95 border border-gold/15">
              <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-gold" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-gold" />
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-gold" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-gold" />
              
              <span className="text-gold font-serif text-[9px] tracking-[0.35em] uppercase mb-2 block font-bold">Consensus Cryptography</span>
              <h3 className="font-serif text-lg text-white font-bold uppercase tracking-wider mb-3">On-Chain Block Entropy</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-sans mb-4">
                Atomically executed inside the `HeistEngine` smart contract. The contract requests entropy by combining the preceding block header hash `blockhash(block.number - 1)`, validator beacon randomness `block.prevrandao`, and client wallet address `msg.sender` into a Keccak-256 seed.
              </p>
              <div className="p-3 bg-void/70 border border-gold/10 rounded font-space text-[10px] text-gold/90 break-all">
                <code>seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), msg.sender, block.prevrandao)));</code>
              </div>
            </div>

            {/* Column 2: Provably Fair Proofs */}
            <div className="jrpg-panel p-6 rounded relative bg-[#000000]/95 border border-gold/15">
              <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-gold" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-gold" />
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-gold" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-gold" />

              <span className="text-gold font-serif text-[9px] tracking-[0.35em] uppercase mb-2 block font-bold">Provably Fair</span>
              <h3 className="font-serif text-lg text-white font-bold uppercase tracking-wider mb-3">Auditable Verification</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-sans mb-4">
                Since the block hash of a transaction's processing block cannot be predicted before mining, neither players nor the contract owners can manipulate outcomes. Any roll's mathematical proof is public and can be verified using transaction logs.
              </p>
              <a 
                href="https://robinhoodchain.blockscout.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1 text-[10px] font-space text-gold hover:text-white transition-colors duration-200 uppercase font-bold tracking-widest mt-2"
              >
                Verify on Chain Explorer <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </section>

        {/* SECTION 3: THE KINGDOM MAP (PROTOCOL ARCHITECTURE) */}
        <section id="kingdom-map" className="reveal-map flex flex-col items-center">
          <div className="max-w-3xl text-center mb-12">
            <span className="text-gold font-serif text-[10px] tracking-[0.35em] uppercase mb-3 block font-bold">
              Cartographic Archives
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 uppercase gold-glow">
              The Kingdom Map
            </h2>
            <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem] mx-auto">
              Explore the physical geography of the Outlaw Capital ecosystem. Hover over castles and guilds to trace the siphoned gold path.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
            
            {/* Left side: The hand-illustrated JRPG Vector map */}
            <div className="lg:col-span-8 jrpg-panel p-4 border border-gold/15 rounded relative flex items-center justify-center bg-[#07070d] overflow-hidden min-h-[460px]">
              
              {/* Map background grids/vignette */}
              <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/80 pointer-events-none" />
              
              {/* Interactive JRPG SVG Map */}
              <svg 
                className="w-full h-full max-w-[640px] aspect-[4/3] text-gold/30 select-none z-10" 
                viewBox="0 0 400 300"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Landmass contours */}
                <path d="M 30 220 Q 50 250 110 240 Q 150 230 180 260 Q 220 280 280 260 Q 340 240 370 210 Q 390 170 380 120 Q 360 80 320 60 Q 280 40 210 30 Q 140 25 90 60 Q 40 90 25 150 Z" fill="#0b0b14" stroke="rgba(197,160,89,0.15)" strokeWidth="1.5" />
                <path d="M 50 140 Q 90 120 130 150 Q 170 170 200 130 Q 240 100 290 120 Q 330 150 350 180" fill="none" stroke="rgba(197,160,89,0.08)" strokeWidth="1" strokeDasharray="3 3" />

                {/* Dotted Golden Paths (Connecting roads) */}
                {/* Crown to Outlaw Bridge */}
                <path d="M 85 100 Q 140 105 185 125" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
                {/* Outlaw to Heist Engine */}
                <path d="M 230 150 Q 250 190 270 215" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
                {/* Heist Engine to Reward Vault */}
                <path d="M 255 230 Q 180 240 135 220" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
                {/* Reward Vault to Outlaw Capital */}
                <path d="M 125 200 Q 140 175 190 160" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
                {/* Launch Guild to Outlaw Capital */}
                <path d="M 315 90 Q 280 110 225 130" stroke="#d4af37" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.6" />
                {/* Liquidity Bridge path */}
                <path d="M 125 60 Q 220 50 300 70" stroke="#d4af37" strokeWidth="1" strokeDasharray="6 6" fill="none" opacity="0.4" />

                {/* LANDMARK: The Crown */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("crown")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="80" cy="95" r="16" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "crown" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  <path d="M 72 99 L 72 90 L 76 94 L 80 87 L 84 94 L 88 90 L 88 99 Z" fill={activeLandmark === "crown" ? "#d4af37" : "#a18a4d"} className="transition-all duration-300" />
                  <circle cx="80" cy="95" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="80" y="120" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">THE CROWN</text>
                </g>

                {/* LANDMARK: Outlaw Capital (Central Hub) */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("outlaw")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="205" cy="140" r="20" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "outlaw" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Guild Castle Shield */}
                  <path d="M 197 132 L 213 132 L 213 142 Q 205 152 197 142 Z" fill={activeLandmark === "outlaw" ? "#d4af37" : "#a18a4d"} className="transition-all duration-300" />
                  <circle cx="205" cy="140" r="3" fill="#d4af37" className="animate-ping" />
                  <text x="205" y="170" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">OUTLAW CAPITAL</text>
                </g>

                {/* LANDMARK: The Heist Engine */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("engine")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="280" cy="225" r="16" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "engine" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Dice icon */}
                  <rect x="274" y="219" width="12" height="12" rx="2" fill={activeLandmark === "engine" ? "#d4af37" : "#a18a4d"} className="transition-all duration-300" />
                  <circle cx="280" cy="225" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="280" y="250" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">HEIST ENGINE</text>
                </g>

                {/* LANDMARK: Reward Vault */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("vault")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="115" cy="210" r="16" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "vault" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Chest icon */}
                  <path d="M 107 207 L 123 207 L 123 216 L 107 216 Z" fill={activeLandmark === "vault" ? "#d4af37" : "#a18a4d"} className="transition-all duration-300" />
                  <circle cx="115" cy="210" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="115" y="235" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">REWARD VAULT</text>
                </g>

                {/* LANDMARK: Launch Guild */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("guild")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="320" cy="80" r="15" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "guild" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Swords icon */}
                  <path d="M 314 74 L 326 86 M 326 74 L 314 86" stroke={activeLandmark === "guild" ? "#d4af37" : "#a18a4d"} strokeWidth="1.5" className="transition-all duration-300" />
                  <circle cx="320" cy="80" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="320" y="105" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">LAUNCH GUILD</text>
                </g>

                {/* LANDMARK: Liquidity Bridge */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("bridge")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="210" cy="55" r="14" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "bridge" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Bridge arch */}
                  <path d="M 202 59 Q 210 50 218 59" stroke={activeLandmark === "bridge" ? "#d4af37" : "#a18a4d"} strokeWidth="2" fill="none" className="transition-all duration-300" />
                  <circle cx="210" cy="55" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="210" y="80" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">LIQUIDITY BRIDGE</text>
                </g>

                {/* LANDMARK: Guild Records */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("records")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="160" cy="250" r="14" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "records" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  {/* Scroll icon */}
                  <path d="M 154 246 L 166 246 L 166 254 L 154 254 Z" fill={activeLandmark === "records" ? "#d4af37" : "#a18a4d"} className="transition-all duration-300" />
                  <circle cx="160" cy="250" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="160" y="272" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">GUILD RECORDS</text>
                </g>

                {/* LANDMARK: The Treasury */}
                <g 
                  className="cursor-pointer group"
                  onMouseEnter={() => setActiveLandmark("treasury")}
                  onMouseLeave={() => setActiveLandmark(null)}
                >
                  <circle cx="45" cy="165" r="14" fill="rgba(20,20,30,0.85)" stroke={activeLandmark === "treasury" ? "#d4af37" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                  <circle cx="45" cy="165" r="4" stroke={activeLandmark === "treasury" ? "#d4af37" : "#a18a4d"} strokeWidth="1.5" fill="none" className="transition-all duration-300" />
                  <circle cx="45" cy="165" r="2" fill="#d4af37" className="animate-ping" />
                  <text x="45" y="188" textAnchor="middle" className="font-serif text-[7px] tracking-widest fill-slate-300 font-bold">THE TREASURY</text>
                </g>
              </svg>
            </div>

            {/* Right side: Interactive glass description panel with JRPG corners */}
            <div className="lg:col-span-4 flex flex-col justify-between jrpg-panel-gold p-6 border border-gold/15 rounded relative">
              <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-gold" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-gold" />
              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-gold" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-gold" />

              {activeLandmark && landmarks[activeLandmark] ? (
                <div className="flex flex-col text-left h-full justify-between gap-6">
                  <div>
                    <span className="text-[10px] font-space tracking-widest text-gold uppercase font-bold block mb-1">
                      {landmarks[activeLandmark].subtitle}
                    </span>
                    <h3 className="font-serif text-2xl text-white font-bold gold-glow uppercase mb-4">
                      {landmarks[activeLandmark].title}
                    </h3>
                    <p className="text-slate-300/90 text-xs md:text-sm leading-relaxed mb-4 font-sans max-w-[32rem]">
                      {landmarks[activeLandmark].description}
                    </p>
                    
                    <div className="border-t border-gold/10 pt-4 mt-4">
                      <span className="text-[9px] font-serif tracking-[0.25em] text-gold uppercase font-bold block mb-1">Guild Archives</span>
                      <p className="text-slate-400 text-xs italic font-serif leading-relaxed">
                        &ldquo;{landmarks[activeLandmark].lore}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gold/5 border border-gold/10 rounded flex items-start gap-2 text-left relative">
                    {/* Inner gold corners */}
                    <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-gold/40" />
                    <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-gold/40" />
                    <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-gold/40" />
                    <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-gold/40" />
                    
                    <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] font-space tracking-wider text-white uppercase font-bold block mb-0.5">Core Function</span>
                      <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{landmarks[activeLandmark].mechanic}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full gap-4 py-8">
                  <Compass className="w-10 h-10 text-gold/40 animate-pulse-glow" />
                  <h3 className="font-serif text-lg text-slate-300 uppercase tracking-widest font-bold">Cartographer</h3>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-[240px] font-sans">
                    Hover over any landmark on the kingdom chart to inspect its role inside the Outlaw ecosystem.
                  </p>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* SECTION 4: MULTIPLAYER LIVE HEISTS (POLISHED SOLID BLACK CARDS) */}
        <section id="guild-records" className="reveal-heists-stats flex flex-col items-center">
          <div className="max-w-3xl text-center mb-12">
            <span className="text-gold font-serif text-[10px] tracking-[0.35em] uppercase mb-3 block font-bold">
              Guild Activity Log
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 uppercase gold-glow">
              Recent Heists
            </h2>
            <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem] mx-auto">
              Real-time records of outlaws breaching the treasury. Watch the legendary runs settle live.
            </p>
          </div>

          {/* Activity Log Grid - Polished solid black cards with custom SVG icons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {heists.map((h) => (
              <div 
                key={h.id} 
                className={`relative flex items-center justify-between p-5 bg-[#000000] border transition-all duration-500 hover:bg-[#08080c] hover:border-gold/40 hover:-translate-y-0.5 ${
                  h.type === "legendary" 
                    ? "border-gold/45 bg-gold/5 shadow-[0_0_20px_rgba(197,160,89,0.18)]" 
                    : "border-gold/15"
                }`}
              >
                {/* Gold corner brackets for full game interface feel */}
                <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${h.type === "legendary" ? "border-gold" : "border-gold/50"}`} />
                <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${h.type === "legendary" ? "border-gold" : "border-gold/50"}`} />
                <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${h.type === "legendary" ? "border-gold" : "border-gold/50"}`} />
                <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${h.type === "legendary" ? "border-gold" : "border-gold/50"}`} />

                {/* Glowing sparks for legendary runs */}
                {h.type === "legendary" && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <span className="absolute top-[20%] left-[10%] w-1.5 h-1.5 bg-gold rounded-full animate-ping" />
                    <span className="absolute bottom-[20%] right-[15%] w-1 h-1 bg-gold rounded-full animate-ping" style={{ animationDelay: '1.2s' }} />
                  </div>
                )}

                <div className="flex items-center gap-4 w-full">
                  {/* Gold ringed custom SVG icon frame */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    h.type === "blessing" ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5 shadow-[0_0_8px_rgba(16,185,129,0.2)]" :
                    h.type === "tax" ? "border-rose-500/40 text-rose-500 bg-rose-500/5 shadow-[0_0_8px_rgba(244,63,94,0.2)]" :
                    h.type === "stash" ? "border-amber-500/40 text-amber-500 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.2)]" :
                    h.type === "legendary" ? "border-gold text-gold bg-gold/10 shadow-[0_0_12px_rgba(197,160,89,0.45)] animate-pulse-glow" :
                    "border-slate-500/40 text-slate-400 bg-slate-500/5"
                  }`}>
                    {h.type === "blessing" && blessingIcon}
                    {h.type === "tax" && taxIcon}
                    {h.type === "stash" && stashIcon}
                    {h.type === "legendary" && legendaryIcon}
                    {h.type === "safe" && safeIcon}
                  </div>
                  
                  {/* Thin vertical JRPG divider */}
                  <div className={`h-8 w-[1px] ${h.type === "legendary" ? "bg-gold/30" : "bg-gold/15"}`} />

                  {/* Text columns aligned exactly to mockup */}
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-space font-bold text-white tracking-wide">{h.txHash}</span>
                      <span className={`text-[10px] font-space font-bold uppercase tracking-wider ${
                        h.type === "tax" ? "text-rose-500" :
                        h.type === "legendary" ? "text-gold animate-pulse" : "text-emerald-500"
                      }`}>{h.bonus}</span>
                    </div>
                    <div className="flex justify-between items-center w-full mt-0.5">
                      <span className={`text-sm font-serif font-bold uppercase tracking-wider ${
                        h.type === "legendary" ? "text-gold" : "text-slate-300"
                      }`}>{h.outcomeName}</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-space text-slate-500">{h.time}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: PROTOCOL STATISTICS (POLISHED JRPG HUD) */}
        <section id="statistics" className="flex flex-col items-center">
          <div className="max-w-3xl text-center mb-12">
            <span className="text-gold font-serif text-[10px] tracking-[0.35em] uppercase mb-3 block font-bold">
              Ledger Settle
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-white mb-4 uppercase gold-glow">
              Protocol Statistics
            </h2>
            <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem] mx-auto">
              Real-time performance figures validating the adoption of the Heist Engine.
            </p>
          </div>

          <div className="w-full jrpg-panel-gold p-8 border border-gold/15 rounded relative overflow-hidden bg-[#000000] shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
            {/* Gold corner brackets for full game interface feel */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gold" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gold" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gold" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gold" />

            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6 items-center text-center">
              
              <div className="flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Total Markets</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">87</span>
              </div>
              
              <div className="flex flex-col items-center justify-center border-l border-gold/15">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
                  <Coins className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Trading Volume</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">$12.43M</span>
              </div>
              
              <div className="flex flex-col items-center justify-center border-l border-gold/15">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)] animate-spin-slow">
                  <Dice5 className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Active Heists</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">1,247</span>
              </div>
              
              <div className="flex flex-col items-center justify-center border-l border-gold/15">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
                  <Crown className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Legendary Heists</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">312</span>
              </div>
              
              <div className="flex flex-col items-center justify-center border-l border-gold/15">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Total Rewards</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">$2.78M</span>
              </div>
              
              <div className="flex flex-col items-center justify-center border-l border-gold/15">
                <div className="w-10 h-10 rounded-full border border-gold/30 bg-void/40 flex items-center justify-center text-gold mb-3 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-serif tracking-widest text-slate-400 uppercase font-bold mb-1">Total TVL</span>
                <span className="text-2xl font-space font-bold text-white tracking-wider">$8.91M</span>
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 6: SAGA QUEST (ROADMAP) */}
        <section id="quest-log" className="reveal-map flex flex-col items-center">
          <div className="max-w-3xl text-center mb-16">
            <span className="text-gold font-serif text-[10px] tracking-[0.35em] uppercase mb-4 block font-bold">
              Adventure Timeline
            </span>
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-white mb-6 uppercase gold-glow">
              Saga Quest
            </h2>
            <p className="text-slate-400/90 text-xs md:text-sm leading-relaxed font-sans max-w-[32rem] mx-auto">
              Follow the roadmap of the Outlaw faction. The vault is massive, and we are only breaching the first gates.
            </p>
          </div>

          <div className="max-w-4xl w-full flex flex-col gap-6 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-[1px] before:bg-gradient-to-b before:from-gold/30 before:via-white/5 before:to-transparent">
            
            {/* Quest 1 - Innovated description explaining smart contract architecture */}
            <div className="quest-node flex gap-6 items-start text-left relative pl-12">
              <div className="absolute left-4 top-[6px] w-4 h-4 rounded-full bg-gold border border-void flex items-center justify-center z-10 shadow-[0_0_8px_rgba(197, 160, 89, 0.7)]">
                <CheckCircle className="w-3.5 h-3.5 text-void fill-gold" />
              </div>
              
              <div className="jrpg-panel p-5 rounded border-l-2 border-emerald-500 flex-grow relative bg-[#000000] border border-gold/15">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold/40" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gold/40" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gold/40" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gold/40" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="font-serif text-base tracking-widest text-white uppercase font-bold">Quest I: Assembly of the Guild</h3>
                  <span className="text-[9px] font-space tracking-widest text-emerald-500 uppercase font-bold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit">Completed</span>
                </div>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-sans mb-3">
                  Forge the core smart contracts, deploy the gas-optimized $OUTLAW ERC-20 token with EIP-2612 permit capabilities, initialize the custom Factory deployment architecture, and launch the out-of-range Uniswap V3 liquidity positions.
                </p>
                <div className="text-[10px] font-space text-gold flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" /> Settled in July 2026
                </div>
              </div>
            </div>

            {/* Quest 2 */}
            <div className="quest-node flex gap-6 items-start text-left relative pl-12">
              <div className="absolute left-4 top-[6px] w-4 h-4 rounded-full bg-amber-500 border border-void flex items-center justify-center z-10 shadow-[0_0_8px_rgba(245,158,11,0.7)]">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              </div>
              
              <div className="jrpg-panel-gold p-5 rounded flex-grow relative bg-[#000000] border border-gold/20">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold/40" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gold/40" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gold/40" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gold/40" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="font-serif text-base tracking-widest text-white uppercase font-bold">Quest II: Vault Breach</h3>
                  <span className="text-[9px] font-space tracking-widest text-amber-500 uppercase font-bold px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full w-fit animate-pulse">Active</span>
                </div>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-3 font-sans">
                  Deploy the Heist Engine frontend interface, allow users to sign transactions gaslessly on Robinhood Chain, enable interactive Heist mode trades, and initiate mock live event feeds.
                </p>
                <div className="text-[10px] font-space text-gold flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 animate-spin-slow" /> Quest in progress
                </div>
              </div>
            </div>

            {/* Quest 3 */}
            <div className="quest-node flex gap-6 items-start text-left relative pl-12">
              <div className="absolute left-4 top-[6px] w-4 h-4 rounded-full bg-slate-700 border border-void flex items-center justify-center z-10">
                <Lock className="w-2.5 h-2.5 text-slate-500" />
              </div>
              
              <div className="jrpg-panel p-5 rounded border-l-2 border-white/5 opacity-55 flex-grow relative bg-[#000000] border border-gold/15">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gold/40" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gold/40" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gold/40" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gold/40" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="font-serif text-base tracking-widest text-slate-300 uppercase font-bold">Quest III: Sovereign Outlaws</h3>
                  <span className="text-[9px] font-space tracking-widest text-slate-500 uppercase font-bold px-2 py-0.5 bg-slate-500/5 border border-white/5 rounded-full w-fit">Locked</span>
                </div>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-sans mb-3">
                  Introduce governance-locked staking vaults, enable guild raids (multi-user combined pools targeting specific vault parameters), and deploy cross-chain token bridges.
                </p>
                <div className="text-[10px] font-space text-slate-500 flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5" /> Requires Quest II completion
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="relative z-20 border-t border-gold/15 bg-void py-12 select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            {/* Real Logo image replacement in footer */}
            <img 
              src="/assets/logo.png" 
              alt="Outlaw Capital Logo" 
              className="w-8 h-8 object-contain opacity-80" 
            />
            <span className="font-serif text-sm tracking-[0.25em] text-white font-bold uppercase">Outlaw Capital</span>
          </div>
          
          <div className="flex gap-8 text-[10px] font-serif tracking-widest text-slate-400 uppercase">
            <a href="#terms" className="hover:text-gold transition-colors duration-200">Terms of Siege</a>
            <a href="#privacy" className="hover:text-gold transition-colors duration-200">Privacy Policy</a>
            <a href="#contact" className="hover:text-gold transition-colors duration-200">Send Messenger</a>
          </div>

          <div className="text-[10px] font-space text-slate-500">
            &copy; 2026 Outlaw Capital. All rights of rebellion reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
