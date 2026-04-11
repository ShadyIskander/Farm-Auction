import {
  AnimalType,
  GadgetType,
  AuctionItemCategory,
  ANIMALS,
  ANIMAL_PAIRS,
  GADGETS,
  ANIMAL_GADGET_MAP,
  AuctionItem,
  AuctionType,
  Bid,
  FarmAnimal,
  FarmGadget,
  Player,
  PublicState,
  Team,
  UserState,
  AdminState,
  BuybackOffer,
  SwitchOffer,
  BuybackOfferStatus,
  TradeOffer,
  TradeOfferType,
} from "./types";
import { v4 as uuid } from "uuid";

const STARTING_BALANCE = 100;
const MAX_TEAMS = 10;
const DEFAULT_ADMIN_PASSWORD = "rriadmin";

function hashPassword(password: string): string {
  return Buffer.from(password).toString("base64");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export class FarmAuctionGame {
  private teams: Map<string, Team> = new Map();
  private auction: AuctionItem;
  private hiddenAnimal: AnimalType | null = null;
  private hiddenGadget: GadgetType | null = null;
  private highestBid: Bid | null = null;
  private bidHistory: Bid[] = [];
  private buybacks: BuybackOffer[] = [];
  private switchOffer: SwitchOffer | null = null;
  private tradeOffers: TradeOffer[] = [];
  private adminPasswordHash: string;

  constructor() {
    this.adminPasswordHash = hashPassword(DEFAULT_ADMIN_PASSWORD);
    this.auction = {
      id: uuid(),
      itemCategory: "animal",
      animalType: null,
      gadgetType: null,
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
        gadgets: [],
        joinedAt: Date.now(),
      });
    });
  }

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
      farmValue: this.calculateFarmValue(team.farm, team.gadgets),
      farm: [...team.farm],
      gadgets: [...team.gadgets],
      joinedAt: team.joinedAt,
    };
  }

  private calculateFarmValue(farm: FarmAnimal[], gadgets: FarmGadget[] = []): number {
    const counts = Object.keys(ANIMALS).reduce(
      (acc, key) => ({ ...acc, [key]: 0 }),
      {} as Record<AnimalType, number>
    );
    farm.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });

    const boostedAnimals = new Set<AnimalType>();
    gadgets.forEach((g) => {
      if (GADGETS[g.type]) {
        boostedAnimals.add(GADGETS[g.type].boostedAnimal);
      }
    });

    let total = 0;
    let bonus = 0;
    for (const [speciesKey, pair] of Object.entries(ANIMAL_PAIRS)) {
      const maleCount = counts[pair.male] || 0;
      const femaleCount = counts[pair.female] || 0;
      const male = ANIMALS[pair.male];
      const female = ANIMALS[pair.female];
      const maleMult = boostedAnimals.has(pair.male) ? 2 : 1;
      const femaleMult = boostedAnimals.has(pair.female) ? 2 : 1;
      total += male.baseValue * maleCount * maleMult + female.baseValue * femaleCount * femaleMult;
      const pairs = Math.min(maleCount, femaleCount);
      if (pairs > 0) {
        bonus += (male.baseValue * maleMult + female.baseValue * femaleMult) * pairs;
      }
    }
    return total + bonus;
  }

  private isAnimalInPendingTrade(animalId: string): boolean {
    return this.tradeOffers.some(
      (o) =>
        o.status === "pending" &&
        (o.offeredAnimalId === animalId || o.requestedAnimalId === animalId)
    );
  }

  private isGadgetInPendingTrade(gadgetId: string): boolean {
    return this.tradeOffers.some(
      (o) =>
        o.status === "pending" &&
        (o.offeredGadgetId === gadgetId || o.requestedGadgetId === gadgetId)
    );
  }

  startAuction(
    animalType: AnimalType,
    startingPrice: number,
    auctionType: AuctionType,
    switchTarget?: AnimalType | null,
    itemCategory?: AuctionItemCategory,
    gadgetType?: GadgetType | null
  ): { ok: true } | { ok: false; message: string } {
    if (this.auction.isActive) return { ok: false, message: "An auction is already active." };
    if (startingPrice < 1) return { ok: false, message: "Starting price must be at least 1." };

    const category: AuctionItemCategory = itemCategory === "gadget" ? "gadget" : "animal";

    if (category === "gadget") {
      if (!gadgetType || !GADGETS[gadgetType]) return { ok: false, message: "Invalid gadget type." };
      if (auctionType === "switch" && !switchTarget) return { ok: false, message: "Switch target required for switch gadget auction." };

      this.hiddenGadget = auctionType === "blind" ? gadgetType : null;
      this.hiddenAnimal = null;
      this.switchOffer = null;
      this.auction = {
        id: uuid(),
        itemCategory: "gadget",
        animalType: null,
        gadgetType: auctionType === "blind" ? null : gadgetType,
        switchTarget: (auctionType === "switch" ? switchTarget : null) as any,
        startingPrice,
        currentPrice: startingPrice,
        highestBidderId: null,
        auctionType,
        isActive: true,
        startedAt: Date.now(),
        endedAt: null,
      };
    } else {
      if (!ANIMALS[animalType]) return { ok: false, message: "Invalid animal type." };
      if (auctionType === "switch" && !switchTarget) return { ok: false, message: "Switch target required." };

      this.hiddenAnimal = auctionType === "blind" ? animalType : null;
      this.switchOffer = null;

      this.auction = {
        id: uuid(),
        itemCategory: "animal",
        animalType: auctionType === "blind" ? null : animalType,
        gadgetType: null,
        switchTarget: switchTarget || null,
        startingPrice,
        currentPrice: startingPrice,
        highestBidderId: null,
        auctionType,
        isActive: true,
        startedAt: Date.now(),
        endedAt: null,
      };
    }

    this.highestBid = null;
    this.bidHistory = [];
    this.buybacks = this.buybacks.filter((b) => b.status === "pending");

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

  revealGadget(): { ok: true; gadgetType: GadgetType } | { ok: false; message: string } {
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };
    if (this.auction.auctionType !== "blind") return { ok: false, message: "Not a blind auction." };
    if (this.auction.itemCategory !== "gadget") return { ok: false, message: "Not a gadget auction." };
    if (!this.hiddenGadget) return { ok: false, message: "No hidden gadget to reveal." };

    this.auction.gadgetType = this.hiddenGadget;
    return { ok: true, gadgetType: this.hiddenGadget };
  }

  stopAuction(): { ok: true; winnerId: string | null; animalType: AnimalType | null; gadgetType: GadgetType | null; itemCategory: AuctionItemCategory } | { ok: false; message: string } {
    if (!this.auction.isActive) return { ok: false, message: "No active auction." };

    const winnerId = this.auction.highestBidderId;
    const category = this.auction.itemCategory;
    let awardAnimal: AnimalType | null = this.auction.animalType;
    const awardGadget: GadgetType | null = this.auction.gadgetType;

    if (category === "animal" && this.auction.auctionType === "blind" && this.hiddenAnimal) {
      awardAnimal = this.hiddenAnimal;
      this.auction.animalType = this.hiddenAnimal;
    }

    let awardGadgetFinal: GadgetType | null = awardGadget;
    if (category === "gadget" && this.auction.auctionType === "blind" && this.hiddenGadget) {
      awardGadgetFinal = this.hiddenGadget;
      this.auction.gadgetType = this.hiddenGadget;
    }

    if (winnerId) {
      const winner = this.getTeam(winnerId);
      if (winner) {
        const winningBidAmount = this.highestBid?.amount ?? this.auction.currentPrice;
        winner.balance -= winningBidAmount;
        winner.lockedBid = 0;

        if (category === "gadget" && awardGadgetFinal) {
          if (this.auction.auctionType === "switch" && this.auction.switchTarget) {
            this.switchOffer = {
              auctionId: this.auction.id!,
              teamId: winnerId,
              originalAnimal: "cow" as AnimalType,
              switchTarget: "cow" as AnimalType,
              originalGadget: awardGadgetFinal,
              switchTargetGadget: this.auction.switchTarget as unknown as GadgetType,
              itemCategory: "gadget",
              status: "pending",
            };
          } else {
            winner.gadgets.push({ id: uuid(), type: awardGadgetFinal, acquiredAt: Date.now() });
          }
        } else if (category === "animal" && awardAnimal) {
          if (this.auction.auctionType === "switch" && this.auction.switchTarget) {
            this.switchOffer = {
              auctionId: this.auction.id!,
              teamId: winnerId,
              originalAnimal: awardAnimal,
              switchTarget: this.auction.switchTarget,
              status: "pending",
            };
          } else {
            winner.farm.push({ id: uuid(), type: awardAnimal, acquiredAt: Date.now() });
          }
        }
      }
    }

    this.auction.isActive = false;
    this.auction.endedAt = Date.now();

    return { ok: true, winnerId, animalType: awardAnimal, gadgetType: awardGadgetFinal, itemCategory: category };
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

    if (this.switchOffer.itemCategory === "gadget") {
      const gadgetToAdd = choice === "accept"
        ? this.switchOffer.originalGadget!
        : this.switchOffer.switchTargetGadget!;
      if (GADGETS[gadgetToAdd]) {
        team.gadgets.push({ id: uuid(), type: gadgetToAdd, acquiredAt: Date.now() });
      } else if (ANIMALS[gadgetToAdd as unknown as AnimalType]) {
        team.farm.push({ id: uuid(), type: gadgetToAdd as unknown as AnimalType, acquiredAt: Date.now() });
      }
    } else {
      const animalToAdd = choice === "accept" ? this.switchOffer.originalAnimal : this.switchOffer.switchTarget;
      team.farm.push({ id: uuid(), type: animalToAdd, acquiredAt: Date.now() });
    }

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

  // --- Peer-to-Peer Trade Offers ---

  createMoneyTradeOffer(
    fromTeamId: string,
    toTeamId: string,
    requestedAnimalId: string,
    offeredPrice: number
  ): { ok: true; offer: TradeOffer } | { ok: false; message: string } {
    const fromTeam = this.getTeam(fromTeamId);
    const toTeam = this.getTeam(toTeamId);
    if (!fromTeam) return { ok: false, message: "Your team not found." };
    if (!toTeam) return { ok: false, message: "Target team not found." };
    if (fromTeamId === toTeamId) return { ok: false, message: "Cannot trade with yourself." };
    if (offeredPrice <= 0) return { ok: false, message: "Offer price must be positive." };
    if (offeredPrice > fromTeam.balance) return { ok: false, message: "Insufficient balance for this offer." };

    const animal = toTeam.farm.find((a) => a.id === requestedAnimalId);
    if (!animal) return { ok: false, message: "That animal doesn't belong to the target team." };
    if (this.isAnimalInPendingTrade(animal.id)) {
      return { ok: false, message: "That animal is already involved in another pending trade." };
    }

    const offer: TradeOffer = {
      id: uuid(),
      type: "money",
      fromTeamId,
      toTeamId,
      offeredPrice,
      requestedAnimalId: animal.id,
      requestedAnimalType: animal.type,
      status: "pending",
      createdAt: Date.now(),
    };
    this.tradeOffers.push(offer);
    return { ok: true, offer };
  }

  createMoneyGadgetTradeOffer(
    fromTeamId: string,
    toTeamId: string,
    requestedGadgetId: string,
    offeredPrice: number
  ): { ok: true; offer: TradeOffer } | { ok: false; message: string } {
    const fromTeam = this.getTeam(fromTeamId);
    const toTeam = this.getTeam(toTeamId);
    if (!fromTeam) return { ok: false, message: "Your team not found." };
    if (!toTeam) return { ok: false, message: "Target team not found." };
    if (fromTeamId === toTeamId) return { ok: false, message: "Cannot trade with yourself." };
    if (offeredPrice <= 0) return { ok: false, message: "Offer price must be positive." };
    if (offeredPrice > fromTeam.balance) return { ok: false, message: "Insufficient balance for this offer." };

    const gadget = toTeam.gadgets.find((g) => g.id === requestedGadgetId);
    if (!gadget) return { ok: false, message: "That gadget doesn't belong to the target team." };
    if (this.isGadgetInPendingTrade(gadget.id)) {
      return { ok: false, message: "That gadget is already involved in another pending trade." };
    }

    const offer: TradeOffer = {
      id: uuid(),
      type: "money",
      fromTeamId,
      toTeamId,
      offeredPrice,
      requestedGadgetId: gadget.id,
      requestedGadgetType: gadget.type,
      itemCategory: "gadget",
      status: "pending",
      createdAt: Date.now(),
    };
    this.tradeOffers.push(offer);
    return { ok: true, offer };
  }

  createSwapTradeOffer(
    fromTeamId: string,
    toTeamId: string,
    offeredAnimalId: string,
    requestedAnimalId: string
  ): { ok: true; offer: TradeOffer } | { ok: false; message: string } {
    const fromTeam = this.getTeam(fromTeamId);
    const toTeam = this.getTeam(toTeamId);
    if (!fromTeam) return { ok: false, message: "Your team not found." };
    if (!toTeam) return { ok: false, message: "Target team not found." };
    if (fromTeamId === toTeamId) return { ok: false, message: "Cannot trade with yourself." };

    const offeredAnimal = fromTeam.farm.find((a) => a.id === offeredAnimalId);
    if (!offeredAnimal) return { ok: false, message: "You don't own the animal you're offering." };
    if (this.isAnimalInPendingTrade(offeredAnimal.id)) {
      return { ok: false, message: "Your offered animal is already involved in another pending trade." };
    }

    const requestedAnimal = toTeam.farm.find((a) => a.id === requestedAnimalId);
    if (!requestedAnimal) return { ok: false, message: "That animal doesn't belong to the target team." };
    if (this.isAnimalInPendingTrade(requestedAnimal.id)) {
      return { ok: false, message: "That animal is already involved in another pending trade." };
    }

    const offer: TradeOffer = {
      id: uuid(),
      type: "swap",
      fromTeamId,
      toTeamId,
      offeredAnimalId: offeredAnimal.id,
      offeredAnimalType: offeredAnimal.type,
      requestedAnimalId: requestedAnimal.id,
      requestedAnimalType: requestedAnimal.type,
      status: "pending",
      createdAt: Date.now(),
    };
    this.tradeOffers.push(offer);
    return { ok: true, offer };
  }

  // ── NEW: Swap involving gadgets (any combo: animal↔gadget, gadget↔animal, gadget↔gadget) ──
  createSwapGadgetTradeOffer(
    fromTeamId: string,
    toTeamId: string,
    // What fromTeam is offering — exactly one of these will be set
    offeredAnimalId: string | null,
    offeredGadgetId: string | null,
    // What fromTeam wants — exactly one of these will be set (animal already handled by createSwapTradeOffer)
    requestedAnimalId: string | null,
    requestedGadgetId: string | null,
  ): { ok: true; offer: TradeOffer } | { ok: false; message: string } {
    const fromTeam = this.getTeam(fromTeamId);
    const toTeam = this.getTeam(toTeamId);
    if (!fromTeam) return { ok: false, message: "Your team not found." };
    if (!toTeam) return { ok: false, message: "Target team not found." };
    if (fromTeamId === toTeamId) return { ok: false, message: "Cannot trade with yourself." };
    if (!offeredAnimalId && !offeredGadgetId) return { ok: false, message: "You must offer something." };
    if (!requestedAnimalId && !requestedGadgetId) return { ok: false, message: "You must request something." };

    const offer: TradeOffer = {
      id: uuid(),
      type: "swap",
      fromTeamId,
      toTeamId,
      status: "pending",
      createdAt: Date.now(),
      itemCategory: offeredGadgetId || requestedGadgetId ? "gadget" : "animal",
    };

    // Validate and attach offered item
    if (offeredAnimalId) {
      const animal = fromTeam.farm.find((a) => a.id === offeredAnimalId);
      if (!animal) return { ok: false, message: "You don't own the animal you're offering." };
      if (this.isAnimalInPendingTrade(animal.id)) return { ok: false, message: "Your offered animal is already in a pending trade." };
      offer.offeredAnimalId = animal.id;
      offer.offeredAnimalType = animal.type;
    } else if (offeredGadgetId) {
      const gadget = fromTeam.gadgets.find((g) => g.id === offeredGadgetId);
      if (!gadget) return { ok: false, message: "You don't own the gadget you're offering." };
      if (this.isGadgetInPendingTrade(gadget.id)) return { ok: false, message: "Your offered gadget is already in a pending trade." };
      offer.offeredGadgetId = gadget.id;
      offer.offeredGadgetType = gadget.type;
    }

    // Validate and attach requested item
    if (requestedAnimalId) {
      const animal = toTeam.farm.find((a) => a.id === requestedAnimalId);
      if (!animal) return { ok: false, message: "That animal doesn't belong to the target team." };
      if (this.isAnimalInPendingTrade(animal.id)) return { ok: false, message: "That animal is already in a pending trade." };
      offer.requestedAnimalId = animal.id;
      offer.requestedAnimalType = animal.type;
    } else if (requestedGadgetId) {
      const gadget = toTeam.gadgets.find((g) => g.id === requestedGadgetId);
      if (!gadget) return { ok: false, message: "That gadget doesn't belong to the target team." };
      if (this.isGadgetInPendingTrade(gadget.id)) return { ok: false, message: "That gadget is already in a pending trade." };
      offer.requestedGadgetId = gadget.id;
      offer.requestedGadgetType = gadget.type;
    }

    this.tradeOffers.push(offer);
    return { ok: true, offer };
  }
  // ─────────────────────────────────────────────────────────────────────────────

  respondToTradeOffer(
    teamId: string,
    offerId: string,
    accept: boolean
  ): { ok: true } | { ok: false; message: string } {
    const offer = this.tradeOffers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, message: "Trade offer not found." };
    if (offer.toTeamId !== teamId) return { ok: false, message: "This offer is not for your team." };
    if (offer.status !== "pending") return { ok: false, message: "Offer already resolved." };

    if (!accept) {
      offer.status = "rejected";
      return { ok: true };
    }

    const fromTeam = this.getTeam(offer.fromTeamId);
    const toTeam = this.getTeam(offer.toTeamId);
    if (!fromTeam || !toTeam) {
      offer.status = "rejected";
      return { ok: false, message: "A team no longer exists." };
    }

    if (offer.type === "money") {
      if (offer.offeredPrice === undefined) {
        return { ok: false, message: "Invalid money offer data." };
      }
      if (offer.offeredPrice > fromTeam.balance) {
        return { ok: false, message: "Offering team no longer has enough balance." };
      }

      if (offer.itemCategory === "gadget") {
        if (!offer.requestedGadgetId || !offer.requestedGadgetType) {
          return { ok: false, message: "Invalid gadget offer data." };
        }
        const gadgetIdx = toTeam.gadgets.findIndex((g) => g.id === offer.requestedGadgetId);
        if (gadgetIdx < 0) {
          return { ok: false, message: "Gadget no longer exists." };
        }
        toTeam.gadgets.splice(gadgetIdx, 1);
        toTeam.balance += offer.offeredPrice;
        fromTeam.gadgets.push({ id: uuid(), type: offer.requestedGadgetType, acquiredAt: Date.now() });
        fromTeam.balance -= offer.offeredPrice;
      } else {
        if (!offer.requestedAnimalId || !offer.requestedAnimalType) {
          return { ok: false, message: "Invalid animal offer data." };
        }
        const animalIdx = toTeam.farm.findIndex((a) => a.id === offer.requestedAnimalId);
        if (animalIdx < 0) {
          return { ok: false, message: "Animal no longer exists in farm." };
        }
        toTeam.farm.splice(animalIdx, 1);
        toTeam.balance += offer.offeredPrice;
        fromTeam.farm.push({ id: uuid(), type: offer.requestedAnimalType, acquiredAt: Date.now() });
        fromTeam.balance -= offer.offeredPrice;
      }
    } else {
      // ── SWAP — now handles all 4 combinations ──────────────────────────────

      // Remove offered item from fromTeam
      if (offer.offeredAnimalId) {
        const idx = fromTeam.farm.findIndex((a) => a.id === offer.offeredAnimalId);
        if (idx < 0) return { ok: false, message: "Offered animal no longer exists." };
        fromTeam.farm.splice(idx, 1);
      } else if (offer.offeredGadgetId) {
        const idx = fromTeam.gadgets.findIndex((g) => g.id === offer.offeredGadgetId);
        if (idx < 0) return { ok: false, message: "Offered gadget no longer exists." };
        fromTeam.gadgets.splice(idx, 1);
      } else {
        return { ok: false, message: "Invalid swap: nothing offered." };
      }

      // Remove requested item from toTeam
      if (offer.requestedAnimalId) {
        const idx = toTeam.farm.findIndex((a) => a.id === offer.requestedAnimalId);
        if (idx < 0) return { ok: false, message: "Requested animal no longer exists." };
        toTeam.farm.splice(idx, 1);
      } else if (offer.requestedGadgetId) {
        const idx = toTeam.gadgets.findIndex((g) => g.id === offer.requestedGadgetId);
        if (idx < 0) return { ok: false, message: "Requested gadget no longer exists." };
        toTeam.gadgets.splice(idx, 1);
      } else {
        return { ok: false, message: "Invalid swap: nothing requested." };
      }

      // Give offered item to toTeam
      if (offer.offeredAnimalType) {
        toTeam.farm.push({ id: uuid(), type: offer.offeredAnimalType, acquiredAt: Date.now() });
      } else if (offer.offeredGadgetType) {
        toTeam.gadgets.push({ id: uuid(), type: offer.offeredGadgetType, acquiredAt: Date.now() });
      }

      // Give requested item to fromTeam
      if (offer.requestedAnimalType) {
        fromTeam.farm.push({ id: uuid(), type: offer.requestedAnimalType, acquiredAt: Date.now() });
      } else if (offer.requestedGadgetType) {
        fromTeam.gadgets.push({ id: uuid(), type: offer.requestedGadgetType, acquiredAt: Date.now() });
      }
      // ───────────────────────────────────────────────────────────────────────
    }

    offer.status = "accepted";

    // Cancel other pending offers involving the same animals/gadgets
    this.tradeOffers.forEach((o) => {
      if (o.id !== offerId && o.status === "pending") {
        const involvedAnimals = [o.offeredAnimalId, o.requestedAnimalId].filter(Boolean);
        const involvedGadgets = [o.offeredGadgetId, o.requestedGadgetId].filter(Boolean);
        const tradedAnimals = [offer.offeredAnimalId, offer.requestedAnimalId].filter(Boolean);
        const tradedGadgets = [offer.offeredGadgetId, offer.requestedGadgetId].filter(Boolean);
        if (
          involvedAnimals.some((id) => tradedAnimals.includes(id)) ||
          involvedGadgets.some((id) => tradedGadgets.includes(id))
        ) {
          o.status = "cancelled";
        }
      }
    });

    return { ok: true };
  }

  cancelTradeOffer(
    teamId: string,
    offerId: string
  ): { ok: true } | { ok: false; message: string } {
    const offer = this.tradeOffers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, message: "Trade offer not found." };
    if (offer.fromTeamId !== teamId) return { ok: false, message: "You can only cancel your own offers." };
    if (offer.status !== "pending") return { ok: false, message: "Offer already resolved." };
    offer.status = "cancelled";
    return { ok: true };
  }

  cancelTradeOfferAsAdmin(
    offerId: string
  ): { ok: true; offer: TradeOffer } | { ok: false; message: string } {
    const offer = this.tradeOffers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, message: "Trade offer not found." };
    if (offer.status !== "pending") return { ok: false, message: "Offer already resolved." };
    offer.status = "cancelled";
    return { ok: true, offer };
  }

  getTradeOffersForTeam(teamId: string): { incoming: TradeOffer[]; outgoing: TradeOffer[] } {
    const incoming = this.tradeOffers.filter((o) => o.toTeamId === teamId && o.status === "pending");
    const outgoing = this.tradeOffers.filter((o) => o.fromTeamId === teamId && o.status === "pending");
    return { incoming, outgoing };
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
    const trades = this.getTradeOffersForTeam(teamId);
    return {
      ...this.getPublicState(),
      team: this.teamToPlayer(team),
      incomingTradeOffers: trades.incoming,
      outgoingTradeOffers: trades.outgoing,
    };
  }

  getAdminState(): AdminState {
    return {
      ...this.getPublicState(),
      allTeams: Array.from(this.teams.values()),
      canStartAuction: !this.auction.isActive,
      allTradeOffers: this.tradeOffers,
    };
  }

  getPendingSwitchForTeam(teamId: string): SwitchOffer | null {
    if (this.switchOffer && this.switchOffer.teamId === teamId && this.switchOffer.status === "pending") {
      return this.switchOffer;
    }
    return null;
  }
}