import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  GoblinEntity,
  GoblinBehaviorState,
  INITIAL_GOBLIN_ENTITIES,
  GoblinOnChainEvent,
  GoblinEventManager
} from "./GoblinEntity";

export interface CampObstacle {
  center: THREE.Vector2;
  radius: number;
}

export interface GoblinAccessories {
  pickaxe?: THREE.Group;
  spear?: THREE.Group;
  sword?: THREE.Group;
  roundShield?: THREE.Group;
  rectShield?: THREE.Group;
}

export class GoblinAgent {
  public entity: GoblinEntity;
  public mesh: THREE.Group;
  public mixer: THREE.AnimationMixer;
  public actions: { [name: string]: THREE.AnimationAction } = {};
  public currentAction: THREE.AnimationAction | null = null;
  public currentActionName: string = "";

  public targetPos: THREE.Vector3 = new THREE.Vector3();
  public anchorPos: THREE.Vector3 = new THREE.Vector3();
  public speed: number = 1.35;
  public stateTimer: number = 0;
  public scaleVal: number = 0.82;
  public heading: number = 0;

  // Dungeon Raid State
  public isRaiding: boolean = false;
  public raidDungeonPos: THREE.Vector3 = new THREE.Vector3();
  public raidTargetTicker: string = "$PEPE";
  public raidLootEth: number = 0.0001;
  public raidPhase: "outbound" | "plundering" | "return" | "depositing" | "returning_to_post" = "outbound";
  public raidTimer: number = 0;
  public lootMesh: THREE.Group | null = null;
  public greetingCooldown: number = 0;
  public onPlunderCallback?: (agent: GoblinAgent, ticker: string, loot: number) => void;
  public onRaidCompleteCallback?: (agent: GoblinAgent, ticker: string, loot: number) => void;

  constructor(
    entity: GoblinEntity,
    gltfScene: THREE.Group,
    animations: THREE.AnimationClip[],
    spawnPos: THREE.Vector3,
    accessories?: GoblinAccessories
  ) {
    this.entity = { ...entity };
    this.anchorPos.copy(spawnPos);
    this.targetPos.copy(spawnPos);

    // Clone skinned mesh & bone hierarchy independently
    this.mesh = SkeletonUtils.clone(gltfScene) as THREE.Group;
    this.scaleVal = 0.76 + Math.random() * 0.12; // Natural size variation
    this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);

    // Tag for interactive selection raycasting
    this.mesh.userData = { goblinId: entity.id, isGoblin: true };

    this.mesh.traverse((child) => {
      child.userData = { goblinId: entity.id, isGoblin: true };
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh.position.copy(spawnPos);

    // Setup animation mixer & clips
    this.mixer = new THREE.AnimationMixer(this.mesh);
    animations.forEach((clip) => {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    });

    // Desynchronize initial playback time
    this.mixer.setTime(Math.random() * 2.5);

    this.speed = 1.1 + Math.random() * 0.35;
    this.stateTimer = 4.0 + Math.random() * 6.0;

    // Attach role-based visual accessories
    this.attachAccessories(accessories);

    // Initialize animation based on entity behavior state
    this.applyBehaviorState(this.entity.status, true);
  }

  private attachAccessories(accessories?: GoblinAccessories) {
    if (!accessories) return;

    const rightArm = this.mesh.getObjectByName("arm-right");
    const leftArm = this.mesh.getObjectByName("arm-left");

    if (this.entity.role === "MINER" && accessories.pickaxe && rightArm) {
      const pick = accessories.pickaxe.clone();
      pick.scale.set(1.2, 1.2, 1.2);
      pick.position.set(0, -0.45, 0.1);
      pick.rotation.set(-Math.PI / 2, 0, 0.4);
      rightArm.add(pick);
    } else if (this.entity.role === "CHIEFTAIN_GUARD" && accessories.spear && rightArm) {
      const spear = accessories.spear.clone();
      spear.scale.set(1.3, 1.3, 1.3);
      spear.position.set(0, -0.3, 0.05);
      spear.rotation.set(-Math.PI / 2, 0, 0);
      rightArm.add(spear);

      if (accessories.rectShield && leftArm) {
        const shield = accessories.rectShield.clone();
        shield.scale.set(0.85, 0.85, 0.85);
        shield.position.set(0.12, -0.2, 0);
        shield.rotation.set(0, 0, Math.PI / 2);
        leftArm.add(shield);
      }
    } else if (this.entity.role === "SENTRY" && accessories.spear && rightArm) {
      const spear = accessories.spear.clone();
      spear.scale.set(1.25, 1.25, 1.25);
      spear.position.set(0, -0.3, 0.05);
      spear.rotation.set(-Math.PI / 2, 0, 0);
      rightArm.add(spear);
    } else if (this.entity.role === "WARRIOR" && accessories.sword && rightArm) {
      const sword = accessories.sword.clone();
      sword.scale.set(1.1, 1.1, 1.1);
      sword.position.set(0, -0.35, 0.05);
      sword.rotation.set(-Math.PI / 2, 0, 0);
      rightArm.add(sword);
    }
  }

  public attachPlunderSack() {
    if (this.lootMesh) return;
    const sackGroup = new THREE.Group();
    sackGroup.name = "PlunderLootSack";

    // Weathered bulging loot sack
    const sackGeo = new THREE.SphereGeometry(0.24, 10, 10);
    sackGeo.scale(1.0, 1.35, 0.95);
    const sackMat = new THREE.MeshStandardMaterial({
      color: 0x92400e, // Rich burlap/leather
      roughness: 0.85,
      metalness: 0.08
    });
    const sackMesh = new THREE.Mesh(sackGeo, sackMat);
    sackMesh.castShadow = true;
    sackGroup.add(sackMesh);

    // Golden rope cinch at top
    const ropeGeo = new THREE.TorusGeometry(0.12, 0.035, 6, 12);
    ropeGeo.rotateX(Math.PI / 2);
    ropeGeo.translate(0, 0.22, 0);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
    const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    sackGroup.add(ropeMesh);

    // Overflowing gold coins glimmering at mouth
    const coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x7c5200,
      emissiveIntensity: 0.45
    });
    for (let c = 0; c < 3; c++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.position.set(
        (Math.random() - 0.5) * 0.12,
        0.24 + Math.random() * 0.06,
        (Math.random() - 0.5) * 0.12
      );
      coin.rotation.set(Math.random() * 0.5, Math.random() * 2, Math.random() * 0.5);
      sackGroup.add(coin);
    }

    // Attach to goblin back/torso
    const bodyBone = this.mesh.getObjectByName("body") || this.mesh.getObjectByName("torso") || this.mesh.getObjectByName("spine");
    if (bodyBone) {
      sackGroup.position.set(0, 0.16, -0.32);
      sackGroup.rotation.set(-0.25, 0, 0);
      bodyBone.add(sackGroup);
    } else {
      sackGroup.position.set(0, 0.55, -0.32);
      sackGroup.rotation.set(-0.25, 0, 0);
      this.mesh.add(sackGroup);
    }

    this.lootMesh = sackGroup;
  }

  public removePlunderSack() {
    if (!this.lootMesh) return;
    if (this.lootMesh.parent) {
      this.lootMesh.parent.remove(this.lootMesh);
    }
    this.lootMesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.lootMesh = null;
  }

  public applyBehaviorState(state: GoblinBehaviorState, force: boolean = false) {
    this.entity.status = state;

    switch (state) {
      case "EATING":
        // Sitting beside fire eating/drinking
        this.playAction("sit", 0.4);
        break;

      case "RESTING":
        // Sitting on log or crouching over stash
        if (this.entity.role === "HOARD_KEEPER") {
          this.playAction(this.actions["crouch"] ? "crouch" : "sit", 0.4);
        } else {
          this.playAction("sit", 0.4);
        }
        break;

      case "TALKING":
        // Conversational banter with expressive gestures
        const talkClips = ["emote-yes", "emote-no", "idle"];
        const chosen = talkClips[Math.floor(Math.random() * talkClips.length)];
        this.playAction(chosen, 0.4);
        break;

      case "WORKING":
        // Mining rock face, sharpening blade, or sorting
        this.playAction("interact-right", 0.35);
        break;

      case "GUARDING":
        // Vigilant sentry stance
        const guardClip = this.actions["holding-right"] ? "holding-right" : "idle";
        this.playAction(guardClip, 0.35);
        break;

      case "RAIDING":
        this.speed = 3.8; // High speed sprint to/from dungeon
        this.playAction("walk", 0.15);
        if (this.actions["walk"]) {
          this.actions["walk"].timeScale = 1.9;
        }
        break;

      case "WALKING":
      case "CARRYING":
        this.speed = 1.1 + Math.random() * 0.35;
        if (this.actions["walk"]) {
          this.actions["walk"].timeScale = 1.0;
        }
        // Patrolling or carrying supplies
        this.playAction("walk", 0.3);
        break;

      case "IDLE":
      default:
        this.playAction("idle", 0.35);
        break;
    }
  }

  public playAction(name: string, fadeDuration: number = 0.25) {
    const nextAction = this.actions[name] || this.actions["idle"];
    if (!nextAction || this.currentActionName === name) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
    }

    nextAction.reset().fadeIn(fadeDuration).play();
    this.currentAction = nextAction;
    this.currentActionName = name;
  }

  public update(
    delta: number,
    terrainHeightFn: (x: number, z: number) => number,
    obstacles: CampObstacle[]
  ) {
    this.mixer.update(delta);
    this.stateTimer -= delta;
    if (this.greetingCooldown > 0) this.greetingCooldown -= delta;

    if (this.entity.status === "RAIDING") {
      const curPos = this.mesh.position;
      if (this.raidPhase === "outbound") {
        const toTarget = new THREE.Vector2(this.raidDungeonPos.x - curPos.x, this.raidDungeonPos.z - curPos.z);
        const dist = toTarget.length();
        if (dist < 1.5) {
          this.raidPhase = "plundering";
          this.raidTimer = 0.85;
          this.playAction("interact-right", 0.15);
          if (this.onPlunderCallback) {
            this.onPlunderCallback(this, this.raidTargetTicker, this.raidLootEth);
          }
        } else {
          toTarget.normalize();
          const moveStep = this.speed * delta;
          curPos.x += toTarget.x * moveStep;
          curPos.z += toTarget.y * moveStep;
          curPos.y = terrainHeightFn(curPos.x, curPos.z);
          const targetAngle = Math.atan2(toTarget.x, toTarget.y);
          this.mesh.rotation.y = targetAngle;
        }
      } else if (this.raidPhase === "plundering") {
        this.raidTimer -= delta;
        if (this.raidTimer <= 0) {
          this.attachPlunderSack();
          this.raidPhase = "return";
          this.entity.activity = `Hauling ${this.raidLootEth} ETH plunder to Treasury Hoard!`;
          this.playAction("walk", 0.15);
          if (this.actions["walk"]) this.actions["walk"].timeScale = 1.9;
        }
      } else if (this.raidPhase === "return") {
        // Return destination is the Treasury Hoard at (3.4, -6.8)
        const hoardX = 3.4;
        const hoardZ = -6.8;
        const toHoard = new THREE.Vector2(hoardX - curPos.x, hoardZ - curPos.z);
        const dist = toHoard.length();
        if (dist < 1.4) {
          // Arrived at Treasury Hoard!
          this.raidPhase = "depositing";
          this.raidTimer = 0.8;
          this.entity.activity = `Depositing plunder into the Treasury Hoard!`;
          this.playAction(this.actions["crouch"] ? "crouch" : "interact-right", 0.2);
          this.removePlunderSack();
          if (this.onRaidCompleteCallback) {
            this.onRaidCompleteCallback(this, this.raidTargetTicker, this.raidLootEth);
          }
        } else {
          toHoard.normalize();
          const moveStep = this.speed * delta;
          curPos.x += toHoard.x * moveStep;
          curPos.z += toHoard.y * moveStep;
          curPos.y = terrainHeightFn(curPos.x, curPos.z);
          const targetAngle = Math.atan2(toHoard.x, toHoard.y);
          this.mesh.rotation.y = targetAngle;
        }
      } else if (this.raidPhase === "depositing") {
        this.raidTimer -= delta;
        if (this.raidTimer <= 0) {
          // Celebratory cheer after depositing into hoard
          this.playAction("emote-yes", 0.2);
          this.raidPhase = "returning_to_post";
          this.raidTimer = 0.9;
          this.entity.activity = "Cheering raid victory!";
        }
      } else if (this.raidPhase === "returning_to_post") {
        if (this.raidTimer > 0) {
          this.raidTimer -= delta;
        } else {
          // Walking back to original anchor station
          this.playAction("walk", 0.25);
          if (this.actions["walk"]) this.actions["walk"].timeScale = 1.2;
          const returnTarget = this.anchorPos;
          const toAnchor = new THREE.Vector2(returnTarget.x - curPos.x, returnTarget.z - curPos.z);
          const dist = toAnchor.length();
          if (dist < 1.1) {
            this.isRaiding = false;
            if (this.actions["walk"]) this.actions["walk"].timeScale = 1.0;
            this.applyBehaviorState("IDLE");
            this.entity.activity = "Vigilant at post";
          } else {
            toAnchor.normalize();
            const moveStep = 1.8 * delta;
            curPos.x += toAnchor.x * moveStep;
            curPos.z += toAnchor.y * moveStep;
            curPos.y = terrainHeightFn(curPos.x, curPos.z);
            const targetAngle = Math.atan2(toAnchor.x, toAnchor.y);
            this.mesh.rotation.y = targetAngle;
          }
        }
      }
      return;
    }

    if (this.entity.status === "WALKING" || this.entity.status === "CARRYING") {
      const curPos = this.mesh.position;
      const toTarget = new THREE.Vector2(this.targetPos.x - curPos.x, this.targetPos.z - curPos.z);
      const dist = toTarget.length();

      if (dist < 0.4 || this.stateTimer <= 0) {
        // Arrived at destination -> short rest or return to assigned station
        if (Math.random() > 0.4) {
          this.applyBehaviorState("IDLE");
          this.stateTimer = 3.5 + Math.random() * 4.5;
        } else {
          // Continue patrol
          this.pickPatrolDestination(obstacles);
          this.stateTimer = 5.0 + Math.random() * 7.0;
        }
      } else {
        toTarget.normalize();

        // Soft avoidance from obstacles while moving
        obstacles.forEach((obs) => {
          const toObs = new THREE.Vector2(curPos.x - obs.center.x, curPos.z - obs.center.y);
          const obsDist = toObs.length();
          if (obsDist < obs.radius + 0.6 && obsDist > 0.001) {
            toObs.normalize().multiplyScalar(0.4);
            toTarget.add(toObs);
          }
        });
        toTarget.normalize();

        const moveStep = this.speed * delta;
        curPos.x += toTarget.x * moveStep;
        curPos.z += toTarget.y * moveStep;
        curPos.y = terrainHeightFn(curPos.x, curPos.z);

        // Smooth rotation towards movement direction
        const targetAngle = Math.atan2(toTarget.x, toTarget.y);
        const curRot = this.mesh.rotation.y;
        let diff = targetAngle - curRot;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.mesh.rotation.y += diff * Math.min(1.0, 7.0 * delta);
      }
    } else if (this.entity.status === "TALKING") {
      // Natural conversation turn-taking
      if (this.stateTimer <= 0) {
        this.stateTimer = 3.0 + Math.random() * 4.5;
        const subClip = Math.random() > 0.5 ? "emote-yes" : Math.random() > 0.4 ? "emote-no" : "idle";
        this.playAction(subClip, 0.35);
      }
    } else if (this.entity.status === "IDLE") {
      if (this.stateTimer <= 0) {
        // Goblins with assigned stations return to their core task
        if (this.entity.role === "FORAGER") {
          this.applyBehaviorState("WALKING");
          this.stateTimer = 6.0 + Math.random() * 6.0;
          this.pickPatrolDestination(obstacles);
        } else {
          this.stateTimer = 4.0 + Math.random() * 6.0;
          this.applyBehaviorState(this.entity.role === "MINER" ? "WORKING" : "RESTING");
        }
      }
    }
  }

  public pickPatrolDestination(obstacles: CampObstacle[]) {
    // Pick an open camp spot near paths (< 11.5 units from center)
    for (let attempts = 0; attempts < 15; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 9.0;
      const candidateX = Math.cos(angle) * radius;
      const candidateZ = Math.sin(angle) * radius;

      const collides = obstacles.some((obs) => {
        const dx = candidateX - obs.center.x;
        const dz = candidateZ - obs.center.y;
        return Math.sqrt(dx * dx + dz * dz) < obs.radius + 0.6;
      });

      if (!collides) {
        this.targetPos.set(candidateX, 0, candidateZ);
        return;
      }
    }
    this.targetPos.copy(this.anchorPos);
  }
}

export class GoblinPopulationSystem {
  public maxCapacity: number = 300;
  public goblins: GoblinAgent[] = [];
  public containerGroup: THREE.Group = new THREE.Group();

  private gltfTemplate: GLTF | null = null;
  private terrainHeightFn: (x: number, z: number) => number = () => 0;
  private obstacles: CampObstacle[] = [];
  private accessories?: GoblinAccessories;

  constructor(scene: THREE.Scene) {
    this.containerGroup.name = "GoblinPopulationGroup";
    scene.add(this.containerGroup);

    // Subscribe to the global Goblin Event Manager for on-chain events
    GoblinEventManager.getInstance().subscribe(this.handleOnChainEvent.bind(this));
  }

  public init(
    gltf: GLTF,
    terrainHeightFn: (x: number, z: number) => number,
    obstacles: CampObstacle[],
    initialPopulationCount: number = 10,
    accessories?: GoblinAccessories
  ) {
    this.gltfTemplate = gltf;
    this.terrainHeightFn = terrainHeightFn;
    this.obstacles = obstacles;
    this.accessories = accessories;
    this.setPopulation(initialPopulationCount);
  }

  public setPopulation(count: number) {
    if (!this.gltfTemplate) return;
    const targetCount = Math.max(0, Math.min(this.maxCapacity, count));

    // If decreasing, trim excess
    while (this.goblins.length > targetCount) {
      const g = this.goblins.pop();
      if (g) {
        g.removePlunderSack();
        g.mixer.stopAllAction();
        this.containerGroup.remove(g.mesh);
      }
    }

    // If increasing, spawn up to targetCount
    while (this.goblins.length < targetCount) {
      this.spawnOne();
    }
  }

  public spawnOne(): GoblinEntity | null {
    if (!this.gltfTemplate) return null;
    if (this.goblins.length >= this.maxCapacity) return null;

    const i = this.goblins.length;
    let entity: GoblinEntity;

    if (i < INITIAL_GOBLIN_ENTITIES.length) {
      entity = { ...INITIAL_GOBLIN_ENTITIES[i] };
    } else {
      const idNum = String(i + 1).padStart(3, "0");
      entity = {
        id: `GOB-${idNum}`,
        walletAddress: `0x${Math.random().toString(16).substring(2, 8).toUpperCase()}...4663`,
        displayName: `Goblin Plunderer #${idNum}`,
        balance: Math.floor(5000 + Math.random() * 45000),
        status: i % 4 === 0 ? "WALKING" : i % 3 === 0 ? "WORKING" : "IDLE",
        role: i % 2 === 0 ? "WARRIOR" : "MINER",
        activity: "Recruited to hoard by creator fee tribute!",
        stationName: "Camp Outskirts",
        defaultPosition: [
          Math.cos((i / 20) * Math.PI * 2) * (3.5 + (i % 5) * 0.8),
          Math.sin((i / 20) * Math.PI * 2) * (3.5 + (i % 5) * 0.8)
        ],
        createdAt: Date.now()
      };
    }

    const startX = entity.defaultPosition[0];
    const startZ = entity.defaultPosition[1];
    const startY = this.terrainHeightFn(startX, startZ);
    const spawnPos = new THREE.Vector3(startX, startY, startZ);

    const agent = new GoblinAgent(
      entity,
      this.gltfTemplate.scene,
      this.gltfTemplate.animations,
      spawnPos,
      this.accessories
    );

    agent.mesh.rotation.y = Math.random() * Math.PI * 2;
    agent.playAction("emote-yes", 0.3);

    this.goblins.push(agent);
    this.containerGroup.add(agent.mesh);
    return entity;
  }


  public update(delta: number) {
    // Gentle separation force to prevent overlapping
    for (let i = 0; i < this.goblins.length; i++) {
      const g1 = this.goblins[i];
      for (let j = i + 1; j < this.goblins.length; j++) {
        const g2 = this.goblins[j];
        const dx = g1.mesh.position.x - g2.mesh.position.x;
        const dz = g1.mesh.position.z - g2.mesh.position.z;
        const distSq = dx * dx + dz * dz;
        const minSpacing = 0.65;
        if (distSq < minSpacing * minSpacing && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = (minSpacing - dist) * 0.4 * delta;
          const nx = dx / dist;
          const nz = dz / dist;
          if (g1.entity.status === "WALKING") {
            g1.mesh.position.x += nx * push;
            g1.mesh.position.z += nz * push;
          }
          if (g2.entity.status === "WALKING") {
            g2.mesh.position.x -= nx * push;
            g2.mesh.position.z -= nz * push;
          }
        }

        // Flavor: Mutual road greeting when two goblins cross paths on camp trails
        if (
          distSq < 1.6 * 1.6 &&
          distSq > 0.8 * 0.8 &&
          g1.entity.status === "WALKING" &&
          g2.entity.status === "WALKING" &&
          !g1.isRaiding &&
          !g2.isRaiding &&
          g1.greetingCooldown <= 0 &&
          g2.greetingCooldown <= 0 &&
          Math.random() < 0.12
        ) {
          g1.greetingCooldown = 24.0;
          g2.greetingCooldown = 24.0;
          g1.stateTimer = 1.4;
          g2.stateTimer = 1.4;
          g1.playAction("emote-yes", 0.25);
          g2.playAction("emote-yes", 0.25);
        }
      }
      g1.update(delta, this.terrainHeightFn, this.obstacles);
    }
  }

  // Future On-Chain Event handler:
  // Blockchain Event -> Wallet Address -> Find Goblin Entity -> Update State -> Play Animation
  public handleOnChainEvent(event: GoblinOnChainEvent) {
    const agent = this.goblins.find(
      (g) =>
        g.entity.walletAddress.toLowerCase() === event.walletAddress.toLowerCase() ||
        g.entity.id === event.walletAddress
    );
    if (!agent) return;

    if (event.type === "BUY" || event.type === "LARGE_BUY") {
      agent.entity.balance += event.amount || 1000;
      agent.entity.activity = `Celebrated massive pillage (+${event.amount || 1000} $HOARD)!`;
      agent.playAction("emote-yes", 0.2);
    } else if (event.type === "SELL" || event.type === "LARGE_SELL") {
      agent.entity.activity = `Bitter over tribute sacrifice`;
      agent.playAction("emote-no", 0.2);
    }
  }

  public getAgentByEntityId(id: string): GoblinAgent | undefined {
    return this.goblins.find((g) => g.entity.id === id);
  }

  public getAllEntities(): GoblinEntity[] {
    return this.goblins.map((g) => g.entity);
  }

  public dispatchRaid(
    dungeonPos: THREE.Vector3,
    ticker: string,
    lootEth: number,
    onPlunder?: (agent: GoblinAgent, ticker: string, loot: number) => void,
    onComplete?: (agent: GoblinAgent, ticker: string, loot: number) => void
  ): GoblinAgent | null {
    if (this.goblins.length === 0) return null;
    const available = this.goblins.filter((g) => !g.isRaiding);
    if (available.length === 0) return null;

    const raider = available.find((g) => g.entity.role === "WARRIOR") || available[Math.floor(Math.random() * available.length)];
    raider.isRaiding = true;
    raider.raidDungeonPos.copy(dungeonPos);
    raider.raidTargetTicker = ticker;
    raider.raidLootEth = lootEth;
    raider.raidPhase = "outbound";
    raider.onPlunderCallback = onPlunder;
    raider.onRaidCompleteCallback = onComplete;
    raider.entity.status = "RAIDING";
    raider.entity.activity = `Sprinting to raid ${ticker} at dungeon!`;
    raider.applyBehaviorState("RAIDING");
    return raider;
  }

  public getClickableObjects(): THREE.Object3D[] {
    return this.goblins.map((g) => g.mesh);
  }
}
