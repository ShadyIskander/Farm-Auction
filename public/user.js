const socket = io();

// STATE & CREDENTIALS
let currentTeamId = null;
let currentState = null;
let switchChoiceData = null;
let activeCredentials = null;
let activeTradeOffer = null;
let currentTradeType = "money";
let selectedTradeTargetTeamId = null;
let selectedRequestedAnimalId = null;
let selectedRequestedAnimalType = null;
let isAuctionActiveNow = false;
let selectedRequestedGadgetId = null;
let selectedRequestedGadgetType = null;
let selectedOfferedAnimalId = null;
let selectedOfferedAnimalType = null;
let selectedOfferedGadgetId = null;
let selectedOfferedGadgetType = null;

window.__faBlockedTimer = window.__faBlockedTimer || null;

// --- CONNECTION STABILITY ---

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
  updateConnectionStatus("Connected", "green");
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

window.addEventListener("load", () => {
  const savedU = sessionStorage.getItem("fa_u");
  const savedP = sessionStorage.getItem("fa_p");
  if (savedU && savedP) {
    console.log("Found credentials in storage, auto-logging in...");
    activeCredentials = { username: savedU, password: savedP };
    const loginScreen = document.getElementById("login-screen");
    const mainInterface = document.getElementById("main-interface");
    if (loginScreen) loginScreen.style.display = "none";
    if (mainInterface) mainInterface.style.display = "block";
    socket.emit("team:login", activeCredentials);
  }
});

// --- Image & Data Helpers ---

function getAnimalImage(type) {
  const images = {
    cow: '/images/cow.jpg',
    bull: '/images/bull.webp',
    goat: '/images/sheep.jpeg',
    sheep: '/images/Ram.webp',
    chicken: '/images/chicken.jpg',
    rooster: '/images/rooster.jpg',
    doe: '/images/doe.jpg',
    buck: '/images/Buck.jpg',
    cat: '/images/cat.jpg',
    dog: '/images/dog.jpg'
  };
  return images[type] || 'images/mystery.jpg';
}

function getGadgetImage(type) {
  const images = {
    cow_milker: "/images/gadgets/cow_milker.png",
    bull_harness: "/images/gadgets/bull_harness.png",
    goat_bell: "/images/gadgets/goat_bell.png",
    sheep_shears: "/images/gadgets/sheep_shears.png",
    chicken_nest: "/images/gadgets/chicken_nest.png",
    rooster_whistle: "/images/gadgets/rooster_whistle.png",
    doe_saltlick: "/images/gadgets/doe_saltlick.png",
    buck_antler_oil: "/images/gadgets/buck_antler_oil.png",
    cat_yarnball: "/images/gadgets/cat_yarnball.png",
    dog_treats: "/images/gadgets/dog_treats.png",
  };
  return images[type] || "/images/gadgets/placeholder.png";
}

function getGadgetData(type) {
  const map = {
    cow_milker:      { name: "Cow Milker",        emoji: "🪣", boosts: "Cow" },
    bull_harness:    { name: "Bull Harness",       emoji: "🧰", boosts: "Bull" },
    goat_bell:       { name: "Sheep Bell",         emoji: "🔔", boosts: "Sheep" },
    sheep_shears:    { name: "Ram Shears",         emoji: "✂️", boosts: "Ram" },
    chicken_nest:    { name: "Chicken Nest",       emoji: "🪺", boosts: "Chicken" },
    rooster_whistle: { name: "Rooster Whistle",    emoji: "📯", boosts: "Rooster" },
    doe_saltlick:    { name: "Doe Salt Lick",      emoji: "🧂", boosts: "Doe" },
    buck_antler_oil: { name: "Buck Serum Oil",     emoji: "🧴", boosts: "Buck" },
    cat_yarnball:    { name: "Cat Silk Yarn Ball", emoji: "🧶", boosts: "Cat" },
    dog_treats:      { name: "Dog Treats",         emoji: "🦴", boosts: "Dog" },
  };
  return map[type] || { name: String(type), emoji: "🧩", boosts: "?" };
}

function getAnimalData(type) {
  const animals = {
    cow:     { type: "cow",     gender: "female", baseValue: 10, displayName: "Cow" },
    bull:    { type: "bull",    gender: "male",   baseValue: 15, displayName: "Bull" },
    goat:    { type: "goat",    gender: "female", baseValue: 5,  displayName: "Sheep" },
    sheep:   { type: "sheep",   gender: "male",   baseValue: 10, displayName: "Merino Sheep" },
    chicken: { type: "chicken", gender: "female", baseValue: 3,  displayName: "Rhode Island Red" },
    rooster: { type: "rooster", gender: "male",   baseValue: 5,  displayName: "Rooster" },
    doe:     { type: "doe",     gender: "female", baseValue: 8,  displayName: "Doe" },
    buck:    { type: "buck",    gender: "male",   baseValue: 12, displayName: "Buck" },
    cat:     { type: "cat",     gender: "female", baseValue: 4,  displayName: "Cat" },
    dog:     { type: "dog",     gender: "male",   baseValue: 6,  displayName: "Dog" },
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
  sessionStorage.removeItem("fa_u");
  sessionStorage.removeItem("fa_p");
  window.location.href = "/index.html";
});

socket.on("user:state", (state) => {
  console.log("Full User State Received", state);
  if (currentState && currentState.auction && state.auction &&
      currentState.auction.id === state.auction.id) {
    state.auction._revealedAnimalTypes = currentState.auction._revealedAnimalTypes;
    state.auction._revealedGadgetTypes = currentState.auction._revealedGadgetTypes;
    state.auction._isBundle = currentState.auction._isBundle;
  }
  currentState = state;
  renderState(state);
  if (selectedTradeTargetTeamId) {
    renderTradeTargetAssets();
  }
});

socket.on("state:update", (publicState) => {
  if (!currentState || !currentState.team) {
    renderDashboard(publicState);
  }
});

socket.on("auction:started", () => {
  socket.emit("state:request");
  switchTab("bidding");
});

socket.on("auction:ended", ({ winnerId, animalType }) => {
  if (winnerId === currentTeamId) {
    setTimeout(() => checkSwitchChoice(), 500);
  }
  document.getElementById("auction-display").style.display = "none";
  document.getElementById("auction-status").innerHTML = '<p class="muted">Auction Ended. Waiting for next round...</p>';
});

// Unified reveal — handles single animal, single gadget, and mixed bundles
function handleBundleRevealUser({ animalTypes, gadgetTypes, isBundle }) {
  if (!currentState || !currentState.auction) return;
  const animals = animalTypes || [];
  const gadgets = gadgetTypes || [];
  const totalItems = animals.length + gadgets.length;
  currentState.auction._revealedAnimalTypes = animals;
  currentState.auction._revealedGadgetTypes = gadgets;
  currentState.auction._isBundle = isBundle || totalItems > 1;
  if (animals.length > 0) currentState.auction.animalType = animals[0];
  if (gadgets.length > 0) currentState.auction.gadgetType = gadgets[0];
  renderState(currentState);
}

socket.on("auction:bundle:revealed", handleBundleRevealUser);
socket.on("auction:animal:revealed", ({ animalType, animalTypes }) => {
  handleBundleRevealUser({ animalTypes: animalTypes || (animalType ? [animalType] : []), gadgetTypes: [], isBundle: false });
});
socket.on("auction:gadget:revealed", ({ gadgetType, gadgetTypes }) => {
  handleBundleRevealUser({ animalTypes: [], gadgetTypes: gadgetTypes || (gadgetType ? [gadgetType] : []), isBundle: false });
});

// --- SWITCH FIX: robust handling for animal↔gadget swaps ---
socket.on("switch:pending", (offer) => {
  console.log("Switch pending:", offer);
  const modal = document.getElementById("switch-modal");
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const optionsDiv = modal.querySelector(".switch-options");
  if (!optionsDiv) return;

  // Determine original item type and name
  let originalType = offer.itemCategory; // "animal" or "gadget"
  let originalName = "";
  let originalEmoji = "";
  let switchTargetType = null;
  let switchTargetName = "";
  let switchTargetEmoji = "";

  if (originalType === "gadget" && offer.originalGadget) {
    const gadget = getGadgetData(String(offer.originalGadget).toLowerCase().trim());
    originalName = gadget.name;
    originalEmoji = gadget.emoji;
    // If switch target is provided (e.g., for known swap), use it
    if (offer.switchTargetGadget) {
      const target = getGadgetData(String(offer.switchTargetGadget).toLowerCase().trim());
      switchTargetType = "gadget";
      switchTargetName = target.name;
      switchTargetEmoji = target.emoji;
    }
  } else if (originalType === "animal" && offer.originalAnimal) {
    const animal = getAnimalData(String(offer.originalAnimal).toLowerCase().trim());
    originalName = animal.displayName;
    originalEmoji = animal.gender === "female" ? "🐮" : "🐂"; // simple fallback
    if (offer.switchTargetAnimal) {
      const target = getAnimalData(String(offer.switchTargetAnimal).toLowerCase().trim());
      switchTargetType = "animal";
      switchTargetName = target.displayName;
      switchTargetEmoji = target.gender === "female" ? "🐮" : "🐂";
    } else if (offer.switchTargetGadget) {
      const target = getGadgetData(String(offer.switchTargetGadget).toLowerCase().trim());
      switchTargetType = "gadget";
      switchTargetName = target.name;
      switchTargetEmoji = target.emoji;
    }
  } else {
    // Fallback: detect from presence of fields
    if (offer.originalAnimal) {
      const animal = getAnimalData(String(offer.originalAnimal).toLowerCase().trim());
      originalName = animal.displayName;
      originalEmoji = "";
      originalType = "animal";
    } else if (offer.originalGadget) {
      const gadget = getGadgetData(String(offer.originalGadget).toLowerCase().trim());
      originalName = gadget.name;
      originalEmoji = gadget.emoji;
      originalType = "gadget";
    }
    if (offer.switchTargetAnimal) {
      const target = getAnimalData(String(offer.switchTargetAnimal).toLowerCase().trim());
      switchTargetType = "animal";
      switchTargetName = target.displayName;
    } else if (offer.switchTargetGadget) {
      const target = getGadgetData(String(offer.switchTargetGadget).toLowerCase().trim());
      switchTargetType = "gadget";
      switchTargetName = target.name;
      switchTargetEmoji = target.emoji;
    }
  }

  // Build modal text
  if (originalType === "gadget") {
    setTxt("switch-animal-name", originalName + " (Gadget)");
  } else {
    setTxt("switch-animal-name", originalName);
  }

  // Prepare buttons
  let acceptButtonText = (originalType === "gadget") ? `Keep ${originalEmoji} ${originalName}` : `Keep ${originalName}`;
let switchButtonText = "Switch to Mystery Animal or Gadget";

optionsDiv.innerHTML = `
  <button class='btn-accept' onclick="handleSwitchChoice('accept')">${acceptButtonText}</button>
  <button class='btn-switch' onclick="handleSwitchChoice('switch')">${switchButtonText}</button>
`;

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

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("farm-value", team.farmValue);
    setText("current-balance", "$" + team.balance);
    setText("animal-count", team.farm.length);
    setText("pair-count", countPairs(team.farm));
    setText("player-balance", "$" + team.balance);
    setText("player-locked", "$" + team.lockedBid);

    renderFarm(team.farm);
    renderGadgets(team.gadgets || []);

    populateUnifiedTradeTeams(state);
    renderOutgoingOffers(state.outgoingTradeOffers || [], state.teams);

    if (state.incomingTradeOffers && state.incomingTradeOffers.length > 0 && !activeTradeOffer) {
      const modal = document.getElementById("trade-modal");
      if (modal && modal.style.display === "none") {
        showTradeModal(state.incomingTradeOffers[0]);
      }
    }

    const auctionDisplay = document.getElementById("auction-display");
    const iconContainer = document.getElementById("animal-icon");

    if (auction && auction.isActive) {
      if (auctionDisplay) auctionDisplay.style.display = "block";
      const statusEl = document.getElementById("auction-status");
      if (statusEl) statusEl.innerHTML = '<p class="success">Auction Active</p>';

      const _revealedAnimals = auction._revealedAnimalTypes?.length || 0;
      const _revealedGadgets = auction._revealedGadgetTypes?.length || 0;
      const _totalRevealedItems = _revealedAnimals + _revealedGadgets;
      const _isBlindBundle = (auction.bundleCount != null && auction.bundleCount > 1);
      const _isRevealed = _totalRevealedItems > 1 || auction._isBundle;

      if (_isBlindBundle && !_isRevealed) {
        if (iconContainer) iconContainer.innerHTML = "<div style='font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%;'>🎁</div>";
        setText("animal-name", "Mystery Bundle");
        setText("animal-value", "Hidden until reveal");
      } else if (_isRevealed) {
        const totalItems = auction.bundleCount || Math.max(_totalRevealedItems, 2);
        if (iconContainer) {
          iconContainer.innerHTML = "";
          const img = document.createElement("img");
          img.src = "/images/super.png";
          img.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:12px;";
          img.onerror = function() { iconContainer.innerHTML = "<div style='font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%;'>🎁</div>"; };
          iconContainer.appendChild(img);
        }
        setText("animal-name", "🎁 Super Bundle x" + totalItems);
        setText("animal-value", "Bundle of " + totalItems + " items");
      } else if (auction.itemCategory === "gadget" && auction.gadgetType) {
        const gd = getGadgetData(String(auction.gadgetType || "").toLowerCase().trim());
        const img = getGadgetImage(String(auction.gadgetType || "").toLowerCase().trim());
        if (iconContainer) {
          iconContainer.innerHTML = "";
          const gadgetImg = document.createElement("img");
          gadgetImg.src = img;
          gadgetImg.style = "width:100%; height:100%; object-fit:cover; border-radius:12px;";
          gadgetImg.onerror = function () {
            iconContainer.innerHTML = "<div style='font-size:3rem;display:flex;align-items:center;justify-content:center;height:100%;'>" + gd.emoji + "</div>";
          };
          iconContainer.appendChild(gadgetImg);
        }
        setText("animal-name", gd.emoji + " " + gd.name);
        setText("animal-value", "Gadget — doubles " + gd.boosts + " pts (no base points)");
      } else if (auction.animalType) {
        const type = String(auction.animalType).toLowerCase().trim();
        const animal = getAnimalData(type);
        const img = getAnimalImage(type);
        if (iconContainer) iconContainer.innerHTML = "<img src='" + img + "' style='width:100%; height:100%; object-fit:cover; border-radius:12px;'>";
        setText("animal-name", animal.displayName);
        setText("animal-value", "Base Value: " + animal.baseValue + " Points");
      } else {
        if (iconContainer) iconContainer.innerHTML = "<div style='font-size: 3rem; display: flex; align-items: center; justify-content: center; height:100%;'>🎁</div>";
        setText("animal-name", "Mystery Animal or Gadget");
        setText("animal-value", "Hidden until reveal");
      }

      setText("current-price", "$" + auction.currentPrice);
      const highestBidder = state.teams.find((t) => t.id === auction.highestBidderId);
      setText("highest-bidder", highestBidder ? highestBidder.username : "—");
      const minBid = auction.currentPrice + 1;
      setText("min-bid-hint", "Minimum bid: $" + minBid);
      const bidInput = document.getElementById("bid-amount");
      if (bidInput) bidInput.min = minBid;

    } else {
      if (auctionDisplay) auctionDisplay.style.display = "none";
    }

    renderBidHistory(state.bidHistory || [], state.teams);
    updateTradeAvailability(!!(state.auction && state.auction.isActive));
  } catch (e) {
    console.error("Render Error:", e);
  }
}

function updateTradeAvailability(isAuctionActive) {
  const tradeTabBtn = document.getElementById("tab-trade");
  const tradeTab = document.getElementById("tab-content-trade");
  if (!tradeTabBtn || !tradeTab) return;

  isAuctionActiveNow = !!isAuctionActive;

  const banner = document.getElementById("trade-auction-banner");
  const sendBtn = document.getElementById("trade-send-btn");
  const teamSel = document.getElementById("trade-team-select");
  const cashAmt = document.getElementById("trade-cash-amount");
  const myItemSel = document.getElementById("trade-swap-my-item");
  const cashRadio = document.getElementById("trade-payment-cash");
  const swapRadio = document.getElementById("trade-payment-swap");

  if (isAuctionActive) {
    tradeTabBtn.style.opacity = "0.45";
    tradeTabBtn.style.pointerEvents = "auto";
    tradeTabBtn.title = "Make Offers is only available between auctions.";
    tradeTabBtn.dataset.disabledByAuction = "true";
    if (banner) banner.style.display = "block";
    [sendBtn, teamSel, cashAmt, myItemSel, cashRadio, swapRadio].forEach((el) => {
      if (el) el.disabled = true;
    });
  } else {
    tradeTabBtn.style.opacity = "1";
    tradeTabBtn.style.pointerEvents = "auto";
    tradeTabBtn.title = "";
    tradeTabBtn.dataset.disabledByAuction = "false";
    if (banner) banner.style.display = "none";
    [sendBtn, teamSel, cashAmt, myItemSel, cashRadio, swapRadio].forEach((el) => {
      if (el) el.disabled = false;
    });
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
    const t = String(a.type).toLowerCase().trim();
    animalsByType[t] = (animalsByType[t] || 0) + 1;
  });
  const pairs = getPairStatus(animalsByType);

  farmDisplay.innerHTML = "";
  Object.entries(animalsByType).forEach(([type, count]) => {
    const animal = getAnimalData(type);
    const hasPair = pairs.has(type);
    const stall = document.createElement("div");
    stall.className = "stall " + (hasPair ? "has-pair" : "");
    stall.innerHTML =
      "<div class='animal-icon'>" +
        "<img src='" + getAnimalImage(type) + "' alt='" + type + "' style='width:100%; height:100%; object-fit:cover;'>" +
      "</div>" +
      "<div class='stall-count'>" + count + "</div>" +
      "<div class='stall-info'>" +
        "<div class='stall-name'>" + animal.displayName + "</div>" +
        "<div class='stall-gender'>" + (animal.gender === "female" ? "♀" : "♂") + " | " + animal.baseValue + " Points</div>" +
        (hasPair ? "<div class='pair-badge'>✓ Complete Pair</div>" : "") +
      "</div>";
    farmDisplay.appendChild(stall);
  });
}

function renderGadgets(gadgets) {
  const gadgetDisplay = document.getElementById("gadget-display");
  const empty = document.getElementById("empty-gadgets");
  if (!gadgetDisplay) return;

  if (!gadgets || gadgets.length === 0) {
    if (empty) empty.style.display = "block";
    gadgetDisplay.innerHTML = empty
      ? empty.outerHTML
      : "<p class='muted' style='grid-column: 1/-1; text-align: center; padding: 40px;'>You don't own any gadgets yet.</p>";
    return;
  }

  if (empty) empty.style.display = "none";

  const counts = {};
  gadgets.forEach(g => {
    const t = String(g.type || "").toLowerCase().trim();
    if (t) counts[t] = (counts[t] || 0) + 1;
  });

  gadgetDisplay.innerHTML = "";
  Object.entries(counts).forEach(([type, count]) => {
    const gd = getGadgetData(type);
    const img = getGadgetImage(type);
    const stall = document.createElement("div");
    stall.className = "stall";
    stall.innerHTML =
      "<div class='animal-icon'>" +
        "<img src='" + img + "' alt='" + type + "' style='width:100%; height:100%; object-fit:cover;'>" +
      "</div>" +
      "<div class='stall-count'>" + count + "</div>" +
      "<div class='stall-info'>" +
        "<div class='stall-name'>" + gd.name + "</div>" +
        "<div class='stall-gender' style='opacity:0.8;'>Doubles " + gd.boosts + " pts</div>" +
      "</div>";
    const imgel = stall.querySelector("img");
    imgel.addEventListener("error", () => {
      const icon = stall.querySelector(".animal-icon");
      if (icon) icon.innerHTML = "<div style='font-size: 2rem; display:flex; align-items:center; justify-content:center; height:100%;'>" + gd.emoji + "</div>";
    });
    gadgetDisplay.appendChild(stall);
  });
}

// --- Logic Helpers ---

function switchTab(tab) {
  if (tab === "trade" && isAuctionActiveNow) {
    const blocked = document.getElementById("tab-blocked-banner");
    if (blocked) {
      blocked.style.display = "block";
      clearTimeout(window.__faBlockedTimer);
      window.__faBlockedTimer = setTimeout(() => { blocked.style.display = "none"; }, 3500);
    }
    return;
  } else {
    const blocked = document.getElementById("tab-blocked-banner");
    if (blocked) blocked.style.display = "none";
  }
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-content-" + tab).classList.add("active");
  document.getElementById("tab-" + tab).classList.add("active");
}

function countPairs(farm) {
  const counts = {};
  farm.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
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
    if (counts[p.m] > 0 && counts[p.f] > 0) { active.add(p.m); active.add(p.f); }
  });
  return active;
}

function renderBidHistory(history, teams) {
  const list = document.getElementById("bid-history");
  if (!list) return;
  list.innerHTML = history.length ? "" : "<li class='muted'>No bids yet</li>";
  [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10).forEach(bid => {
    const team = teams.find(t => t.id === bid.teamId);
    const li = document.createElement("li");
    li.innerHTML = "<span>" + (team ? team.username : "Unknown") + "</span><span>$" + bid.amount + "</span>";
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

// --- Modals ---
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
  const display = document.getElementById("auction-display");
  if (display && state.auction && state.auction.isActive) {
    display.style.display = "block";
  }
}

// --- Trade Offer Socket Events ---

socket.on("trade:incoming", (offer) => { showTradeModal(offer); });
socket.on("trade:sent", ({ offer }) => {});
socket.on("trade:error", ({ message }) => {
  const errEl = document.getElementById("trade-unified-error");
  if (errEl) { errEl.textContent = message; setTimeout(() => errEl.textContent = "", 4000); }
});
socket.on("trade:resolved", ({ offerId, status }) => {
  if (activeTradeOffer && activeTradeOffer.id === offerId) {
    const modal = document.getElementById("trade-modal");
    if (modal) modal.style.display = "none";
    activeTradeOffer = null;
  }
});

// --- Trade UI Logic ---

function populateUnifiedTradeTeams(state) {
  if (!state) return;
  const sel = document.getElementById("trade-team-select");
  if (!sel) return;

  const myId = state.team.id;
  const teams = state.teams.filter(t => t.id !== myId);

  const prev = sel.value;
  sel.innerHTML = "<option value=''>-- Choose a team --</option>";
  teams.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.username + " (" + t.farm.length + " animals, " + (t.gadgets || []).length + " gadgets)";
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;

  populateMyItems(state);

  if (!sel.dataset.bound) {
    sel.dataset.bound = "true";
    sel.addEventListener("change", () => {
      selectedTradeTargetTeamId = sel.value || null;
      selectedRequestedAnimalId = null;
      selectedRequestedAnimalType = null;
      selectedRequestedGadgetId = null;
      selectedRequestedGadgetType = null;
      renderTradeTargetAssets();
    });
  }

  const cashRadio = document.getElementById("trade-payment-cash");
  const swapRadio = document.getElementById("trade-payment-swap");
  const cashPanel = document.getElementById("trade-payment-cash-panel");
  const swapPanel = document.getElementById("trade-payment-swap-panel");
  if (cashRadio && swapRadio && cashPanel && swapPanel && !cashRadio.dataset.bound) {
    cashRadio.dataset.bound = "true";
    const toggle = () => {
      const isCash = cashRadio.checked;
      cashPanel.style.display = isCash ? "block" : "none";
      swapPanel.style.display = isCash ? "none" : "block";
      const errEl = document.getElementById("trade-unified-error");
      if (errEl) errEl.textContent = "";
    };
    cashRadio.addEventListener("change", toggle);
    swapRadio.addEventListener("change", toggle);
    toggle();
  }

  if (sel.value) {
    selectedTradeTargetTeamId = sel.value;
    renderTradeTargetAssets();
  } else {
    const container = document.getElementById("trade-team-assets");
    if (container) container.innerHTML = "<p class='muted'>Choose a team to see their animals and gadgets.</p>";
  }
}

function populateMyItems(state) {
  const sel = document.getElementById("trade-swap-my-item");
  if (!sel || !state) return;

  const myAnimals = state.team.farm || [];
  const myGadgets = state.team.gadgets || [];

  sel.innerHTML = "";

  if (myAnimals.length === 0 && myGadgets.length === 0) {
    sel.innerHTML = "<option value=''>-- You have nothing to offer --</option>";
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Choose what you're giving --";
  sel.appendChild(placeholder);

  if (myAnimals.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Your Animals:";
    myAnimals.forEach(a => {
      const animal = getAnimalData(String(a.type || "").toLowerCase().trim());
      const opt = document.createElement("option");
      opt.value = "animal:" + a.id;
      opt.textContent = animal.displayName + " (" + animal.baseValue + " pts)";
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }

  if (myGadgets.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Your Gadgets:";
    myGadgets.forEach(g => {
      const normalizedType = String(g.type || "").toLowerCase().trim();
      const gd = getGadgetData(normalizedType);
      const opt = document.createElement("option");
      opt.value = "gadget:" + g.id;
      opt.textContent = gd.emoji + " " + gd.name + " (Gadget)";
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }
}

function renderTradeTargetAssets() {
  const container = document.getElementById("trade-team-assets");
  if (!container) return;

  if (!selectedTradeTargetTeamId) {
    container.innerHTML = "<p class='muted'>Choose a team to see their animals and gadgets.</p>";
    return;
  }

  const state = currentState;
  if (!state || !state.teams) {
    container.innerHTML = "<p class='muted'>Loading team assets...</p>";
    return;
  }

  const team = state.teams.find(t => t.id === selectedTradeTargetTeamId);
  if (!team) {
    container.innerHTML = "<p class='muted'>Team not found.</p>";
    return;
  }

  const animals = team.farm || [];
  const gadgets = team.gadgets || [];
  const selectedStyle = "outline:1px solid rgba(184,148,84,0.4); box-shadow: none; background:rgba(184,148,84,0.1);";

  let html = "<div style='margin-bottom:10px; opacity:0.85;'>Pick what you want from <strong>" + team.username + "</strong>:</div>";
  html += "<div style='display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:12px;'>";

  animals.forEach(a => {
    const type = String(a.type || "").toLowerCase().trim();
    const img = getAnimalImage(type);
    const animal = getAnimalData(type);
    const isSel = selectedRequestedAnimalId === a.id;
    html += "<div class='card' data-animal-id='" + a.id + "' style='padding:10px; cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); " + (isSel ? selectedStyle : "") + "'>";
    html += "<div style='width:100%; height:80px; border-radius:10px; overflow:hidden; margin-bottom:8px; background:rgba(0,0,0,0.25);'>";
    html += "<img src='" + img + "' alt='" + type + "' style='width:100%; height:100%; object-fit:cover;'></div>";
    html += "<div style='font-weight:800; font-size:0.95rem;'>" + animal.displayName + "</div>";
    html += "<div style='opacity:0.75; font-size:0.8rem;'>" + animal.baseValue + " pts</div></div>";
  });

  gadgets.forEach(g => {
    const normalizedType = String(g.type || "").toLowerCase().trim();
    const gd = getGadgetData(normalizedType);
    const img = getGadgetImage(normalizedType);
    const isSel = selectedRequestedGadgetId === g.id;
    html += "<div class='card' data-gadget-id='" + g.id + "' style='padding:10px; cursor:pointer; background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.12); opacity:0.9; " + (isSel ? selectedStyle : "") + "'>";
    html += "<div style='width:100%; height:80px; border-radius:10px; overflow:hidden; margin-bottom:8px; background:rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;'>";
    html += "<img src='" + img + "' alt='" + normalizedType + "' style='width:100%; height:100%; object-fit:cover;'></div>";
    html += "<div style='font-weight:800; font-size:0.95rem;'>" + gd.name + "</div>";
    html += "<div style='opacity:0.75; font-size:0.75rem;'>Gadget • Doubles " + gd.boosts + "</div></div>";
  });

  html += "</div>";

  const selectedLabel = selectedRequestedAnimalType
    ? getAnimalData(selectedRequestedAnimalType).displayName
    : selectedRequestedGadgetType
      ? getGadgetData(selectedRequestedGadgetType).name + " (Gadget)"
      : "None";

  html += "<div style='margin-top:10px; opacity:0.8; font-size:0.85rem;'>Selected: <strong>" + selectedLabel + "</strong></div>";

  container.innerHTML = html;

  container.querySelectorAll("[data-animal-id]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-animal-id");
      const found = animals.find(x => x.id === id);
      if (!found) return;
      selectedRequestedAnimalId = found.id;
      selectedRequestedAnimalType = String(found.type || "").toLowerCase().trim();
      selectedRequestedGadgetId = null;
      selectedRequestedGadgetType = null;
      renderTradeTargetAssets();
    });
  });

  container.querySelectorAll("[data-gadget-id]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-gadget-id");
      const found = gadgets.find(x => x.id === id);
      if (!found) return;
      selectedRequestedGadgetId = found.id;
      selectedRequestedGadgetType = String(found.type || "").toLowerCase().trim();
      selectedRequestedAnimalId = null;
      selectedRequestedAnimalType = null;
      renderTradeTargetAssets();
    });
  });
}

function sendTradeOfferUnified() {
  const errEl = document.getElementById("trade-unified-error");
  const cashRadio = document.getElementById("trade-payment-cash");
  const toTeamId = selectedTradeTargetTeamId;

  if (document.getElementById("tab-trade") && document.getElementById("tab-trade").dataset.disabledByAuction === "true") {
    if (errEl) errEl.textContent = "Make Offers is only available between auctions.";
    return;
  }

  if (!toTeamId) { if (errEl) errEl.textContent = "Please select a team."; return; }
  if (!selectedRequestedAnimalId && !selectedRequestedGadgetId) {
    if (errEl) errEl.textContent = "Please select an animal or gadget from their assets.";
    return;
  }
  if (!cashRadio) { if (errEl) errEl.textContent = "Payment selector missing."; return; }

  if (cashRadio.checked) {
    const offeredPrice = Number(document.getElementById("trade-cash-amount") && document.getElementById("trade-cash-amount").value);
    if (!offeredPrice || offeredPrice <= 0) {
      if (errEl) errEl.textContent = "Please enter a valid cash amount.";
      return;
    }
    if (selectedRequestedGadgetId) {
      socket.emit("trade:offer:money:gadget", { toTeamId, requestedGadgetId: selectedRequestedGadgetId, offeredPrice });
    } else {
      socket.emit("trade:offer:money", { toTeamId, requestedAnimalId: selectedRequestedAnimalId, offeredPrice });
    }
    if (errEl) errEl.textContent = "";
    const amt = document.getElementById("trade-cash-amount");
    if (amt) amt.value = "";

  } else {
    const myItemSel = document.getElementById("trade-swap-my-item");
    if (!myItemSel || !myItemSel.value) {
      if (errEl) errEl.textContent = "Please select what you are giving.";
      return;
    }

    const parts = myItemSel.value.split(":");
    const itemType = parts[0];
    const itemId = parts[1];

    if (!itemId) {
      if (errEl) errEl.textContent = "Invalid selection. Please try again.";
      return;
    }

    const offeredAnimalId = itemType === "animal" ? itemId : null;
    const offeredGadgetId = itemType === "gadget" ? itemId : null;

    if (offeredAnimalId && selectedRequestedAnimalId) {
      socket.emit("trade:offer:swap", { toTeamId, offeredAnimalId, requestedAnimalId: selectedRequestedAnimalId });
    } else {
      socket.emit("trade:offer:swap:gadget", {
        toTeamId,
        offeredAnimalId: offeredAnimalId || null,
        offeredGadgetId: offeredGadgetId || null,
        requestedAnimalId: selectedRequestedAnimalId || null,
        requestedGadgetId: selectedRequestedGadgetId || null,
      });
    }
    if (errEl) errEl.textContent = "";
  }
}

function showTradeModal(offer) {
  activeTradeOffer = offer;
  const modal = document.getElementById("trade-modal");
  const body = document.getElementById("trade-modal-body");
  const title = document.getElementById("trade-modal-title");

  const fromTeam = currentState ? currentState.teams.find(t => t.id === offer.fromTeamId) : null;
  const fromName = fromTeam ? fromTeam.username : "Another Team";

  if (offer.type === "money") {
    title.textContent = "💰 Money Offer!";
    if (offer.itemCategory === "gadget") {
      const gd = getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim());
      body.innerHTML =
        "<p><strong style='color:var(--gold-primary);'>" + fromName + "</strong> wants to buy your:</p>" +
        "<p style='font-size:1.3rem;margin:10px 0;'><strong>" + gd.emoji + " " + gd.name + "</strong> <span style='opacity:0.7;font-size:0.9rem;'>(Gadget)</span></p>" +
        "<p>Their offer: <strong style='color:var(--money-color);font-size:1.4rem;'>$" + offer.offeredPrice + "</strong></p>";
    } else {
      const animal = getAnimalData(String(offer.requestedAnimalType || "").toLowerCase().trim());
      body.innerHTML =
        "<p><strong style='color:var(--gold-primary);'>" + fromName + "</strong> wants to buy your:</p>" +
        "<p style='font-size:1.3rem;margin:10px 0;'><strong>" + animal.displayName + "</strong></p>" +
        "<p>Their offer: <strong style='color:var(--money-color);font-size:1.4rem;'>$" + offer.offeredPrice + "</strong></p>";
    }
  } else {
    title.textContent = "🔄 Swap Offer!";
    const theyGive = offer.offeredGadgetType
      ? getGadgetData(String(offer.offeredGadgetType || "").toLowerCase().trim()).emoji + " " + getGadgetData(String(offer.offeredGadgetType || "").toLowerCase().trim()).name + " (Gadget)"
      : getAnimalData(String(offer.offeredAnimalType || "").toLowerCase().trim()).displayName;
    const youGive = offer.requestedGadgetType
      ? getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim()).emoji + " " + getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim()).name + " (Gadget)"
      : getAnimalData(String(offer.requestedAnimalType || "").toLowerCase().trim()).displayName;
    body.innerHTML =
      "<p><strong style='color:var(--gold-primary);'>" + fromName + "</strong> wants to swap:</p>" +
      "<div style='display:flex;align-items:center;justify-content:center;gap:16px;margin:14px 0;'>" +
        "<div style='text-align:center;'><div style='font-size:1.1rem;font-weight:700;'>" + theyGive + "</div><div style='font-size:0.85rem;opacity:0.7;'>They give you</div></div>" +
        "<div style='font-size:1.5rem;'>⇄</div>" +
        "<div style='text-align:center;'><div style='font-size:1.1rem;font-weight:700;'>" + youGive + "</div><div style='font-size:0.85rem;opacity:0.7;'>You give them</div></div>" +
      "</div>";
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
    container.innerHTML = "<p class='muted'>No pending sent offers.</p>";
    return;
  }

  container.innerHTML = "";
  offers.forEach(offer => {
    const toTeam = allTeams ? allTeams.find(t => t.id === offer.toTeamId) : null;
    const toName = toTeam ? toTeam.username : "Unknown Team";

    let detail = "";
    if (offer.type === "money") {
      if (offer.itemCategory === "gadget") {
        const gd = getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim());
        detail = "Buy <strong>" + gd.emoji + " " + gd.name + "</strong> (gadget) from " + toName + " for <strong style='color:var(--money-color);'>$" + offer.offeredPrice + "</strong>";
      } else {
        const animal = getAnimalData(String(offer.requestedAnimalType || "").toLowerCase().trim());
        detail = "Buy <strong>" + animal.displayName + "</strong> from " + toName + " for <strong style='color:var(--money-color);'>$" + offer.offeredPrice + "</strong>";
      }
    } else {
      const youGive = offer.offeredGadgetType
        ? getGadgetData(String(offer.offeredGadgetType || "").toLowerCase().trim()).emoji + " " + getGadgetData(String(offer.offeredGadgetType || "").toLowerCase().trim()).name + " (Gadget)"
        : getAnimalData(String(offer.offeredAnimalType || "").toLowerCase().trim()).displayName;
      const theyGive = offer.requestedGadgetType
        ? getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim()).emoji + " " + getGadgetData(String(offer.requestedGadgetType || "").toLowerCase().trim()).name + " (Gadget)"
        : getAnimalData(String(offer.requestedAnimalType || "").toLowerCase().trim()).displayName;
      detail = "Swap your <strong>" + youGive + "</strong> for " + toName + "'s <strong>" + theyGive + "</strong>";
    }

    const div = document.createElement("div");
    div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:8px;gap:10px;";
    div.innerHTML =
      "<span style='flex:1;font-size:0.9rem;'>" + detail + "</span>" +
      "<button onclick=\"cancelTradeOffer('" + offer.id + "')\" style='padding:6px 12px;font-size:0.8rem;background:rgba(231,76,60,0.3);border:1px solid rgba(231,76,60,0.5);color:#e74c3c;border-radius:6px;cursor:pointer;white-space:nowrap;'>Cancel</button>";
    container.appendChild(div);
  });
}

function cancelTradeOffer(offerId) {
  socket.emit("trade:cancel", { offerId });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.color = "red"; }
}

// Legacy stubs
function selectTradeType(type) { currentTradeType = type; }
function loadTeamAnimals(formType) {}
function sendMoneyOffer() {}
function sendSwapOffer() {}
function populateMyAnimals(state) { populateMyItems(state); }
function populateTeamDropdowns(state) { populateUnifiedTradeTeams(state); }