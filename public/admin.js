const socket = io();

// Auto-login using YOUR authentication system
window.addEventListener("load", () => {
  const savedU = sessionStorage.getItem("fa_u");
  const savedP = sessionStorage.getItem("fa_p");

  // Check if we're already logged in as admin
  if (savedU === "admin" && savedP) {
    // Optimistically hide login screen, show dashboard immediately
    const adminLogin = document.getElementById("admin-login");
    const adminDashboard = document.getElementById("admin-dashboard");
    if (adminLogin) adminLogin.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";

    // Auto-login as admin
    socket.emit("admin:login", { password: savedP });
  }

  // Request initial state
  socket.emit("state:request");
});

let adminState = null;
let selectedAnimal = null;

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
    cow_milker: { name: "Cow Milker", emoji: "🪣" },
    bull_harness: { name: "Bull Harness", emoji: "🧰" },
    goat_bell: { name: "Goat Bell", emoji: "🔔" },
    sheep_shears: { name: "Sheep Shears", emoji: "✂️" },
    chicken_nest: { name: "Chicken Nest", emoji: "🪺" },
    rooster_whistle: { name: "Rooster Whistle", emoji: "📯" },
    doe_saltlick: { name: "Doe Salt Lick", emoji: "🧂" },
    buck_antler_oil: { name: "Buck Antler Oil", emoji: "🧴" },
    cat_yarnball: { name: "Silk Yarn Ball", emoji: "🧶" },
    dog_treats: { name: "Dog Treats", emoji: "🦴" },
  };
  return map[type] || { name: String(type), emoji: "🧩" };
}

// Admin Login (if login form exists)
const adminLoginForm = document.getElementById("admin-login-form");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = document.getElementById("admin-password").value;
    socket.emit("admin:login", { password });
  });
}

// Socket Events
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
  console.log("Auction started on server");
  socket.emit("state:request");
});

socket.on("auction:ended", () => {
  console.log("Auction ended on server");
  socket.emit("state:request");
});

socket.on("auction:cancelled", () => {
  console.log("Auction cancelled on server");
  socket.emit("state:request");
});

// Start Auction - MODIFIED FOR YOUR IMAGE-BASED SELECTION
const auctionStartForm = document.getElementById("auction-start-form");
if (auctionStartForm) {
  auctionStartForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get selected animal from hidden select OR from selectedAnimal variable
    const animalSelect = document.getElementById("animal-select");
    const animalType = animalSelect ? animalSelect.value : selectedAnimal;

    const startingPrice = Number(document.getElementById("starting-price").value);
    const auctionType = document.getElementById("auction-type").value;
    const switchTarget = document.getElementById("switch-target").value;

    if (!animalType || !startingPrice || !auctionType) {
      const errorEl = document.getElementById("auction-start-error");
      if (errorEl) {
        errorEl.textContent = "Please select an animal and fill all fields.";
        errorEl.style.display = "block";
      }
      return;
    }

    if (auctionType === "switch" && !switchTarget) {
      const errorEl = document.getElementById("auction-start-error");
      if (errorEl) {
        errorEl.textContent = "Pick a switch target animal.";
        errorEl.style.display = "block";
      }
      return;
    }

    // Send to server
    socket.emit("admin:auction:start", {
      animalType,
      startingPrice,
      auctionType,
      switchTarget: auctionType === "switch" ? switchTarget : null
    });

    // Clear error
    const errorEl = document.getElementById("auction-start-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }

    // Update UI immediately
    updateCurrentAuctionDisplay(animalType, startingPrice, auctionType);
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

// Stop Auction
const stopAuctionBtn = document.getElementById("stop-auction-btn");
if (stopAuctionBtn) {
  stopAuctionBtn.addEventListener("click", () => {
    if (confirm("Stop the current auction and award the animal to the highest bidder?")) {
      socket.emit("admin:auction:stop");
    }
  });
}

// Cancel Auction
const cancelAuctionBtn = document.getElementById("cancel-auction-btn");
if (cancelAuctionBtn) {
  cancelAuctionBtn.addEventListener("click", () => {
    if (confirm("Cancel the current auction? No one will receive the animal and bids will be returned.")) {
      socket.emit("admin:auction:cancel");
    }
  });
}

// Reveal Animal Button (for blind auctions)
const revealAnimalBtn = document.getElementById("reveal-animal-btn");
if (revealAnimalBtn) {
  revealAnimalBtn.addEventListener("click", () => {
    if (confirm("Reveal the animal to all public viewers? This cannot be undone.")) {
      socket.emit("admin:animal:reveal");
    }
  });
}

// Listen for reveal success
socket.on("admin:success", ({ message }) => {
  console.log("Admin success:", message);
  // Update button state after reveal
  if (message.includes("revealed")) {
    const revealBtn = document.getElementById("reveal-animal-btn");
    if (revealBtn) {
      revealBtn.textContent = "✅ Animal Revealed!";
      revealBtn.disabled = true;
      revealBtn.style.opacity = "0.6";
    }
  }
});

// Buyback form
const buybackForm = document.getElementById("buyback-form");
if (buybackForm) {
  buybackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const teamId = document.getElementById("buyback-team").value;
    const animalId = document.getElementById("buyback-animal").value;
    const price = Number(document.getElementById("buyback-price").value);

    if (!teamId || !animalId || !price) {
      const errorEl = document.getElementById("buyback-error");
      if (errorEl) {
        errorEl.textContent = "Fill all buyback fields.";
        errorEl.style.display = "block";
      }
      return;
    }

    socket.emit("admin:buyback:offer", { teamId, animalId, price });

    const errorEl = document.getElementById("buyback-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }
  });
}

// Render Admin State - UPDATED FOR YOUR DESIGN
function renderAdminState(state) {
  if (!state) return;

  const auction = state.auction;

  // Current Auction
  if (auction && auction.isActive) {
    // Update current auction display
    updateCurrentAuctionDisplay(
      auction.animalType,
      auction.currentPrice,
      auction.auctionType,
      state.teams?.find(t => t.id === auction.highestBidderId)
    );

    // Show/hide reveal button for blind auctions
    const revealBtn = document.getElementById("reveal-animal-btn");
    if (revealBtn) {
      if (auction.auctionType === "blind") {
        revealBtn.style.display = "inline-block";
        revealBtn.disabled = false;
        revealBtn.textContent = "Reveal Animal to All";
        revealBtn.style.opacity = "1";
      } else {
        revealBtn.style.display = "none";
      }
    }

    // Disable start auction button
    const startAuctionBtn = document.getElementById("start-auction-btn");
    if (startAuctionBtn) startAuctionBtn.disabled = true;

    // Update stats
    const statAuction = document.getElementById("stat-auction");
    if (statAuction) statAuction.textContent = "Active";

    const auctionCardValue = document.querySelector('.auction-card .stat-card-value');
    if (auctionCardValue) auctionCardValue.textContent = "Active";
  } else {
    // No active auction
    const currentAuctionInfo = document.getElementById("current-auction-info");
    if (currentAuctionInfo) {
      currentAuctionInfo.innerHTML = '<p class="muted">No active auction</p>';
    }

    const auctionControls = document.getElementById("auction-controls");
    if (auctionControls) auctionControls.style.display = "none";

    const startAuctionBtn = document.getElementById("start-auction-btn");
    if (startAuctionBtn) startAuctionBtn.disabled = false;

    // Update stats
    const statAuction = document.getElementById("stat-auction");
    if (statAuction) statAuction.textContent = "Idle";

    const auctionCardValue = document.querySelector('.auction-card .stat-card-value');
    if (auctionCardValue) auctionCardValue.textContent = "Idle";
  }

  // Teams List - USING YOUR HARDCODED TEAMS FOR NOW
  // (We'll update this if server sends real team data)
  if (state.teams && state.teams.length > 0) {
    renderTeams(state.teams);
  }

  // Trade offers (admin can view + cancel)
  renderTradeOffers(state.allTradeOffers || [], state.teams || []);

  // Statistics
  const statTeams = document.getElementById("stat-teams");
  if (statTeams) {
    statTeams.textContent = state.teams ? state.teams.length : 4; // Fallback to 4
  }

  const totalAnimals = state.teams ?
    state.teams.reduce((sum, team) => sum + (team.farm?.length || 0), 0) : 32; // Fallback to 32
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
        if (confirm("Cancel this trade offer?")) {
          socket.emit("admin:trade:cancel", { offerId: o.id });
        }
      });
    }
    container.appendChild(div);
  });
}

function updateCurrentAuctionDisplay(animalType, price, auctionType, highestBidder = null) {
  const auctionControls = document.getElementById("auction-controls");
  if (auctionControls) auctionControls.style.display = "block";

  const currentAuctionInfo = document.getElementById("current-auction-info");
  if (currentAuctionInfo) currentAuctionInfo.innerHTML = '';

  // Get animal name from your animals array or use utility function
  const animalData = getAnimalDataFromType(animalType);

  const currentAnimal = document.getElementById("current-animal");
  if (currentAnimal) {
    currentAnimal.textContent = animalData ?
      `${animalData.name} (${animalData.gender})` :
      animalType ? `${animalType.charAt(0).toUpperCase() + animalType.slice(1)}` : "Mystery Animal";
  }

  const currentAuctionType = document.getElementById("current-auction-type");
  if (currentAuctionType) {
    currentAuctionType.textContent = auctionType ?
      auctionType.charAt(0).toUpperCase() + auctionType.slice(1) : "Normal";
  }

  const currentAuctionPrice = document.getElementById("current-auction-price");
  if (currentAuctionPrice) currentAuctionPrice.textContent = price || 0;

  const currentHighestBidder = document.getElementById("current-highest-bidder");
  if (currentHighestBidder) {
    currentHighestBidder.textContent = highestBidder ?
      highestBidder.username : "Waiting for bids...";
  }
}

function renderTeams(teams) {
  const teamsList = document.getElementById("teams-list");
  const buybackTeam = document.getElementById("buyback-team");

  if (!teamsList || !buybackTeam) return;

  // Clear existing
  teamsList.innerHTML = "";
  buybackTeam.innerHTML = '<option value="">Choose a team...</option>';

  teams.forEach((team, index) => {
    const gadgets = team.gadgets || [];
    const gadgetCounts = {};
    gadgets.forEach((g) => {
      gadgetCounts[g.type] = (gadgetCounts[g.type] || 0) + 1;
    });
    const gadgetThumbs = Object.entries(gadgetCounts).map(([type, count]) => {
      const gd = getGadgetData(type);
      const img = getGadgetImage(type);
      return `
        <div title="${gd.name} x${count}" style="position:relative;width:28px;height:28px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.25);">
          <img src="${img}" alt="${type}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.innerHTML='${gd.emoji}'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center'; this.parentElement.style.fontSize='16px';" />
          ${count > 1 ? `<div style="position:absolute;bottom:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.18);font-size:10px;display:flex;align-items:center;justify-content:center;">${count}</div>` : ""}
        </div>
      `;
    }).join("");

    // Add to teams list display
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

    // Add to buyback dropdown
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${team.username} ($${team.balance || 0})`;
    buybackTeam.appendChild(option);
  });

  // Also populate buyback-animal dropdown for first team
  populateBuybackAnimals(teams[0]);

  // Update buyback-animal when team selection changes
  buybackTeam.addEventListener("change", () => {
    const selectedTeam = teams.find(t => t.id === buybackTeam.value);
    if (selectedTeam) {
      populateBuybackAnimals(selectedTeam);
    }
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
    option.textContent = animalData ?
      `${animalData.name} (${animalData.gender})` :
      `${animal.type.charAt(0).toUpperCase() + animal.type.slice(1)}`;
    buybackAnimal.appendChild(option);
  });
}

// Helper function to get animal data from type
function getAnimalDataFromType(type) {
  const animalsMap = {
    cow: { name: "Cow", gender: "Female", points: 85 },
    bull: { name: "Bull", gender: "Male", points: 65 },
    goat: { name: "Sheep", gender: "Female", points: 45 },
    sheep: { name: "Ram", gender: "Male", points: 55 },
    chicken: { name: "Chicken", gender: "Female", points: 12 },
    rooster: { name: "Rooster", gender: "Male", points: 8 },
    doe: { name: "Doe", gender: "Female", points: 60 },
    buck: { name: "Buck", gender: "Male", points: 40 },
    cat: { name: "Cat", gender: "Female", points: 15 },
    dog: { name: "Dog", gender: "Male", points: 25 }
  };

  return animalsMap[type] || null;
}

// Keep these utility functions for compatibility
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

// Initialize animal card selection
document.addEventListener("DOMContentLoaded", function () {
  // Set up animal card click handlers if they exist
  const animalCards = document.querySelectorAll('.animal-card');
  animalCards.forEach(card => {
    card.addEventListener('click', function () {
      // Update selected animal
      selectedAnimal = this.dataset.value;

      // Update hidden select
      const animalSelect = document.getElementById('animal-select');
      if (animalSelect) {
        animalSelect.value = selectedAnimal;
      }
    });
  });
});