// Animal Definitions
export type AnimalType = 
  | "cow" | "bull" 
  | "goat" | "sheep"
  | "chicken" | "rooster"
  | "doe" | "buck"
  | "cat" | "dog";

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
  joinedAt: number;
}

export interface FarmAnimal {
  id: string;
  type: AnimalType;
  acquiredAt: number;
}

export interface Player {
  id: string;
  username: string;
  balance: number;
  lockedBid: number;
  farmValue: number;
  farm: FarmAnimal[];
  joinedAt: number;
}

// Auction Types
export interface AuctionItem {
  id: string;
  animalType: AnimalType | null; // null for blind auctions until reveal
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
}