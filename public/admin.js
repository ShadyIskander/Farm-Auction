const socket = io();

// Auto-login using YOUR authentication system
window.addEventListener("load", () => {
  const savedU = sessionStorage.getItem("fa_u");
  const savedP = sessionStorage.getItem("fa_p");

  if (savedU === "admin" && savedP) {
    const adminLogin = document.getElementById("admin-login");
    const adminDashboard = document.getElementById("admin-dashboard");
    if (adminLogin) adminLogin.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";
    socket.emit("admin:login", { password: savedP });
  }

  socket.emit("state:request");
});

let adminState = null;
let selectedAnimal = null;
let selectedGadget = null;
// "animal" or "gadget" — tracks which tab the admin is on
let currentItemCategory = "animal";

// ─── Gadget data helpers ───────────────────────────────────────────────────

function getGadgetImage(type) {
  const images = {
    cow_milker:      "/images/gadgets/cow_milker.png",
    bull_harness:    "/images/gadgets/bull_harness.png",
    goat_bell:       "/images/gadgets/goat_bell.png",
    sheep_shears:    "/images/gadgets/sheep_shears.png",
    chicken_nest:    "/images/gadgets/chicken_nest.png",
    rooster_whistle: "/images/gadgets/rooster_whistle.png",
    doe_saltlick:    "/images/gadgets/doe_saltlick.png",
    buck_antler_oil: "/images/gadgets/buck_antler_oil.png",
    cat_yarnball:    "/images/gadgets/cat_yarnball.png",
    dog_treats:      "/images/gadgets/dog_treats.png",
  };
  return images[type] || "/images/gadgets/placeholder.png";
}

function getGadgetData(type) {
  const map = {
    cow_milker:      { name: "Cow Milker",      emoji: "🪣", boosts: "Cow" },
    bull_harness:    { name: "Bull Harness",    emoji: "🧰", boosts: "Bull",    basePrice: 16 },
    goat_bell:       { name: "Sheep Bell",       emoji: "🔔", boosts: "Sheep",    basePrice: 10 },
    sheep_shears:    { name: "Ram Shears",    emoji: "✂️", boosts: "Ram",   basePrice: 12 },
    chicken_nest:    { name: "Chicken Nest",    emoji: "🪺", boosts: "Chicken", basePrice: 8  },
    rooster_whistle: { name: "Rooster Compass", emoji: "📯", boosts: "Rooster", basePrice: 9  },
    doe_saltlick:    { name: "Doe Feeder",   emoji: "🧂", boosts: "Doe",     basePrice: 11 },
    buck_antler_oil: { name: "Buck Serum Oil", emoji: "🧴", boosts: "Buck",    basePrice: 13 },
    cat_yarnball:    { name: "Cat Silk Yarn Ball",  emoji: "🧶", boosts: "Cat",     basePrice: 9  },
    dog_treats:      { name: "Dog Treats",      emoji: "🦴", boosts: "Dog",     basePrice: 9  },
  };
  return map[type] || { name: String(type), emoji: "🧩", boosts: "?", basePrice: 0 };
}

// Full gadgets list for card grid
const gadgets = [
  { value: "cow_milker",      name: "Cow Milker",      boosts: "Cow",  image: "/images/gadgets/cow_milker.png",      emoji: "🪣" },
  { value: "bull_harness",    name: "Bull Harness",    boosts: "Bull",     image: "/images/gadgets/bull_harness.png",    emoji: "🧰" },
  { value: "goat_bell",       name: "Sheep Bell",       boosts: "Sheep",     image: "/images/gadgets/goat_bell.png",       emoji: "🔔" },
  { value: "sheep_shears",    name: "Ram Shears",    boosts: "Ram",    image: "/images/gadgets/sheep_shears.png",    emoji: "✂️" },
  { value: "chicken_nest",    name: "Chicken Nest",    boosts: "Chicken",   image: "/images/gadgets/chicken_nest.png",    emoji: "🪺" },
  { value: "rooster_whistle", name: "Rooster Compass", boosts: "Rooster",   image: "/images/gadgets/rooster_whistle.png", emoji: "📯" },
  { value: "doe_saltlick",    name: "Doe Feeder",   boosts: "Doe",      image: "/images/gadgets/doe_saltlick.png",    emoji: "🧂" },
  { value: "buck_antler_oil", name: "Buck Serum Oil", boosts: "Buck",     image: "/images/gadgets/buck_antler_oil.png", emoji: "🧴" },
  { value: "cat_yarnball",    name: "Cat Silk Yarn Ball",  boosts: "Cat",       image: "/images/gadgets/cat_yarnball.png",    emoji: "🧶" },
  { value: "dog_treats",      name: "Dog Treats",      boosts: "Dog",       image: "/images/gadgets/dog_treats.png",      emoji: "🦴" },
];

// ─── Login ─────────────────────────────────────────────────────────────────

const adminLoginForm = document.getElementById("admin-login-form");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value;
    socket.emit("admin:login", { password });
  });
}

// ─── Socket Events ─────────────────────────────────────────────────────────

socket.on("admin:login:success", ({ adminState: state }) => {
  adminState = state;
  const adminLogin = document.getElementById("admin-login");
  const adminDashboard = document.getElementById("admin-dashboard");
  if (adminLogin) adminLogin.style.display = "none";
  if (adminDashboard) adminDashboard.style.display = "block";
  renderAdminState(state);
});

socket.on("admin:login:error", ({ message }) => {
  const errorEl = document.getElementById("admin-login-error");
  if (errorEl) errorEl.textContent = message;
});

socket.on("admin:state", (state) => {
  adminState = state;
  renderAdminState(state);
});

socket.on("state:update", (state) => {
  if (adminState) {
    adminState = { ...adminState, ...state };
    renderAdminState(adminState);
  }
});

socket.on("admin:error", ({ message }) => {
  alert(`Admin Error: ${message}`);
});

socket.on("auction:started", () => {
  socket.emit("state:request");
});

socket.on("auction:ended", () => {
  socket.emit("state:request");
});

socket.on("auction:cancelled", () => {
  socket.emit("state:request");
});

// ─── Item category tab switcher ────────────────────────────────────────────

function switchItemTab(category) {
  currentItemCategory = category;
  selectedAnimal = null;
  selectedGadget = null;

  const animalTab = document.getElementById("item-tab-animal");
  const gadgetTab = document.getElementById("item-tab-gadget");
  const animalsSection = document.getElementById("animals-section");
  const gadgetsSection = document.getElementById("gadgets-section");
  const auctionTypeRow = document.getElementById("auction-type-row");
  const switchWrapper = document.getElementById("switch-target-wrapper");

  if (animalTab) animalTab.classList.toggle("active", category === "animal");
  if (gadgetTab) gadgetTab.classList.toggle("active", category === "gadget");
  if (animalsSection) animalsSection.style.display = category === "animal" ? "block" : "none";
  if (gadgetsSection) gadgetsSection.style.display = category === "gadget" ? "block" : "none";

  // Gadget auctions are always "normal" — hide type selector
  if (auctionTypeRow) auctionTypeRow.style.display = "flex";
  if (switchWrapper) switchWrapper.style.display = "none";

  // Deselect all cards
  document.querySelectorAll(".animal-card, .gadget-card").forEach(c => c.classList.remove("selected"));

  // Reset hidden selects
  const animalSelect = document.getElementById("animal-select");
  const gadgetSelect = document.getElementById("gadget-select");
  if (animalSelect) animalSelect.value = "";
  if (gadgetSelect) gadgetSelect.value = "";
}

// ─── Auction Start Form ────────────────────────────────────────────────────

const auctionStartForm = document.getElementById("auction-start-form");
if (auctionStartForm) {
  auctionStartForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const startingPrice = Number(document.getElementById("starting-price").value);
    const errorEl = document.getElementById("auction-start-error");

    if (currentItemCategory === "gadget") {
      const gadgetSelect = document.getElementById("gadget-select");
      const gadgetType = gadgetSelect ? gadgetSelect.value : selectedGadget;
      const auctionType = document.getElementById("auction-type").value;
      const switchTarget = document.getElementById("switch-target").value;

      if (!gadgetType || !startingPrice) {
        if (errorEl) { errorEl.textContent = "Please select a gadget and set a price."; errorEl.style.display = "block"; }
        return;
      }
      if (auctionType === "switch" && !switchTarget) {
        if (errorEl) { errorEl.textContent = "Pick a switch target gadget."; errorEl.style.display = "block"; }
        return;
      }

      socket.emit("admin:auction:start", {
        itemCategory: "gadget",
        gadgetType,
        startingPrice,
        auctionType,
        animalType: null,
        switchTarget: auctionType === "switch" ? switchTarget : null,
      });

      if (errorEl) { errorEl.textContent = ""; errorEl.style.display = "none"; }
      const gd = getGadgetData(gadgetType);
      updateCurrentAuctionDisplay(gadgetType, startingPrice, auctionType, null, "gadget");

    } else {
      const animalSelect = document.getElementById("animal-select");
      const animalType = animalSelect ? animalSelect.value : selectedAnimal;
      const auctionType = document.getElementById("auction-type").value;
      const switchTarget = document.getElementById("switch-target").value;

      if (!animalType || !startingPrice || !auctionType) {
        if (errorEl) { errorEl.textContent = "Please select an animal and fill all fields."; errorEl.style.display = "block"; }
        return;
      }

      if (auctionType === "switch" && !switchTarget) {
        if (errorEl) { errorEl.textContent = "Pick a switch target animal."; errorEl.style.display = "block"; }
        return;
      }

      socket.emit("admin:auction:start", {
        itemCategory: "animal",
        animalType,
        startingPrice,
        auctionType,
        switchTarget: auctionType === "switch" ? switchTarget : null,
        gadgetType: null,
      });

      if (errorEl) { errorEl.textContent = ""; errorEl.style.display = "none"; }
      updateCurrentAuctionDisplay(animalType, startingPrice, auctionType, null, "animal");
    }
  });
}

// Show/hide switch target
const auctionTypeSelect = document.getElementById("auction-type");
const switchTargetWrapper = document.getElementById("switch-target-wrapper");
if (auctionTypeSelect && switchTargetWrapper) {
  auctionTypeSelect.addEventListener("change", () => {
    switchTargetWrapper.style.display = auctionTypeSelect.value === "switch" ? "block" : "none";
  });
}

// ─── Stop / Cancel / Reveal ────────────────────────────────────────────────

const stopAuctionBtn = document.getElementById("stop-auction-btn");
if (stopAuctionBtn) {
  stopAuctionBtn.addEventListener("click", () => {
    if (confirm("Stop the current auction and award the item to the highest bidder?")) {
      socket.emit("admin:auction:stop");
    }
  });
}

const cancelAuctionBtn = document.getElementById("cancel-auction-btn");
if (cancelAuctionBtn) {
  cancelAuctionBtn.addEventListener("click", () => {
    if (confirm("Cancel the current auction? No one will receive the item and bids will be returned.")) {
      socket.emit("admin:auction:cancel");
    }
  });
}

const revealAnimalBtn = document.getElementById("reveal-animal-btn");
if (revealAnimalBtn) {
  revealAnimalBtn.addEventListener("click", () => {
    if (confirm("Reveal the animal to all public viewers? This cannot be undone.")) {
      socket.emit("admin:animal:reveal");
    }
  });
}

const revealGadgetBtn = document.getElementById("reveal-gadget-btn");
if (revealGadgetBtn) {
  revealGadgetBtn.addEventListener("click", () => {
    if (confirm("Reveal the gadget to all public viewers? This cannot be undone.")) {
      socket.emit("admin:gadget:reveal");
    }
  });
}

socket.on("admin:success", ({ message }) => {
  if (message.includes("revealed")) {
    const revealBtn = document.getElementById("reveal-animal-btn");
    if (revealBtn && message.toLowerCase().includes("animal")) {
      revealBtn.textContent = "✅ Animal Revealed!";
      revealBtn.disabled = true;
      revealBtn.style.opacity = "0.6";
    }
    const revealGadgetBtn = document.getElementById("reveal-gadget-btn");
    if (revealGadgetBtn && message.toLowerCase().includes("gadget")) {
      revealGadgetBtn.textContent = "✅ Gadget Revealed!";
      revealGadgetBtn.disabled = true;
      revealGadgetBtn.style.opacity = "0.6";
    }
  }
});

// ─── Buyback Form ──────────────────────────────────────────────────────────

const buybackForm = document.getElementById("buyback-form");
if (buybackForm) {
  buybackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const teamId = document.getElementById("buyback-team").value;
    const animalId = document.getElementById("buyback-animal").value;
    const price = Number(document.getElementById("buyback-price").value);

    if (!teamId || !animalId || !price) {
      const errorEl = document.getElementById("buyback-error");
      if (errorEl) { errorEl.textContent = "Fill all buyback fields."; errorEl.style.display = "block"; }
      return;
    }

    socket.emit("admin:buyback:offer", { teamId, animalId, price });

    const errorEl = document.getElementById("buyback-error");
    if (errorEl) { errorEl.textContent = ""; errorEl.style.display = "none"; }
  });
}

// ─── Render Admin State ────────────────────────────────────────────────────

function renderAdminState(state) {
  if (!state) return;

  const auction = state.auction;

  if (auction && auction.isActive) {
    const isGadget = auction.itemCategory === "gadget";

    updateCurrentAuctionDisplay(
      isGadget ? auction.gadgetType : auction.animalType,
      auction.currentPrice,
      auction.auctionType,
      state.teams?.find(t => t.id === auction.highestBidderId),
      auction.itemCategory || "animal"
    );

    // Reveal button — only for blind animal auctions
    const revealBtn = document.getElementById("reveal-animal-btn");
    if (revealBtn) {
      if (!isGadget && auction.auctionType === "blind") {
        revealBtn.style.display = "inline-block";
        revealBtn.disabled = false;
        revealBtn.textContent = "Reveal Animal to All";
        revealBtn.style.opacity = "1";
      } else {
        revealBtn.style.display = "none";
      }
    }

    // Reveal gadget button — only for blind gadget auctions
    const revealGadgetBtn = document.getElementById("reveal-gadget-btn");
    if (revealGadgetBtn) {
      if (isGadget && auction.auctionType === "blind") {
        revealGadgetBtn.style.display = "inline-block";
        revealGadgetBtn.disabled = false;
        revealGadgetBtn.textContent = "Reveal Gadget to All";
        revealGadgetBtn.style.opacity = "1";
      } else {
        revealGadgetBtn.style.display = "none";
      }
    }

    const startAuctionBtn = document.getElementById("start-auction-btn");
    if (startAuctionBtn) startAuctionBtn.disabled = true;

    const statAuction = document.getElementById("stat-auction");
    if (statAuction) statAuction.textContent = "Active";

    const auctionCardValue = document.querySelector(".auction-card .stat-card-value");
    if (auctionCardValue) auctionCardValue.textContent = "Active";

  } else {
    const currentAuctionInfo = document.getElementById("current-auction-info");
    if (currentAuctionInfo) currentAuctionInfo.innerHTML = '<p class="muted">No active auction</p>';

    const auctionControls = document.getElementById("auction-controls");
    if (auctionControls) auctionControls.style.display = "none";

    const startAuctionBtn = document.getElementById("start-auction-btn");
    if (startAuctionBtn) startAuctionBtn.disabled = false;

    const statAuction = document.getElementById("stat-auction");
    if (statAuction) statAuction.textContent = "Idle";

    const auctionCardValue = document.querySelector(".auction-card .stat-card-value");
    if (auctionCardValue) auctionCardValue.textContent = "Idle";
  }

  if (state.teams && state.teams.length > 0) renderTeams(state.teams);
  renderTradeOffers(state.allTradeOffers || [], state.teams || []);

  const statTeams = document.getElementById("stat-teams");
  if (statTeams) statTeams.textContent = state.teams ? state.teams.length : 0;

  const totalAnimals = state.teams ? state.teams.reduce((sum, t) => sum + (t.farm?.length || 0), 0) : 0;
  const statAnimals = document.getElementById("stat-animals");
  if (statAnimals) statAnimals.textContent = totalAnimals;
}

function renderTradeOffers(offers, teams) {
  const container = document.getElementById("admin-trade-offers-list");
  if (!container) return;

  if (!offers || offers.length === 0) {
    container.innerHTML = '<p class="muted">No trade offers.</p>';
    return;
  }

  const teamName = (id) => {
    const t = (teams || []).find(x => x.id === id);
    return t ? t.username : "Unknown Team";
  };

  const sorted = [...offers].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  container.innerHTML = "";
  sorted.forEach((o) => {
    const from = teamName(o.fromTeamId);
    const to = teamName(o.toTeamId);

    let detail = "";
    if (o.type === "money") {
      detail = `Money: ${from} ➜ ${to} ($${o.offeredPrice || 0}) for ${o.requestedAnimalType || "animal"}`;
    } else {
      detail = `Swap: ${from} ➜ ${to} (${o.offeredAnimalType || "animal"} ⇄ ${o.requestedAnimalType || "animal"})`;
    }

    const div = document.createElement("div");
    div.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:12px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:8px;gap:10px;";
    const status = String(o.status || "").toUpperCase();
    const canCancel = o.status === "pending";
    div.innerHTML = `
      <span style="flex:1;font-size:0.9rem;">
        <div style="font-weight:700;margin-bottom:4px;">${detail}</div>
        <div style="opacity:0.8;font-size:0.8rem;">Status: ${status} · ID: ${o.id}</div>
      </span>
      ${canCancel ? `<button data-offer-id="${o.id}" style="padding:6px 12px;font-size:0.8rem;background:rgba(231,76,60,0.3);border:1px solid rgba(231,76,60,0.5);color:#e74c3c;border-radius:6px;cursor:pointer;white-space:nowrap;">Cancel</button>` : ""}
    `;
    if (canCancel) {
      const btn = div.querySelector("button");
      btn.addEventListener("click", () => {
        if (confirm("Cancel this trade offer?")) socket.emit("admin:trade:cancel", { offerId: o.id });
      });
    }
    container.appendChild(div);
  });
}

function updateCurrentAuctionDisplay(itemType, price, auctionType, highestBidder = null, itemCategory = "animal") {
  const auctionControls = document.getElementById("auction-controls");
  if (auctionControls) auctionControls.style.display = "block";

  const currentAuctionInfo = document.getElementById("current-auction-info");
  if (currentAuctionInfo) currentAuctionInfo.innerHTML = "";

  const currentAnimal = document.getElementById("current-animal");
  if (currentAnimal) {
    if (itemCategory === "gadget") {
      const gd = getGadgetData(itemType);
      currentAnimal.textContent = `${gd.emoji} ${gd.name} (Gadget — boosts ${gd.boosts})`;
    } else {
      const animalData = getAnimalDataFromType(itemType);
      currentAnimal.textContent = animalData
        ? `${animalData.name} (${animalData.gender})`
        : itemType ? `${itemType.charAt(0).toUpperCase() + itemType.slice(1)}` : "Mystery Animal or Gadget";
    }
  }

  const currentAuctionType = document.getElementById("current-auction-type");
  if (currentAuctionType) {
    currentAuctionType.textContent = itemCategory === "gadget"
      ? "Gadget Auction"
      : (auctionType ? auctionType.charAt(0).toUpperCase() + auctionType.slice(1) : "Normal");
  }

  const currentAuctionPrice = document.getElementById("current-auction-price");
  if (currentAuctionPrice) currentAuctionPrice.textContent = price || 0;

  const currentHighestBidder = document.getElementById("current-highest-bidder");
  if (currentHighestBidder) {
    currentHighestBidder.textContent = highestBidder ? highestBidder.username : "Waiting for bids...";
  }
}

function renderTeams(teams) {
  const teamsList = document.getElementById("teams-list");
  const buybackTeam = document.getElementById("buyback-team");

  if (!teamsList || !buybackTeam) return;

  teamsList.innerHTML = "";
  buybackTeam.innerHTML = '<option value="">Choose a team...</option>';

  teams.forEach((team, index) => {
    const gadgets = team.gadgets || [];
    const gadgetCounts = {};
    gadgets.forEach((g) => { gadgetCounts[g.type] = (gadgetCounts[g.type] || 0) + 1; });
    const gadgetThumbs = Object.entries(gadgetCounts).map(([type, count]) => {
      const gd = getGadgetData(type);
      const img = getGadgetImage(type);
      return `
        <div title="${gd.name} x${count}" style="position:relative;width:28px;height:28px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.25);">
          <img src="${img}" alt="${type}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.textContent='${gd.emoji}'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center'; this.parentElement.style.fontSize='16px';" />
          ${count > 1 ? `<div style="position:absolute;bottom:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.18);font-size:10px;display:flex;align-items:center;justify-content:center;">${count}</div>` : ""}
        </div>
      `;
    }).join("");

    const teamItem = document.createElement("div");
    teamItem.className = "team-item";
    teamItem.innerHTML = `
      <div class="team-rank">${index + 1}</div>
      <div class="team-info">
        <div class="team-name">${team.username}</div>
        <div class="team-stats">
          <div class="team-money">${team.balance || 0}</div>
          <div class="team-points">${team.farmValue || 0}</div>
          <div class="team-animals">${team.farm?.length || 0} animals</div>
        </div>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;opacity:0.95;">
          ${gadgetThumbs || '<span style="opacity:0.7;font-size:0.8rem;">No gadgets</span>'}
        </div>
      </div>
    `;
    teamsList.appendChild(teamItem);

    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${team.username} ($${team.balance || 0})`;
    buybackTeam.appendChild(option);
  });

  populateBuybackAnimals(teams[0]);

  buybackTeam.addEventListener("change", () => {
    const selectedTeam = teams.find(t => t.id === buybackTeam.value);
    if (selectedTeam) populateBuybackAnimals(selectedTeam);
  });
}

function populateBuybackAnimals(team) {
  const buybackAnimal = document.getElementById("buyback-animal");
  if (!buybackAnimal) return;

  buybackAnimal.innerHTML = '<option value="">Choose an animal...</option>';

  if (!team || !team.farm || team.farm.length === 0) {
    buybackAnimal.innerHTML = '<option value="">No animals</option>';
    return;
  }

  team.farm.forEach((animal, index) => {
    const option = document.createElement("option");
    option.value = animal.id || `animal-${index}`;
    const animalData = getAnimalDataFromType(animal.type);
    option.textContent = animalData ? `${animalData.name} (${animalData.gender})` : `${animal.type}`;
    buybackAnimal.appendChild(option);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getAnimalDataFromType(type) {
  const animalsMap = {
    cow:     { name: "Cow",     gender: "Female" },
    bull:    { name: "Bull",    gender: "Male"   },
    goat:    { name: "Sheep",   gender: "Female" },
    sheep:   { name: "Ram",     gender: "Male"   },
    chicken: { name: "Chicken", gender: "Female" },
    rooster: { name: "Rooster", gender: "Male"   },
    doe:     { name: "Doe",     gender: "Female" },
    buck:    { name: "Buck",    gender: "Male"   },
    cat:     { name: "Cat",     gender: "Female" },
    dog:     { name: "Dog",     gender: "Male"   },
  };
  return animalsMap[type] || null;
}

function getAnimalData(type) {
  return getAnimalDataFromType(type) || { displayName: "Unknown", baseValue: 0 };
}

function getAnimalEmoji(type) {
  const emojis = {
    cow: "🐄", bull: "🐂", goat: "🐐", sheep: "🐑",
    chicken: "🐔", rooster: "🐓", doe: "🦌", buck: "🦌",
    cat: "🐱", dog: "🐶"
  };
  return emojis[type] || "❓";
}

// ─── DOM Init — Animal + Gadget card grids ─────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  // ── Animal cards ──
  const animalsGrid = document.getElementById("animals-grid");
  const animalSelect = document.getElementById("animal-select");
  const switchTarget = document.getElementById("switch-target");

  if (animalsGrid) {
    animalsGrid.innerHTML = "";

    const animalsData = [
      { value: "cow",     name: "Cow",     gender: "Female", price: 10, description: "Premium dairy breed for milk production",  image: "images/cow.jpg"     },
      { value: "bull",    name: "Bull",    gender: "Male",   price: 15, description: "Prime beef cattle for breeding",           image: "images/bull.webp"   },
      { value: "goat",    name: "Sheep",   gender: "Female", price: 5,  description: "Reliable milk and cheese producer",       image: "images/sheep.jpeg"  },
      { value: "sheep",   name: "Ram",     gender: "Male",   price: 10, description: "Wool production and meat source",         image: "images/Ram.webp"    },
      { value: "chicken", name: "Chicken", gender: "Female", price: 3,  description: "Excellent egg layer daily",               image: "images/chicken.jpg" },
      { value: "rooster", name: "Rooster", gender: "Male",   price: 5,  description: "Flock protection and breeding",           image: "images/rooster.jpg" },
      { value: "doe",     name: "Doe",     gender: "Female", price: 8,  description: "Graceful, produces offspring yearly",     image: "images/doe.jpg"     },
      { value: "buck",    name: "Buck",    gender: "Male",   price: 12, description: "Majestic, valuable for breeding",         image: "images/Buck.jpg"    },
      { value: "cat",     name: "Cat",     gender: "Female", price: 4,  description: "Pest control expert for barns",           image: "images/cat.jpg"     },
      { value: "dog",     name: "Dog",     gender: "Male",   price: 6,  description: "Herding and farm protection",             image: "images/dog.jpg"     },
    ];

    animalsData.forEach(animal => {
      const card = document.createElement("div");
      card.className = "animal-card";
      card.dataset.value = animal.value;
      card.innerHTML = `
        <div class="animal-icon">
          <img src="${animal.image}" alt="${animal.name}"
               onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200/4a3118/f8f4e8?text=${animal.name}';">
        </div>
        <div class="animal-name">${animal.name}</div>
        <div class="animal-description">${animal.description}</div>
        <div class="animal-price">${animal.price}</div>
      `;

      card.addEventListener("click", function () {
        document.querySelectorAll(".animal-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedAnimal = animal.value;
        if (animalSelect) {
          animalSelect.value = animal.value;
          animalSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      animalsGrid.appendChild(card);

      if (switchTarget) {
        const opt = document.createElement("option");
        opt.value = animal.value;
        opt.textContent = `${animal.name} (${animal.gender}) - ${animal.price} pts`;
        switchTarget.appendChild(opt);
      }
    });
  }

  // ── Gadget cards ──
  const gadgetsGrid = document.getElementById("gadgets-grid");
  const gadgetSelect = document.getElementById("gadget-select");

  if (gadgetsGrid) {
    gadgetsGrid.innerHTML = "";

    gadgets.forEach(gadget => {
      const card = document.createElement("div");
      // Reuse animal-card styles
      card.className = "animal-card gadget-card";
      card.dataset.value = gadget.value;
      card.innerHTML = `
        <div class="animal-icon">
          <img src="${gadget.image}" alt="${gadget.name}"
               onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'font-size:2.5rem;display:flex;align-items:center;justify-content:center;height:100%;\\' >${gadget.emoji}</div>';">
        </div>
        <div class="animal-name">${gadget.name}</div>
        <div class="animal-description">Doubles ${gadget.boosts} points</div>
        <div class="animal-price">—</div>
      `;

      card.addEventListener("click", function () {
        document.querySelectorAll(".gadget-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedGadget = gadget.value;
        if (gadgetSelect) {
          gadgetSelect.value = gadget.value;
          gadgetSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      gadgetsGrid.appendChild(card);
    });

    // Also populate switch-target dropdown with gadgets
    gadgets.forEach(gadget => {
      if (switchTarget) {
        const opt = document.createElement("option");
        opt.value = gadget.value;
        opt.textContent = `${gadget.name} (Gadget) — doubles ${gadget.boosts}`;
        opt.dataset.category = "gadget";
        switchTarget.appendChild(opt);
      }
    });
  }

  // ── Auction type show/hide switch wrapper ──
  const auctionType = document.getElementById("auction-type");
  const switchWrapper = document.getElementById("switch-target-wrapper");
  if (auctionType && switchWrapper) {
    auctionType.addEventListener("change", function () {
      switchWrapper.style.display = this.value === "switch" ? "block" : "none";
    });
  }

  // ── Buyback form buttons ──
  const stopBtn = document.getElementById("stop-auction-btn");
  const cancelBtn = document.getElementById("cancel-auction-btn");
  if (stopBtn) {
    stopBtn.classList.add("btn");
    if (cancelBtn) cancelBtn.classList.add("btn", "btn-danger");
  }

  // ── Initialize tab state ──
  switchItemTab("animal");
});