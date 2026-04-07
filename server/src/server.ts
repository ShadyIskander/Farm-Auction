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

// Serve frontend from workspace /public
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

// Broadcast state updates to appropriate clients
const emitPublicState = () => {
  const state: PublicState = game.getPublicState();
  io.emit("state:update", state);

  // CRITICAL UPDATE: Force push individual user state to every connected team
  // whenever the public state changes. This mimics Admin behavior and guarantees sync.
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

  socket.on("admin:auction:start", ({ animalType, startingPrice, auctionType, switchTarget }: { animalType?: string; startingPrice?: number; auctionType?: string; switchTarget?: string | null }) => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }
    if (typeof animalType !== "string" || typeof startingPrice !== "number" || typeof auctionType !== "string") {
      socket.emit("admin:error", { message: "Invalid parameters." });
      return;
    }
    const result = game.startAuction(animalType as any, startingPrice, auctionType as any, switchTarget as any);
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }
    emitPublicState();
    emitAdminState();

    // Broadcast fresh USER state to all connected teams so they see the auction immediately
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
    // Push updated state to winner (contains awarded animal)
    if (result.winnerId) {
      emitUserState(result.winnerId);
    }
    emitPublicState();
    emitAdminState();
    sessions.forEach((sess) => {
      if (sess.teamId && sess.teamId !== result.winnerId) emitUserState(sess.teamId);
    });
    io.emit("auction:ended", { winnerId: result.winnerId, animalType: result.animalType });
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

  // Add this after the other socket.on handlers (around line 183, after the "admin:auction:cancel" handler)

  socket.on("admin:animal:reveal", () => {
    const session = sessions.get(socket.id);
    if (!session?.isAdmin) {
      socket.emit("admin:error", { message: "Admin access required." });
      return;
    }

    const result = game.revealAnimal();
    if (!result.ok) {
      socket.emit("admin:error", { message: result.message });
      return;
    }

    console.log(`Admin revealed animal: ${result.animalType}`);

    // Broadcast reveal to all public viewers
    io.emit("auction:animal:revealed", {
      animalType: result.animalType
    });

    // Also update the public state to reflect the reveal
    // This ensures the animal stays revealed even if someone reloads
    emitPublicState();
    emitAdminState();

    // Notify admin
    socket.emit("admin:success", { message: `Animal (${result.animalType}) revealed to all viewers.` });
  });
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
