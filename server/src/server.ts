import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { FarmAuctionGame } from "./gameState";
import { PublicState, UserState, AdminState, BuybackOffer, SwitchOffer } from "./types";

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const game = new FarmAuctionGame();

interface SocketSession {
  teamId?: string;
  isAdmin?: boolean;
  interfaceType?: "user" | "admin" | "public";
}

const sessions = new Map<string, SocketSession>();

app.use(express.json());
app.use(cors());

const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

// Broadcast state updates to appropriate clients
const emitPublicState = () => {
  const state: PublicState = game.getPublicState();
  io.emit("state:update", state);

  sessions.forEach((sess, sid) => {
    if (sess.teamId) {
      const userState = game.getUserState(sess.teamId);
      if (userState) {
        io.to(sid).emit("user:state", userState);
      }
    }
  });
};

const emitUserState = (teamId: string) => {
  const state = game.getUserState(teamId);
  if (!state) return;
  sessions.forEach((sess, sid) => {
    if (sess.teamId === teamId) {
      io.to(sid).emit("user:state", state);
    }
  });
};

const emitAdminState = () => {
  const state = game.getAdminState();
  sessions.forEach((sess, sid) => {
    if (sess.isAdmin) {
      io.to(sid).emit("admin:state", state);
    }
  });
};

const emitTradeResolved = (teamId: string, payload: { offerId: string; status: string }) => {
  sessions.forEach((sess, sid) => {
    if (sess.teamId === teamId) {
      io.to(sid).emit("trade:resolved", payload);
    }
  });
};

const emitSwitchOffer = (offer: SwitchOffer | null) => {
  if (!offer) return;
  sessions.forEach((sess, sid) => {
    if (sess.teamId === offer.teamId) {
      io.to(sid).emit("switch:pending", offer);
    }
  });
};

const emitBuybackOffer = (offer: BuybackOffer) => {
  sessions.forEach((sess, sid) => {
    if (sess.teamId === offer.teamId) {
      io.to(sid).emit("buyback:offer", offer);
    }
  });
};

io.on("connection", (socket: Socket) => {
  sessions.set(socket.id, {});

  socket.on("team:register", ({ username, password }: { username?: string; password?: string }) => {
    socket.emit("team:register:error", { message: "Registration is disabled. Use preset credentials." });
  });

  socket.on("team:login", ({ username, password }: { username?: string; password?: string }) => {
    if (typeof username !== "string" || typeof password !== "string") {
      socket.emit("team:login:error", { message: "Username and password are required." });
      return;
    }
    const result = game.loginTeam(username, password);
    if (!result.ok) {
      socket.emit("team:login:error", { message: result.message });
      return;
    }
    const session = sessions.get(socket.id);
    if (session) {
      session.teamId = result.teamId;
      session.interfaceType = "user";
    }
    const userState = game.getUserState(result.teamId);
    if (userState) {
      socket.emit("team:login:success", { userState });
      emitPublicState();
    }
  });

  socket.on("admin:login", ({ password }: { password?: string }) => {
    if (typeof password !== "string") {
      socket.emit("admin:login:error", { message: "Password is required." });
      return;
    }
    if (!game.verifyAdmin(password)) {
      socket.emit("admin:login:error", { message: "Invalid admin password." });
      return;
    }
    const session = sessions.get(socket.id);
    if (session) {
      session.isAdmin = true;
      session.interfaceType = "admin";
    }
    socket.emit("admin:login:success", { adminState: game.getAdminState() });
    emitPublicState();
  });

  socket.on("public:connect", () => {
    const session = sessions.get(socket.id);
    if (session) session.interfaceType = "public";
    socket.emit("state:update", game.getPublicState());
  });

  socket.on("bid:place", ({ amount }: { amount?: number }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) {
      socket.emit("bid:error", { message: "Please login first." });
      return;
    }
    if (typeof amount !== "number") {
      socket.emit("bid:error", { message: "Amount is required." });
      return;
    }
    const result = game.placeBid(session.teamId, amount);
    if (!result.ok) {
      socket.emit("bid:error", { message: result.message });
      return;
    }
    emitPublicState();
    emitUserState(session.teamId);
  });

  socket.on("admin:auction:start", ({
    animalType,
    animalTypes,
    startingPrice,
    auctionType,
    switchTarget,
    itemCategory,
    gadgetType,
    gadgetTypes,
  }: {
    animalType?: string;
    animalTypes?: string[];
    startingPrice?: number;
    auctionType?: string;
    switchTarget?: string | null;
    itemCategory?: string;
    gadgetType?: string | null;
    gadgetTypes?: string[] | null;
  }) => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    if (typeof startingPrice !== "number") {
      socket.emit("admin:error", { message: "Starting price is required." });
      return;
    }

    const resolvedAuctionType = (auctionType ?? "normal") as any;

    // Resolve arrays — supports single value, array, or mixed bundle
    const resolvedAnimalTypes: string[] = animalTypes?.length
      ? animalTypes : animalType ? [animalType] : [];
    const resolvedGadgetTypes: string[] = gadgetTypes?.length
      ? gadgetTypes : gadgetType ? [gadgetType] : [];

    const totalItems = resolvedAnimalTypes.length + resolvedGadgetTypes.length;
    if (totalItems === 0) {
      socket.emit("admin:error", { message: "Must select at least one animal or gadget." });
      return;
    }

    // itemCategory: animal if any animals, else gadget
    const category: "animal" | "gadget" = resolvedAnimalTypes.length > 0 ? "animal" : "gadget";

    const result = game.startAuction(
      resolvedAnimalTypes as any,
      startingPrice,
      resolvedAuctionType,
      (switchTarget ?? null) as any,
      category,
      resolvedGadgetTypes.length > 0 ? resolvedGadgetTypes as any : null
    );
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }

    emitPublicState();
    emitAdminState();

    sessions.forEach((sess) => {
      if (sess.teamId) {
        emitUserState(sess.teamId);
      }
    });

    io.emit("auction:started");
  });

  socket.on("admin:auction:stop", () => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    const result = game.stopAuction();
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    if (result.winnerId) {
      emitUserState(result.winnerId);
    }
    emitPublicState();
    emitAdminState();
    sessions.forEach((sess) => {
      if (sess.teamId && sess.teamId !== result.winnerId) emitUserState(sess.teamId);
    });
    io.emit("auction:ended", {
      winnerId: result.winnerId,
      animalType: result.animalType,
      gadgetType: result.gadgetType,
      itemCategory: result.itemCategory,
    });
    emitSwitchOffer(game.getPublicState().switchOffer);
  });

  socket.on("admin:auction:cancel", () => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    const result = game.cancelAuction();
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    emitPublicState();
    emitAdminState();
    io.emit("auction:cancelled");
  });

  // Single reveal handler covers animal, gadget, and mixed bundles
  const handleReveal = (socket: any) => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    const result = game.revealBundle();
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    console.log(`Admin revealed bundle — animals: ${result.animalTypes}, gadgets: ${result.gadgetTypes}`);
    // Emit a single unified event all clients listen to
    io.emit("auction:bundle:revealed", {
      animalTypes: result.animalTypes,
      gadgetTypes: result.gadgetTypes,
      isBundle: result.isBundle,
    });
    emitPublicState();
    emitAdminState();
    sessions.forEach((sess) => { if (sess.teamId) emitUserState(sess.teamId); });
    socket.emit("admin:success", { message: `Revealed ${result.animalTypes.length + result.gadgetTypes.length} item(s).` });
  };

  socket.on("admin:animal:reveal", () => handleReveal(socket));
  socket.on("admin:gadget:reveal", () => handleReveal(socket));
  socket.on("admin:bundle:reveal", () => handleReveal(socket));

  socket.on("switch:choose", ({ choice }: { choice?: string }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) {
      socket.emit("switch:error", { message: "Please login first." });
      return;
    }
    if (choice !== "accept" && choice !== "switch") {
      socket.emit("switch:error", { message: "Invalid choice." });
      return;
    }
    const result = game.handleSwitchChoice(session.teamId, choice);
    if (!result.ok) {
      socket.emit("switch:error", { message: result.message });
      return;
    }
    emitPublicState();
    emitUserState(session.teamId);
    socket.emit("switch:success", { choice });
  });

  socket.on("switch:check", () => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) return;
    const pending = game.getPendingSwitchForTeam(session.teamId);
    if (pending) socket.emit("switch:pending", pending);
  });

  socket.on("admin:buyback:offer", ({ teamId, animalId, price }: { teamId?: string; animalId?: string; price?: number }) => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    if (typeof teamId !== "string" || typeof animalId !== "string" || typeof price !== "number") {
      socket.emit("admin:error", { message: "Invalid buyback parameters." });
      return;
    }
    const result = game.createBuybackOffer(teamId, animalId, price);
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    emitBuybackOffer(result.offer);
    emitPublicState();
    emitAdminState();
  });

  socket.on("buyback:respond", ({ offerId, decision }: { offerId?: string; decision?: string }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) {
      socket.emit("buyback:error", { message: "Please login first." });
      return;
    }
    if (typeof offerId !== "string" || (decision !== "accept" && decision !== "reject")) {
      socket.emit("buyback:error", { message: "Invalid response." });
      return;
    }
    const result = game.handleBuybackResponse(session.teamId, offerId, decision === "accept");
    if (!result.ok) {
      socket.emit("buyback:error", { message: result.message });
      return;
    }
    emitPublicState();
    emitUserState(session.teamId);
    emitAdminState();
  });

  socket.on("state:request", () => {
    const session = sessions.get(socket.id);
    if (session?.teamId) {
      const userState = game.getUserState(session.teamId);
      if (userState) socket.emit("user:state", userState);
    } else if (session?.isAdmin) {
      socket.emit("admin:state", game.getAdminState());
    } else {
      socket.emit("state:update", game.getPublicState());
    }
  });

  // --- Peer-to-Peer Trade Offers ---

  // Money offer for an animal
  socket.on("trade:offer:money", ({ toTeamId, requestedAnimalId, offeredPrice }: { toTeamId?: string; requestedAnimalId?: string; offeredPrice?: number }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (game.getPublicState().auction.isActive) { socket.emit("trade:error", { message: "Trade offers are disabled while an auction is active." }); return; }
    if (typeof toTeamId !== "string" || typeof requestedAnimalId !== "string" || typeof offeredPrice !== "number") {
      socket.emit("trade:error", { message: "Invalid trade parameters." }); return;
    }
    const result = game.createMoneyTradeOffer(session.teamId, toTeamId, requestedAnimalId, offeredPrice);
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    sessions.forEach((sess, sid) => {
      if (sess.teamId === toTeamId) io.to(sid).emit("trade:incoming", result.offer);
    });
    emitUserState(session.teamId);
    emitUserState(toTeamId);
    emitAdminState();
    socket.emit("trade:sent", { offer: result.offer });
  });

  // Money offer for a gadget
  socket.on("trade:offer:money:gadget", ({ toTeamId, requestedGadgetId, offeredPrice }: { toTeamId?: string; requestedGadgetId?: string; offeredPrice?: number }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (game.getPublicState().auction.isActive) { socket.emit("trade:error", { message: "Trade offers are disabled while an auction is active." }); return; }
    if (typeof toTeamId !== "string" || typeof requestedGadgetId !== "string" || typeof offeredPrice !== "number") {
      socket.emit("trade:error", { message: "Invalid gadget trade parameters." }); return;
    }
    const result = game.createMoneyGadgetTradeOffer(session.teamId, toTeamId, requestedGadgetId, offeredPrice);
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    sessions.forEach((sess, sid) => {
      if (sess.teamId === toTeamId) io.to(sid).emit("trade:incoming", result.offer);
    });
    emitUserState(session.teamId);
    emitUserState(toTeamId);
    emitAdminState();
    socket.emit("trade:sent", { offer: result.offer });
  });

  // Swap offer — animal for animal (original)
  socket.on("trade:offer:swap", ({ toTeamId, offeredAnimalId, requestedAnimalId }: { toTeamId?: string; offeredAnimalId?: string; requestedAnimalId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (game.getPublicState().auction.isActive) { socket.emit("trade:error", { message: "Trade offers are disabled while an auction is active." }); return; }
    if (typeof toTeamId !== "string" || typeof offeredAnimalId !== "string" || typeof requestedAnimalId !== "string") {
      socket.emit("trade:error", { message: "Invalid swap parameters." }); return;
    }
    const result = game.createSwapTradeOffer(session.teamId, toTeamId, offeredAnimalId, requestedAnimalId);
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    sessions.forEach((sess, sid) => {
      if (sess.teamId === toTeamId) io.to(sid).emit("trade:incoming", result.offer);
    });
    emitUserState(session.teamId);
    emitUserState(toTeamId);
    emitAdminState();
    socket.emit("trade:sent", { offer: result.offer });
  });

  // Swap offer — any combo involving gadgets (animal↔gadget, gadget↔animal, gadget↔gadget)
  socket.on("trade:offer:swap:gadget", ({
    toTeamId,
    offeredAnimalId,
    offeredGadgetId,
    requestedAnimalId,
    requestedGadgetId,
  }: {
    toTeamId?: string;
    offeredAnimalId?: string | null;
    offeredGadgetId?: string | null;
    requestedAnimalId?: string | null;
    requestedGadgetId?: string | null;
  }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (game.getPublicState().auction.isActive) { socket.emit("trade:error", { message: "Trade offers are disabled while an auction is active." }); return; }
    if (typeof toTeamId !== "string") { socket.emit("trade:error", { message: "Invalid swap parameters." }); return; }

    const result = game.createSwapGadgetTradeOffer(
      session.teamId,
      toTeamId,
      offeredAnimalId ?? null,
      offeredGadgetId ?? null,
      requestedAnimalId ?? null,
      requestedGadgetId ?? null,
    );
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    sessions.forEach((sess, sid) => {
      if (sess.teamId === toTeamId) io.to(sid).emit("trade:incoming", result.offer);
    });
    emitUserState(session.teamId);
    emitUserState(toTeamId);
    emitAdminState();
    socket.emit("trade:sent", { offer: result.offer });
  });

  // Respond to any trade offer (accept or reject)
  socket.on("trade:respond", ({ offerId, accept }: { offerId?: string; accept?: boolean }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (typeof offerId !== "string" || typeof accept !== "boolean") {
      socket.emit("trade:error", { message: "Invalid response." }); return;
    }
    const result = game.respondToTradeOffer(session.teamId, offerId, accept);
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    sessions.forEach((sess, sid) => {
      if (sess.teamId) {
        const userState = game.getUserState(sess.teamId);
        if (userState) io.to(sid).emit("user:state", userState);
      }
    });
    emitPublicState();
    emitAdminState();
  });

  // Cancel your own outgoing trade offer
  socket.on("trade:cancel", ({ offerId }: { offerId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session?.teamId) { socket.emit("trade:error", { message: "Please login first." }); return; }
    if (typeof offerId !== "string") { socket.emit("trade:error", { message: "Invalid offer ID." }); return; }
    const result = game.cancelTradeOffer(session.teamId, offerId);
    if (!result.ok) { socket.emit("trade:error", { message: result.message }); return; }
    emitUserState(session.teamId);
    sessions.forEach((sess) => {
      if (sess.teamId) emitUserState(sess.teamId);
    });
    emitAdminState();
  });

  // Admin cancel any trade offer
  socket.on("admin:trade:cancel", ({ offerId }: { offerId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    if (typeof offerId !== "string") {
      socket.emit("admin:error", { message: "Invalid offer ID." });
      return;
    }
    const result = game.cancelTradeOfferAsAdmin(offerId);
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    emitTradeResolved(result.offer.fromTeamId, { offerId: result.offer.id, status: "cancelled" });
    emitTradeResolved(result.offer.toTeamId, { offerId: result.offer.id, status: "cancelled" });
    emitUserState(result.offer.fromTeamId);
    emitUserState(result.offer.toTeamId);
    emitAdminState();
  });

  socket.on("disconnect", () => {
    sessions.delete(socket.id);
  });
});

setInterval(() => {
  // placeholder for future cleanup hooks
}, 1000);

server.listen(PORT, () => {
  console.log(`Farm Auction server running on http://localhost:${PORT}`);
  console.log(`Default admin password: admin`);
});