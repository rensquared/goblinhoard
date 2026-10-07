export type GoblinRole =
  | "CHIEFTAIN_GUARD"
  | "MINER"
  | "FORAGER"
  | "SENTRY"
  | "HOARD_KEEPER"
  | "FIRE_TENDER"
  | "WARRIOR";

export type GoblinBehaviorState =
  | "IDLE"
  | "RESTING"
  | "EATING"
  | "TALKING"
  | "WORKING"
  | "WALKING"
  | "GUARDING"
  | "CARRYING"
  | "RAIDING";

export interface GoblinStrategyDNA {
  name: string;
  takeProfitPct: number;
  stopLossPct: number;
  trailingStopPct: number;
  winRatePct: number;
  totalLootEth: number;
  raidsCount: number;
}

export interface GoblinEntity {
  id: string;               // e.g. "GOB-001"
  walletAddress: string;    // Vanity mock address for Robinhood Chain e.g. "0x7bBEE...4663"
  displayName: string;      // Goblin personal name
  balance: number;          // Token balance ($HOARD)
  status: GoblinBehaviorState;
  role: GoblinRole;
  activity: string;         // Human-readable current behavior description
  stationName: string;      // Geographic anchor in the camp
  defaultPosition: [number, number]; // [x, z] anchor coordinates
  strategyDNA?: GoblinStrategyDNA;
  createdAt: number;
}

// Future Blockchain Event System Foundation
export type OnChainEventType =
  | "NEW_WALLET"
  | "BUY"
  | "SELL"
  | "TRANSFER"
  | "BURN"
  | "LARGE_BUY"
  | "LARGE_SELL"
  | "WALLET_INACTIVE";

export interface GoblinOnChainEvent {
  type: OnChainEventType;
  walletAddress: string;
  amount?: number;
  txHash?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class GoblinEventManager {
  private static instance: GoblinEventManager;
  private listeners: Array<(event: GoblinOnChainEvent) => void> = [];

  public static getInstance(): GoblinEventManager {
    if (!GoblinEventManager.instance) {
      GoblinEventManager.instance = new GoblinEventManager();
    }
    return GoblinEventManager.instance;
  }

  public subscribe(callback: (event: GoblinOnChainEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public dispatch(event: GoblinOnChainEvent) {
    this.listeners.forEach((cb) => cb(event));
  }
}

// The initial 10 distinct Goblin inhabitants representing vanity wallets
export const INITIAL_GOBLIN_ENTITIES: GoblinEntity[] = [
  {
    id: "GOB-001",
    walletAddress: "0x7bBEE64917a2C4b036c84138e6Fe81219b264663",
    displayName: "Grik Gold-Tooth",
    balance: 42500,
    status: "EATING",
    role: "FIRE_TENDER",
    activity: "Gnawing roasted boar ribs beside the campfire",
    stationName: "Central Campfire (East Log)",
    defaultPosition: [1.8, 0.6],
    createdAt: 1727740800000
  },
  {
    id: "GOB-002",
    walletAddress: "0x4aBEE19875F03d4B8E316719A18eB9904d464663",
    displayName: "Snagglefang",
    balance: 18200,
    status: "TALKING",
    role: "FIRE_TENDER",
    activity: "Arguing passionately about raid spoils across the fire",
    stationName: "Central Campfire (West Log)",
    defaultPosition: [-1.9, 0.8],
    createdAt: 1727741400000
  },
  {
    id: "GOB-003",
    walletAddress: "0x9cFEE28148bA4481028e367A2063D1886e564663",
    displayName: "Bogwart the Sneak",
    balance: 9800,
    status: "WORKING",
    role: "WARRIOR",
    activity: "Honing iron blade on a whetstone stool",
    stationName: "Campfire Log Stack",
    defaultPosition: [-2.1, -1.8],
    createdAt: 1727742000000
  },
  {
    id: "GOB-004",
    walletAddress: "0x2dDA0174eB1C1A687B214436578d498144b64663",
    displayName: "Krag Skulker",
    balance: 24100,
    status: "WORKING",
    role: "MINER",
    activity: "Excavating turquoise ore crystals from deep rock face",
    stationName: "Goblin Mine Portal",
    defaultPosition: [-10.8, 3.2],
    createdAt: 1727742600000
  },
  {
    id: "GOB-005",
    walletAddress: "0x5eC01783Bf8228A4064B441e863B5145b2c64663",
    displayName: "Skabb Coin-Snatcher",
    balance: 31400,
    status: "WORKING",
    role: "MINER",
    activity: "Sorting raw gemstone ore chunks into heavy handcart",
    stationName: "Mine Cart Loading Bay",
    defaultPosition: [-9.6, 2.0],
    createdAt: 1727743200000
  },
  {
    id: "GOB-006",
    walletAddress: "0x1fH0A91884C004523b4991448bEbF68943f64663",
    displayName: "Blix Pick-Pocket",
    balance: 88900,
    status: "RESTING",
    role: "HOARD_KEEPER",
    activity: "Counting glittering gold coins overflowing from strongbox",
    stationName: "The Goblin Treasury",
    defaultPosition: [2.5, -6.6],
    createdAt: 1727743800000
  },
  {
    id: "GOB-007",
    walletAddress: "0x8aGUA314782B3361A05e7144eB031448b1a64663",
    displayName: "Grimjaw",
    balance: 55000,
    status: "GUARDING",
    role: "CHIEFTAIN_GUARD",
    activity: "Standing vigilant sentry with spear at Hold entrance",
    stationName: "Chieftain's Hold Portico",
    defaultPosition: [-1.2, -9.8],
    createdAt: 1727744400000
  },
  {
    id: "GOB-008",
    walletAddress: "0x3bCAR88941c48e8946123485710eF99014b64663",
    displayName: "Nox Plunderer",
    balance: 62300,
    status: "GUARDING",
    role: "CHIEFTAIN_GUARD",
    activity: "Patrolling Chieftain's high trophy platform with shield",
    stationName: "Chieftain's Trophy Flank",
    defaultPosition: [1.3, -9.6],
    createdAt: 1727745000000
  },
  {
    id: "GOB-009",
    walletAddress: "0x6eSEN147990123f1A488914407b8123441a64663",
    displayName: "Gnasher",
    balance: 12000,
    status: "GUARDING",
    role: "SENTRY",
    activity: "Surveying southern forest tree line from lookout post",
    stationName: "South-West Watchtower Base",
    defaultPosition: [-7.5, 8.4],
    createdAt: 1727745600000
  },
  {
    id: "GOB-010",
    walletAddress: "0x0dROA44812399aB047c814421b81446714e64663",
    displayName: "Rumblebelly",
    balance: 15750,
    status: "WALKING",
    role: "FORAGER",
    activity: "Hauling scavenged forest mushrooms & roots across camp",
    stationName: "Perimeter Dirt Trail",
    defaultPosition: [0.6, 5.0],
    createdAt: 1727746200000
  }
];
