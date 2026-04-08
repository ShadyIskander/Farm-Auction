const socket = io();

// STATE & CREDENTIALS
let currentTeamId = null;
let currentState = null;
let switchChoiceData = null;
let activeCredentials = null; // Store for silent re-login
let activeTradeOffer = null;  // incoming trade offer pending response
let currentTradeType = "money";

// --- CONNECTION STABILITY ---

// 1. Silent Reconnection
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
  updateConnectionStatus("Connected", "green");

  // If we have credentials (from previous login or session), RE-LOGIN silently
  // This fixes the issue where server restart/disconnect made user "anonymous"
  if (activeCredentials) {
    console.log("Restoring session...");
    socket.emit("team:login", activeCredentials);
  }
});

socket.on("disconnect", () => {
  console.log("Socket disconnected");
  updateConnectionStatus("Reconnecting...", "orange");
});

function updateConnectionStatus(msg, color) {
  // Ideally add a small indicator in the UI
  // For now, let's log and maybe inject if element exists
  const container = document.getElementById("main-interface");
  if (container) {
    let status = document.getElementById("connection-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "connection-status";
      status.style.position = "fixed";
      status.style.bottom = "10px";
      status.style.right = "10px";
      status.style.fontSize = "0.8rem";
      status.style.opacity = "0.7";
      document.body.appendChild(status);
    }
    status.textContent = "● " + msg;
    status.style.color = color;
  }
}

// --- INITIALIZATION & LOGIN ---

// restore auto-login as requested (passes creds from index page or refresh)
window.addEventListener("load", () => {
  const savedU = sessionStorage.getItem("fa_u");
  const savedP = sessionStorage.getItem("fa_p");

  if (savedU && savedP) {
    console.log("Found credentials in storage, auto-logging in...");
    // Store globally so the 'connect' handler can also use them if socket reconnects
    activeCredentials = { username: savedU, password: savedP };

    // Optimistically hide login screen, show interface immediately
    const loginScreen = document.getElementById("login-screen");
    const mainInterface = document.getElementById("main-interface");
    if (loginScreen) loginScreen.style.display = "none";
    if (mainInterface) mainInterface.style.display = "block";

    // Emit login directly
    socket.emit("team:login", activeCredentials);
  }
});

// --- Image & Data Helpers ---

function getAnimalImage(type) {
  const images = {
    cow: 'images/cow.jpg',
    bull: 'images/bull.webp',
    goat: 'images/sheep.jpeg',
    sheep: 'images/Ram.webp',
    chicken: 'images/chicken.jpg',
    rooster: 'images/rooster.jpg',
    doe: 'images/doe.jpg',
    buck: 'images/Buck.jpg', // Matching case-sensitivity in your admin code
    cat: 'images/cat.jpg',
    dog: 'images/dog.jpg'
  };
  return images[type] || 'images/mystery.jpg';
}

function getAnimalData(type) {
  const animals = {
    cow: { type: "cow", gender: "female", baseValue: 10, displayName: "Cow" },
    bull: { type: "bull", gender: "male", baseValue: 15, displayName: "Bull" },
    goat: { type: "goat", gender: "female", baseValue: 5, displayName: "Sheep" },
    sheep: { type: "sheep", gender: "male", baseValue: 10, displayName: "Merino Sheep" },
    chicken: { type: "chicken", gender: "female", baseValue: 3, displayName: "Rhode Island Red" },
    rooster: { type: "rooster", gender: "male", baseValue: 5, displayName: "Rooster" },
    doe: { type: "doe", gender: "female", baseValue: 8, displayName: "Doe" },
    buck: { type: "buck", gender: "male", baseValue: 12, displayName: "Buck" },
    cat: { type: "cat", gender: "female", baseValue: 4, displayName: "Cat" },
    dog: { type: "dog", gender: "male", baseValue: 6, displayName: "Dog" },
  };
  return animals[type] || { displayName: "Unknown", baseValue: 0 };
}

// --- Login Logic ---

const loginForm = document.getElementById("login-form");
const loginScreen = document.getElementById("login-screen");
const mainInterface = document.getElementById("main-interface");
const presetGrid = document.getElementById("preset-grid");

if (presetGrid) {
  presetGrid.querySelectorAll(".preset-team").forEach((btn) => {
    btn.addEventListener("click", () => {
      const username = btn.getAttribute("data-username");
      const password = btn.getAttribute("data-password");
      if (username && password) {
        document.getElementById("username").value = username;
        document.getElementById("password").value = password;
      }
    });
  });
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  if (!username || !password) {
    showError("login-error", "Please enter username and password.");
    return;
  }
  socket.emit("team:login", { username, password });
});

// Auto-login removed as requested to prevent double-login confusion.
// Auto-login logic (Removed session clearing to allow persistence from index page)

// --- Socket Events ---

socket.on("team:login:success", ({ userState }) => {
  currentTeamId = userState.team.id;
  currentState = userState;

  const loginScreen = document.getElementById("login-screen");
  const mainInterface = document.getElementById("main-interface");

  if (loginScreen) loginScreen.style.display = "none";
  if (mainInterface) mainInterface.style.display = "block";

  const teamNameEl = document.getElementById("team-username");
  if (teamNameEl) teamNameEl.textContent = userState.team.username;

  renderState(userState);
  checkSwitchChoice();
});

socket.on("team:login:error", ({ message }) => {
  console.error("Login failed:", message);
  // Redirect to index on error
  sessionStorage.removeItem("fa_u");
  sessionStorage.removeItem("fa_p");
  window.location.href = "/index.html";
});

// Update specifically for THIS user (balance, farm, etc.)
// Update specifically for THIS user (balance, farm, etc.)
// This is now the main source of truth from the server broadcast
socket.on("user:state", (state) => {
  console.log("Full User State Received", state);
  currentState = state;
  renderState(state);
});

// Update for public game state (auction status, highest bidder, etc.)
// Fallback / View-only mode listener
socket.on("state:update", (publicState) => {
  if (!currentState || !currentState.team) {
    renderDashboard(publicState);
  }
});

socket.on("auction:started", () => {
  // Use state:request to be safe, but the display will be handled by renderState
  socket.emit("state:request");
  // Switch to bidding tab automatically
  switchTab("bidding");
});

socket.on("auction:ended", ({ winnerId, animalType }) => {
  if (winnerId === currentTeamId) {
    setTimeout(() => checkSwitchChoice(), 500);
  }
  document.getElementById("auction-display").style.display = "none";
  document.getElementById("auction-status").innerHTML = '<p class="muted">Auction Ended. Waiting for next round...</p>';
});

socket.on("auction:animal:revealed", ({ animalType }) => {
  if (currentState && currentState.auction) {
    currentState.auction.animalType = animalType;
    renderState(currentState);
  }
});

// --- Switch & Buyback Events ---

socket.on("switch:pending", (offer) => {
  console.log("Switch pending:", offer);
  const modal = document.getElementById("switch-modal");

  const original = getAnimalData(offer.originalAnimal);
  const target = getAnimalData(offer.switchTarget);

  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setTxt("switch-animal-name", original.displayName);

  const optionsDiv = modal.querySelector(".switch-options");
  if (optionsDiv) {
    optionsDiv.innerHTML = `
        <button class="btn-accept" onclick="handleSwitchChoice('accept')">Keep ${original.displayName}</button>
        <button class="btn-switch" onclick="handleSwitchChoice('switch')">Switch to Mystery Animal</button>
      `;
  }
  modal.style.display = "flex";
  switchChoiceData = offer;
});

socket.on("buyback:offer", ({ id, animalId, price, teamId, animalType }) => {
  console.log("Buyback offer received:", id, price, animalType);
  let type = animalType;

  if (!type && currentState && currentState.team) {
    const found = currentState.team.farm.find(a => a.id === animalId);
    if (found) type = found.type;
  }

  if (!type) {
    console.warn("Buyback offer for unknown animal type. ID:", animalId);
    return;
  }

  const animalData = getAnimalData(type);
  const modal = document.getElementById("buyback-modal");
  const animalNameEl = document.getElementById("buyback-animal");
  const priceEl = document.getElementById("buyback-price");

  if (animalNameEl) animalNameEl.textContent = animalData.displayName;
  if (priceEl) priceEl.textContent = price;

  modal.setAttribute("data-offer-id", id);
  modal.style.display = "flex";
});

// --- UI Rendering ---

function renderState(state) {
  try {
    console.log("Rendering State:", state);
    if (!state || !state.team) {
      console.warn("Invalid State Object:", state);
      return;
    }
    const team = state.team;
    const auction = state.auction;

    // Update Balance Stats - safely check existence
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText("farm-value", `${team.farmValue}`);
    setText("current-balance", `$${team.balance}`);
    setText("animal-count", team.farm.length);
    setText("pair-count", countPairs(team.farm));
    setText("player-balance", `$${team.balance}`);
    setText("player-locked", `$${team.lockedBid}`);

    renderFarm(team.farm);

    // Update trade tab dropdowns and outgoing offers
    populateTeamDropdowns(state);
    renderOutgoingOffers(state.outgoingTradeOffers || [], state.teams);

    // Check for incoming trade offers that need a popup (if modal not already open)
    if (state.incomingTradeOffers && state.incomingTradeOffers.length > 0 && !activeTradeOffer) {
      const modal = document.getElementById("trade-modal");
      if (modal && modal.style.display === "none") {
        showTradeModal(state.incomingTradeOffers[0]);
      }
    }

    // Auction Section
    const auctionDisplay = document.getElementById("auction-display");
    const iconContainer = document.getElementById("animal-icon");

    if (auction && auction.isActive) {
      if (auctionDisplay) auctionDisplay.style.display = "block";
      const statusEl = document.getElementById("auction-status");
      if (statusEl) statusEl.innerHTML = '<p class="success">Auction Active</p>';

      if (auction.animalType) {
        // Force lowercase to ensure matching
        const type = String(auction.animalType).toLowerCase();
        const animal = getAnimalData(type);
        const img = getAnimalImage(type);

        if (iconContainer) iconContainer.innerHTML = `<img src="${img}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;

        setText("animal-name", animal.displayName);
        setText("animal-value", `Base Value: ${animal.baseValue} Points`);
      } else {
        if (iconContainer) iconContainer.innerHTML = `<div style="font-size: 3rem; display: flex; align-items: center; justify-content: center; height:100%;">🎁</div>`;
        setText("animal-name", "Mystery Animal");
        setText("animal-value", "Hidden until reveal");
      }

      setText("current-price", `$${auction.currentPrice}`);
      const highestBidder = state.teams.find((t) => t.id === auction.highestBidderId);
      setText("highest-bidder", highestBidder ? highestBidder.username : "—");

      const minBid = auction.currentPrice + 1;
      setText("min-bid-hint", `Minimum bid: $${minBid}`);
      const bidInput = document.getElementById("bid-amount");
      if (bidInput) bidInput.min = minBid;

    } else {
      if (auctionDisplay) auctionDisplay.style.display = "none";
    }

    renderBidHistory(state.bidHistory || [], state.teams);
  } catch (e) {
    console.error("Render Error:", e);
  }
}

function renderFarm(farm) {
  const farmDisplay = document.getElementById("farm-display");
  const emptyFarm = document.getElementById("empty-farm");
  if (!farmDisplay) return;

  if (farm.length === 0) {
    if (emptyFarm) emptyFarm.style.display = "block";
    farmDisplay.innerHTML = "";
    return;
  }

  if (emptyFarm) emptyFarm.style.display = "none";
  const animalsByType = {};
  farm.forEach(a => {
    // safe lowercase
    const t = String(a.type).toLowerCase();
    animalsByType[t] = (animalsByType[t] || 0) + 1
  });
  const pairs = getPairStatus(animalsByType);

  farmDisplay.innerHTML = "";
  Object.entries(animalsByType).forEach(([type, count]) => {
    const animal = getAnimalData(type);
    const hasPair = pairs.has(type);

    // Create Stall Element
    const stall = document.createElement("div");
    stall.className = `stall ${hasPair ? "has-pair" : ""}`;

    stall.innerHTML = `
      <div class="animal-icon">
        <img src="${getAnimalImage(type)}" alt="${type}" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div class="stall-count">${count}</div>
      <div class="stall-info">
        <div class="stall-name">${animal.displayName}</div>
        <div class="stall-gender">${animal.gender === "female" ? "♀" : "♂"} | ${animal.baseValue} Points</div>
        ${hasPair ? '<div class="pair-badge">✓ Complete Pair</div>' : ""}
      </div>
    `;
    farmDisplay.appendChild(stall);
  });
}

// --- Logic Helpers (Pairs, Bids, Tabs) ---

function switchTab(tab) {
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
  document.getElementById(`tab-content-${tab}`).classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
}

function countPairs(farm) {
  const counts = {};
  farm.forEach(a => counts[a.type] = (counts[a.type] || 0) + 1);
  const pairs = [
    { m: "bull", f: "cow" }, { m: "sheep", f: "goat" },
    { m: "rooster", f: "chicken" }, { m: "buck", f: "doe" },
    { m: "dog", f: "cat" }
  ];
  return pairs.reduce((acc, p) => acc + Math.min(counts[p.m] || 0, counts[p.f] || 0), 0);
}

function getPairStatus(counts) {
  const pairs = [
    { m: "bull", f: "cow" }, { m: "sheep", f: "goat" },
    { m: "rooster", f: "chicken" }, { m: "buck", f: "doe" },
    { m: "dog", f: "cat" }
  ];
  const active = new Set();
  pairs.forEach(p => {
    if (counts[p.m] > 0 && counts[p.f] > 0) {
      active.add(p.m); active.add(p.f);
    }
  });
  return active;
}

function renderBidHistory(history, teams) {
  const list = document.getElementById("bid-history");
  if (!list) return;
  list.innerHTML = history.length ? "" : '<li class="muted">No bids yet</li>';
  [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10).forEach(bid => {
    const team = teams.find(t => t.id === bid.teamId);
    const li = document.createElement("li");
    li.innerHTML = `<span>${team ? team.username : "Unknown"}</span><span>$${bid.amount}</span>`;
    list.appendChild(li);
  });
}

// --- Bid Submission ---
const bidForm = document.getElementById("bid-form");
bidForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = Number(document.getElementById("bid-amount").value);
  if (amount > 0) {
    socket.emit("bid:place", { amount });
    document.getElementById("bid-amount").value = "";
  }
});

// --- Modals & Initialization ---
function handleSwitchChoice(choice) {
  socket.emit("switch:choose", { choice });
  document.getElementById("switch-modal").style.display = "none";
}
function checkSwitchChoice() { socket.emit("switch:check"); }

function handleBuybackResponse(decision) {
  const modal = document.getElementById("buyback-modal");
  const offerId = modal.getAttribute("data-offer-id");
  if (!offerId) return;

  socket.emit("buyback:respond", { offerId, decision });
  modal.style.display = "none";
}

function renderDashboard(state) {
  // Optional: Render a "Viewer" mode for non-logged in users
  const display = document.getElementById("auction-display");
  if (display && state.auction && state.auction.isActive) {
    display.style.display = "block";
    // Logic to show generic auction info could go here
  }
}
// --- Trade Offer Socket Events ---

socket.on("trade:incoming", (offer) => {
  showTradeModal(offer);
});

socket.on("trade:sent", ({ offer }) => {
  // Optimistic: state update will follow
});

socket.on("trade:error", ({ message }) => {
  // Show in whichever form is active
  const errEl = document.getElementById(
    currentTradeType === "money" ? "trade-money-error" : "trade-swap-error"
  );
  if (errEl) { errEl.textContent = message; setTimeout(() => errEl.textContent = "", 4000); }
});

// --- Trade UI Logic ---

function selectTradeType(type) {
  currentTradeType = type;
  document.getElementById("trade-form-money").style.display = type === "money" ? "block" : "none";
  document.getElementById("trade-form-swap").style.display = type === "swap" ? "block" : "none";
  document.getElementById("trade-type-money-btn").classList.toggle("active", type === "money");
  document.getElementById("trade-type-swap-btn").classList.toggle("active", type === "swap");
}

function populateTeamDropdowns(state) {
  if (!state) return;
  const myId = state.team.id;
  const teams = state.teams.filter(t => t.id !== myId);

  ["trade-money-team", "trade-swap-team"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Choose a team --</option>';
    teams.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.username} (${t.farm.length} animals)`;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  });

  // Populate my animals for swap
  populateMyAnimals(state);
}

function populateMyAnimals(state) {
  const sel = document.getElementById("trade-swap-my-animal");
  if (!sel || !state) return;
  sel.innerHTML = state.team.farm.length === 0
    ? '<option value="">-- You have no animals --</option>'
    : '';
  state.team.farm.forEach(a => {
    const animal = getAnimalData(a.type);
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${animal.displayName} (${animal.baseValue} pts)`;
    sel.appendChild(opt);
  });
}

function loadTeamAnimals(formType) {
  const teamId = document.getElementById(
    formType === "money" ? "trade-money-team" : "trade-swap-team"
  ).value;

  const animalSelId = formType === "money" ? "trade-money-animal" : "trade-swap-their-animal";
  const animalSel = document.getElementById(animalSelId);
  if (!animalSel) return;

  if (!teamId || !currentState) {
    animalSel.innerHTML = '<option value="">-- Select a team first --</option>';
    return;
  }

  const team = currentState.teams.find(t => t.id === teamId);
  if (!team || team.farm.length === 0) {
    animalSel.innerHTML = '<option value="">-- This team has no animals --</option>';
    return;
  }

  animalSel.innerHTML = '';
  team.farm.forEach(a => {
    const animal = getAnimalData(a.type);
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${animal.displayName} (${animal.baseValue} pts)`;
    animalSel.appendChild(opt);
  });
}

function sendMoneyOffer() {
  const toTeamId = document.getElementById("trade-money-team").value;
  const requestedAnimalId = document.getElementById("trade-money-animal").value;
  const offeredPrice = Number(document.getElementById("trade-money-price").value);
  const errEl = document.getElementById("trade-money-error");

  if (!toTeamId) { errEl.textContent = "Please select a team."; return; }
  if (!requestedAnimalId) { errEl.textContent = "Please select an animal."; return; }
  if (!offeredPrice || offeredPrice <= 0) { errEl.textContent = "Please enter a valid offer price."; return; }

  socket.emit("trade:offer:money", { toTeamId, requestedAnimalId, offeredPrice });
  errEl.textContent = "";
  document.getElementById("trade-money-price").value = "";
}

function sendSwapOffer() {
  const toTeamId = document.getElementById("trade-swap-team").value;
  const offeredAnimalId = document.getElementById("trade-swap-my-animal").value;
  const requestedAnimalId = document.getElementById("trade-swap-their-animal").value;
  const errEl = document.getElementById("trade-swap-error");

  if (!toTeamId) { errEl.textContent = "Please select a team."; return; }
  if (!offeredAnimalId) { errEl.textContent = "Please select an animal to offer."; return; }
  if (!requestedAnimalId) { errEl.textContent = "Please select an animal to request."; return; }

  socket.emit("trade:offer:swap", { toTeamId, offeredAnimalId, requestedAnimalId });
  errEl.textContent = "";
}

function showTradeModal(offer) {
  activeTradeOffer = offer;
  const modal = document.getElementById("trade-modal");
  const body = document.getElementById("trade-modal-body");
  const title = document.getElementById("trade-modal-title");

  const fromTeam = currentState ? currentState.teams.find(t => t.id === offer.fromTeamId) : null;
  const fromName = fromTeam ? fromTeam.username : "Another Team";

  if (offer.type === "money") {
    const animal = getAnimalData(offer.requestedAnimalType);
    title.textContent = "💰 Money Offer!";
    body.innerHTML = `
      <p><strong style="color:var(--gold-primary);">${fromName}</strong> wants to buy your:</p>
      <p style="font-size:1.3rem;margin:10px 0;"><strong>${animal.displayName}</strong></p>
      <p>Their offer: <strong style="color:var(--money-color);font-size:1.4rem;">$${offer.offeredPrice}</strong></p>
    `;
  } else {
    const theirAnimal = getAnimalData(offer.offeredAnimalType);
    const yourAnimal = getAnimalData(offer.requestedAnimalType);
    title.textContent = "🔄 Swap Offer!";
    body.innerHTML = `
      <p><strong style="color:var(--gold-primary);">${fromName}</strong> wants to swap:</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:14px 0;">
        <div style="text-align:center;">
          <div style="font-size:1.1rem;font-weight:700;">${theirAnimal.displayName}</div>
          <div style="font-size:0.85rem;opacity:0.7;">They give you</div>
        </div>
        <div style="font-size:1.5rem;">⇄</div>
        <div style="text-align:center;">
          <div style="font-size:1.1rem;font-weight:700;">${yourAnimal.displayName}</div>
          <div style="font-size:0.85rem;opacity:0.7;">You give them</div>
        </div>
      </div>
    `;
  }

  modal.style.display = "flex";
}

function respondToTrade(accept) {
  if (!activeTradeOffer) return;
  socket.emit("trade:respond", { offerId: activeTradeOffer.id, accept });
  document.getElementById("trade-modal").style.display = "none";
  activeTradeOffer = null;
}

function renderOutgoingOffers(offers, allTeams) {
  const container = document.getElementById("outgoing-offers-list");
  if (!container) return;

  if (!offers || offers.length === 0) {
    container.innerHTML = '<p class="muted">No pending sent offers.</p>';
    return;
  }

  container.innerHTML = "";
  offers.forEach(offer => {
    const toTeam = allTeams ? allTeams.find(t => t.id === offer.toTeamId) : null;
    const toName = toTeam ? toTeam.username : "Unknown Team";

    let detail = "";
    if (offer.type === "money") {
      const animal = getAnimalData(offer.requestedAnimalType);
      detail = `Buy <strong>${animal.displayName}</strong> from ${toName} for <strong style="color:var(--money-color);">$${offer.offeredPrice}</strong>`;
    } else {
      const mine = getAnimalData(offer.offeredAnimalType);
      const theirs = getAnimalData(offer.requestedAnimalType);
      detail = `Swap your <strong>${mine.displayName}</strong> for ${toName}'s <strong>${theirs.displayName}</strong>`;
    }

    const div = document.createElement("div");
    div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:8px;gap:10px;";
    div.innerHTML = `
      <span style="flex:1;font-size:0.9rem;">${detail}</span>
      <button onclick="cancelTradeOffer('${offer.id}')" style="padding:6px 12px;font-size:0.8rem;background:rgba(231,76,60,0.3);border:1px solid rgba(231,76,60,0.5);color:#e74c3c;border-radius:6px;cursor:pointer;white-space:nowrap;">Cancel</button>
    `;
    container.appendChild(div);
  });
}

function cancelTradeOffer(offerId) {
  socket.emit("trade:cancel", { offerId });
}

function showError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.color = "red"; }