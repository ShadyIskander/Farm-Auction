// Animal Definitions
export type AnimalType = 
  | "cow" | "bull" 
  | "goat" | "sheep"
  | "chicken" | "rooster"
  | "doe" | "buck"
  | "cat" | "dog";

// Gadget Definitions — one per animal type
export type GadgetType =
  | "cow_milker"
  | "bull_harness"
  | "goat_bell"
  | "sheep_shears"
  | "chicken_nest"
  | "rooster_whistle"
  | "doe_saltlick"
  | "buck_antler_oil"
  | "cat_yarnball"
  | "dog_treats";

export interface Gadget {
  type: GadgetType;
  displayName: string;
  description: string;
  basePrice: number;
  // Which animal type this boosts (1:1)
  boostedAnimal: AnimalType;
  emoji: string;
  // Frontend image path (you can replace these paths anytime)
  imagePath: string;
}

export const GADGETS: Record<GadgetType, Gadget> = {
  cow_milker: {
    type: "cow_milker",
    displayName: "Cow Milker",
    description: "Doubles score for all Cows you own.",
    basePrice: 14,
    boostedAnimal: "cow",
    emoji: "🪣",
    imagePath: "/images/gadgets/cow_milker.png",
  },
  bull_harness: {
    type: "bull_harness",
    displayName: "Bull Harness",
    description: "Doubles score for all Bulls you own.",
    basePrice: 16,
    boostedAnimal: "bull",
    emoji: "🧰",
    imagePath: "/images/gadgets/bull_harness.png",
  },
  goat_bell: {
    type: "goat_bell",
    displayName: "Sheep Bell",
    description: "Doubles score for all Goats you own.",
    basePrice: 10,
    boostedAnimal: "goat",
    emoji: "🔔",
    imagePath: "/images/gadgets/goat_bell.png",
  },
  sheep_shears: {
    type: "sheep_shears",
    displayName: "Ram Shears",
    description: "Doubles score for all Sheep you own.",
    basePrice: 12,
    boostedAnimal: "sheep",
    emoji: "✂️",
    imagePath: "/images/gadgets/sheep_shears.png",
  },
  chicken_nest: {
    type: "chicken_nest",
    displayName: "Chicken Nest",
    description: "Doubles score for all Chickens you own.",
    basePrice: 8,
    boostedAnimal: "chicken",
    emoji: "🪺",
    imagePath: "/images/gadgets/chicken_nest.png",
  },
  rooster_whistle: {
    type: "rooster_whistle",
    displayName: "Rooster Whistle",
    description: "Doubles score for all Roosters you own.",
    basePrice: 9,
    boostedAnimal: "rooster",
    emoji: "📯",
    imagePath: "/images/gadgets/rooster_whistle.png",
  },
  doe_saltlick: {
    type: "doe_saltlick",
    displayName: "Doe Salt Lick",
    description: "Doubles score for all Does you own.",
    basePrice: 11,
    boostedAnimal: "doe",
    emoji: "🧂",
    imagePath: "/images/gadgets/doe_saltlick.png",
  },
  buck_antler_oil: {
    type: "buck_antler_oil",
    displayName: "Buck Antler Oil",
    description: "Doubles score for all Bucks you own.",
    basePrice: 13,
    boostedAnimal: "buck",
    emoji: "🧴",
    imagePath: "/images/gadgets/buck_antler_oil.png",
  },
  cat_yarnball: {
    type: "cat_yarnball",
    displayName: "Cat Silk Yarn Ball",
    description: "Doubles score for all Cats you own.",
    basePrice: 9,
    boostedAnimal: "cat",
    emoji: "🧶",
    imagePath: "/images/gadgets/cat_yarnball.png",
  },
  dog_treats: {
    type: "dog_treats",
    displayName: "Dog Treats",
    description: "Doubles score for all Dogs you own.",
    basePrice: 9,
    boostedAnimal: "dog",
    emoji: "🦴",
    imagePath: "/images/gadgets/dog_treats.png",
  },
};

// Maps each animal type to which gadget boosts it
export const ANIMAL_GADGET_MAP: Record<AnimalType, GadgetType> = {
  cow: "cow_milker",
  bull: "bull_harness",
  goat: "goat_bell",
  sheep: "sheep_shears",
  chicken: "chicken_nest",
  rooster: "rooster_whistle",
  doe: "doe_saltlick",
  buck: "buck_antler_oil",
  cat: "cat_yarnball",
  dog: "dog_treats",
};

export type AnimalGender = "male" | "female";

export interface Animal {
  type: AnimalType;
  gender: AnimalGender;
  baseValue: number;
  displayName: string;
}

// Animal definitions with fixed genders and base values
export const ANIMALS: Record<AnimalType, Animal> = {
  cow: { type: "cow", gender: "female", baseValue: 10, displayName: "Cow" },
  bull: { type: "bull", gender: "male", baseValue: 15, displayName: "Bull" },
  goat: { type: "goat", gender: "female", baseValue: 5, displayName: "Goat" },
  sheep: { type: "sheep", gender: "male", baseValue: 10, displayName: "Sheep" },
  chicken: { type: "chicken", gender: "female", baseValue: 3, displayName: "Chicken" },
  rooster: { type: "rooster", gender: "male", baseValue: 5, displayName: "Rooster" },
  doe: { type: "doe", gender: "female", baseValue: 8, displayName: "Doe" },
  buck: { type: "buck", gender: "male", baseValue: 12, displayName: "Buck" },
  cat: { type: "cat", gender: "female", baseValue: 4, displayName: "Cat" },
  dog: { type: "dog", gender: "male", baseValue: 6, displayName: "Dog" },
};

// Animal pairs (same species, opposite gender)
export const ANIMAL_PAIRS: Record<string, { male: AnimalType; female: AnimalType }> = {
  cattle: { male: "bull", female: "cow" },
  goats: { male: "sheep", female: "goat" },
  poultry: { male: "rooster", female: "chicken" },
  deer: { male: "buck", female: "doe" },
  pets: { male: "dog", female: "cat" },
};

export type AuctionType = "normal" | "blind" | "switch";

// Whether the auction item is an animal or a gadget
export type AuctionItemCategory = "animal" | "gadget";

export type BuybackOfferStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type SwitchStatus = "pending" | "accepted" | "switched" | "expired";

// Team/Player Types
export interface Team {
  id: string;
  username: string;
  passwordHash: string; // Simple hash for demo (use bcrypt in production)
  balance: number;
  lockedBid: number;
  farm: FarmAnimal[]; // Animals owned
  gadgets: FarmGadget[]; // Gadgets owned
  joinedAt: number;
}

export interface FarmAnimal {
  id: string;
  type: AnimalType;
  acquiredAt: number;
}

export interface FarmGadget {
  id: string;
  type: GadgetType;
  acquiredAt: number;
}

export interface Player {
  id: string;
  username: string;
  balance: number;
  lockedBid: number;
  farmValue: number;
  farm: FarmAnimal[];
  gadgets: FarmGadget[];
  joinedAt: number;
}

// Auction Types
export interface AuctionItem {
  id: string;
  // "animal" = standard auction, "gadget" = auctioning a gadget
  itemCategory: AuctionItemCategory;
  animalType: AnimalType | null; // null for blind auctions until reveal, or for gadget auctions
  gadgetType: GadgetType | null; // set when itemCategory === "gadget"
  switchTarget: AnimalType | null; // used for switch auctions (admin-chosen)
  startingPrice: number;
  currentPrice: number;
  highestBidderId: string | null;
  auctionType: AuctionType;
  isActive: boolean;
  startedAt: number | null;
  endedAt: number | null;
}

export interface Bid {
  id: string;
  teamId: string;
  amount: number;
  timestamp: number;
}

export interface BuybackOffer {
  id: string;
  teamId: string;
  animalId: string;
  animalType: AnimalType;
  price: number;
  status: BuybackOfferStatus;
  createdAt: number;
}

export interface SwitchOffer {
  auctionId: string;
  teamId: string;
  originalAnimal: AnimalType;
  switchTarget: AnimalType;
  status: SwitchStatus;
}

// Peer-to-Peer Trade Types
export type TradeOfferStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type TradeOfferType = "money" | "swap";

export interface TradeOffer {
  id: string;
  type: TradeOfferType;
  fromTeamId: string;
  toTeamId: string;
  // Money offer: fromTeam pays price to get toTeam's animal
  offeredPrice?: number;       // cash offered by fromTeam
  requestedAnimalId?: string;  // animal fromTeam wants from toTeam
  requestedAnimalType?: AnimalType;
  // Swap offer: fromTeam's animal <-> toTeam's animal
  offeredAnimalId?: string;    // animal fromTeam is offering
  offeredAnimalType?: AnimalType;
  status: TradeOfferStatus;
  createdAt: number;
}

// Public State (sent to all clients)
export interface PublicState {
  auction: AuctionItem;
  teams: Player[];
  highestBid: Bid | null;
  bidHistory: Bid[];
  buybacks: BuybackOffer[];
  switchOffer: SwitchOffer | null;
  gameActive: boolean;
}

// User-specific state (sent to logged-in teams)
export interface UserState extends PublicState {
  team: Player;
  incomingTradeOffers: TradeOffer[];
  outgoingTradeOffers: TradeOffer[];
}

// Admin state (sent to admin interface)
export interface AdminState extends PublicState {
  allTeams: Team[];
  canStartAuction: boolean;
  allTradeOffers: TradeOffer[]; // Admin can see all pending trades
}