import {
  AnimalType,
  ANIMALS,
  ANIMAL_PAIRS,
  AuctionItem,
  AuctionType,
  Bid,
  FarmAnimal,
  Player,
  PublicState,
  Team,
  UserState,
  AdminState,
  BuybackOffer,
  SwitchOffer,
  BuybackOfferStatus,
} from "./types";
import { v4 as uuid } from "uuid";

const STARTING_BALANCE = 100;
const MAX_TEAMS = 10;
const DEFAULT_ADMIN_PASSWORD = "rriadmin";

// Simple password hashing for demo (use bcrypt in production)
function hashPassword(password: string): string {
  return Buffer.from(password).toString("base64");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export class FarmAuctionGame {
  private teams: Map<string, Team> = new Map();
  private auction: AuctionItem;
  private hiddenAnimal: AnimalType | null = null; // actual animal when blind
  private highestBid: Bid | null = null;
  private bidHistory: Bid[] = [];
  private buybacks: BuybackOffer[] = [];
  private switchOffer: SwitchOffer | null = null;
  private adminPasswordHash: string;

  constructor() {
    this.adminPasswordHash = hashPassword(DEFAULT_ADMIN_PASSWORD);
    this.auction = {
      id: uuid(),
      animalType: null,
      switchTarget: null,
      startingPrice: 0,
      currentPrice: 0,
      highestBidderId: null,
      auctionType: "normal",
      isActive: false,
      startedAt: null,
      endedAt: null,
    };
    this.seedTeams();
  }

  private seedTeams() {
    const teams = [
      { username: "Team 1", password: "101" },
      { username: "Team 2", password: "202" },
      { username: "Team 3", password: "303" },
      { username: "Team 4", password: "404" },
      { username: "Team 5", password: "505" },
      { username: "Team 6", password: "606" },
      { username: "Team 7", password: "707" },
      { username: "Team 8", password: "808" },
      { username: "Team 9", password: "909" },
      { username: "Team 10", password: "000" },
    ];

    teams.forEach((t) => {
      const id = uuid();
      this.teams.set(id, {
        id,
        username: t.username,
        passwordHash: hashPassword(t.password),
        balance: STARTING_BALANCE,
        lockedBid: 0,
        farm: [],
        joinedAt: Date.now(),
      });
    });
  }

  // Authentication
  registerTeam(username: string, password: string): { ok: true; teamId: string } | { ok: false; message: string } {
    return { ok: false, message: "Registration is disabled. Use one of the preset teams." };
  }

  loginTeam(username: string, password: string): { ok: true; teamId: string } | { ok: false; message: string } {
    const trimmedUsername = username.trim();
    for (const team of this.teams.values()) {
      if (team.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        if (verifyPassword(password, team.passwordHash)) {
          return { ok: true, teamId: team.id };
        }
        return { ok: false, message: "Invalid password." };
      }
    }
    return { ok: false, message: "Team not found. Use one of the 10 preset teams." };
  }

  verifyAdmin(password: string): boolean {
    return verifyPassword(password, this.adminPasswordHash);
  }

  private getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  private teamToPlayer(team: Team): Player {
    return {
      id: team.id,
      username: team.username,
      balance: team.balance,
      lockedBid: team.lockedBid,
      farmValue: this.calculateFarmValue(team.farm),
      farm: [...team.farm],
      joinedAt: team.joinedAt,
    };
  }

  private calculateFarmValue(farm: FarmAnimal[]): number {
    const counts = Object.keys(ANIMALS).reduce(
      (acc, key) => ({ ...acc, [key]: 0 }),
      {} as Record<AnimalType, number>
    );
    farm.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });

    let total = 0;
    let bonus = 0;
    for (const pair of Object.values(ANIMAL_PAIRS)) {
      const maleCount = counts[pair.male] || 0;
      const femaleCount = counts[pair.female] || 0;
      const male = ANIMALS[pair.male];
      const female = ANIMALS[pair.female];
      total += male.baseValue * maleCount + female.baseValue * femaleCount;
      const pairs = Math.min(maleCount, femaleCount);
      if (pairs > 0) {
        bonus += (male.baseValue + female.baseValue) * pairs;
      }
    }
    return total + bonus;
  }

  startAuction(
    animalType: AnimalType,
    startingPrice: number,
    auctionType: AuctionType,
    switchTarget?: AnimalType | null
  ): { ok: true } | { ok: false; message: string } {
    if (this.auction.isActive) return { ok: false, message: "An auction is already active." };
    if (startingPrice < 1) return { ok: false, message: "Starting price must be at least 1." };
    if (!ANIMALS[animalType]) return { ok: false, message: "Invalid animal type." };
    if (auctionType === "switch" && !switchTarget) return { ok: false, message: "Switch target required." };

    this.hiddenAnimal = auctionType === "blind" ? animalType : null;
    this.switchOffer = null;

    this.auction = {
      id: uuid(),
      animalType: auctionType === "blind" ? null : animalType,
      switchTarget: switchTarget || null,
      startingPrice,
      currentPrice: startingPrice,
      highestBidderId: null,
      auctionType,
      isActive: true,
      startedAt: Date.now(),
      endedAt: null,
    };

    this.highestBid = null;
    this.bidHistory = [];
    this.buybacks = this.buybacks.filter((b) => b.status === "pending"); // keep pending offers

    for (const t of this.teams.values()) {
      t.lockedBid = 0;
    }

    return { ok: true };
  }

  revealAnimal(): { ok: true; animalType: AnimalType } | { ok: false; message: string } {
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };
    if (this.auction.auctionType !== "blind") return { ok: false, message: "Not a blind auction." };
    if (!this.hiddenAnimal) return { ok: false, message: "No hidden animal to reveal." };

    this.auction.animalType = this.hiddenAnimal;
    return { ok: true, animalType: this.hiddenAnimal };
  }

  stopAuction(): { ok: true; winnerId: string | null; animalType: AnimalType | null } | { ok: false; message: string } {
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };

    const winnerId = this.auction.highestBidderId;
    let awardAnimal: AnimalType | null = this.auction.animalType;
    if (this.auction.auctionType === "blind" && this.hiddenAnimal) {
      awardAnimal = this.hiddenAnimal;
      this.auction.animalType = this.hiddenAnimal; // reveal
    }

    if (winnerId && awardAnimal) {
      const winner = this.getTeam(winnerId);
      if (winner) {
        const winningBidAmount = this.highestBid?.amount ?? this.auction.currentPrice;
        winner.balance -= winningBidAmount;
        winner.lockedBid = 0;

        if (this.auction.auctionType === "switch" && this.auction.switchTarget) {
          // hold for choice
          this.switchOffer = {
            auctionId: this.auction.id!,
            teamId: winnerId,
            originalAnimal: awardAnimal,
            switchTarget: this.auction.switchTarget,
            status: "pending",
          };
        } else {
          // award immediately
          winner.farm.push({ id: uuid(), type: awardAnimal, acquiredAt: Date.now() });
        }
      }
    }

    this.auction.isActive = false;
    this.auction.endedAt = Date.now();

    return { ok: true, winnerId, animalType: awardAnimal };
  }

  cancelAuction(): { ok: true } | { ok: false; message: string } {
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };

    const prevId = this.auction.highestBidderId;
    if (prevId) {
      const prev = this.getTeam(prevId);
      if (prev) prev.lockedBid = 0;
    }

    this.auction.isActive = false;
    this.auction.endedAt = Date.now();
    this.highestBid = null;
    this.bidHistory = [];
    this.hiddenAnimal = null;
    this.switchOffer = null;
    return { ok: true };
  }

  placeBid(teamId: string, amount: number): { ok: true; bid: Bid } | { ok: false; message: string } {
    const team = this.getTeam(teamId);
    if (!team) return { ok: false, message: "Team not found." };
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Bid must be positive." };

    const minimum = Math.max(this.auction.currentPrice + 1, this.auction.startingPrice);
    if (amount < minimum) return { ok: false, message: `Bid must be at least ${minimum}.` };
    if (amount > team.balance) return { ok: false, message: "Insufficient balance." };

    const prevId = this.auction.highestBidderId;
    if (prevId && prevId !== teamId) {
      const prev = this.getTeam(prevId);
      if (prev) prev.lockedBid = 0;
    }

    team.lockedBid = amount;
    this.auction.currentPrice = amount;
    this.auction.highestBidderId = teamId;

    const bid: Bid = { id: uuid(), teamId, amount, timestamp: Date.now() };
    this.highestBid = bid;
    this.bidHistory.push(bid);
    return { ok: true, bid };
  }

  handleSwitchChoice(teamId: string, choice: "accept" | "switch"): { ok: true } | { ok: false; message: string } {
    if (!this.switchOffer) return { ok: false, message: "No pending switch." };
    if (this.switchOffer.teamId !== teamId) return { ok: false, message: "Not your switch." };
    if (this.switchOffer.status !== "pending") return { ok: false, message: "Switch already resolved." };

    const team = this.getTeam(teamId);
    if (!team) return { ok: false, message: "Team not found." };

    const animalToAdd = choice === "accept" ? this.switchOffer.originalAnimal : this.switchOffer.switchTarget;
    team.farm.push({ id: uuid(), type: animalToAdd, acquiredAt: Date.now() });
    this.switchOffer.status = choice === "accept" ? "accepted" : "switched";
    return { ok: true };
  }

  createBuybackOffer(teamId: string, animalId: string, price: number): { ok: true; offer: BuybackOffer } | { ok: false; message: string } {
    const team = this.getTeam(teamId);
    if (!team) return { ok: false, message: "Team not found." };
    const animal = team.farm.find((a) => a.id === animalId);
    if (!animal) return { ok: false, message: "Animal not found in team farm." };
    if (price <= 0) return { ok: false, message: "Offer must be positive." };

    const offer: BuybackOffer = {
      id: uuid(),
      teamId,
      animalId: animal.id,
      animalType: animal.type,
      price,
      status: "pending",
      createdAt: Date.now(),
    };
    this.buybacks.push(offer);
    return { ok: true, offer };
  }

  handleBuybackResponse(teamId: string, offerId: string, accept: boolean): { ok: true; offer?: BuybackOffer } | { ok: false; message: string } {
    const offer = this.buybacks.find((b) => b.id === offerId);
    if (!offer) return { ok: false, message: "Offer not found." };
    if (offer.status !== "pending") return { ok: false, message: "Offer already resolved." };
    if (offer.teamId !== teamId) return { ok: false, message: "Not your offer." };

    const team = this.getTeam(teamId);
    if (!team) return { ok: false, message: "Team not found." };

    if (accept) {
      const idx = team.farm.findIndex((a) => a.id === offer.animalId);
      if (idx >= 0) {
        team.farm.splice(idx, 1);
        team.balance += offer.price;
        offer.status = "accepted";
      } else {
        return { ok: false, message: "Animal already sold or missing." };
      }
    } else {
      offer.status = "rejected";
    }

    return { ok: true, offer };
  }

  getPublicState(): PublicState {
    return {
      auction: { ...this.auction },
      teams: Array.from(this.teams.values()).map((t) => this.teamToPlayer(t)),
      highestBid: this.highestBid,
      bidHistory: this.bidHistory.slice(-20),
      buybacks: this.buybacks.slice(-20),
      switchOffer: this.switchOffer,
      gameActive: this.auction.isActive,
    };
  }

  getUserState(teamId: string): UserState | null {
    const team = this.getTeam(teamId);
    if (!team) return null;
    return {
      ...this.getPublicState(),
      team: this.teamToPlayer(team),
    };
  }

  getAdminState(): AdminState {
    return {
      ...this.getPublicState(),
      allTeams: Array.from(this.teams.values()),
      canStartAuction: !this.auction.isActive,
    };
  }

  getPendingSwitchForTeam(teamId: string): SwitchOffer | null {
    if (this.switchOffer && this.switchOffer.teamId === teamId && this.switchOffer.status === "pending") {
      return this.switchOffer;
    }
    return null;
  }
}
