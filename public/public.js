const socket = io();

let currentState = null;

// ANIMAL IMAGE PATHS - SAME AS ADMIN
const animalImages = {
  cow: 'images/cow.jpg',
  bull: 'images/bull.webp',
  goat: 'images/sheep.jpeg',
  sheep: 'images/Ram.webp',
  chicken: 'images/chicken.jpg',
  rooster: 'images/rooster.jpg',
  doe: 'images/doe.jpg',
  buck: 'images/Buck.jpg',
  cat: 'images/cat.jpg',
  dog: 'images/dog.jpg'
};

const gadgetImages = {
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
window.gadgetImages = gadgetImages;

const gadgetNames = {
  cow_milker: "Cow Milker",
  bull_harness: "Bull Harness",
  goat_bell: "Sheep Bell",
  sheep_shears: "Ram Shears",
  chicken_nest: "Chicken Nest",
  rooster_whistle: "Rooster Compass",
  doe_saltlick: "Doe Feeder",
  buck_antler_oil: "Buck Serum Oil",
  cat_yarnball: "Silk Yarn Ball",
  dog_treats: "Dog Treats",
};
window.gadgetNames = gadgetNames;

// Gadget boosts map (which animal type each gadget doubles)
const gadgetBoosts = {
  cow_milker: "Cow",
  bull_harness: "Bull",
  goat_bell: "Sheep",
  sheep_shears: "Ram",
  chicken_nest: "Chicken",
  rooster_whistle: "Rooster",
  doe_saltlick: "Doe",
  buck_antler_oil: "Buck",
  cat_yarnball: "Cat",
  dog_treats: "Dog",
};
window.gadgetBoosts = gadgetBoosts;

// ANIMAL DISPLAY NAMES
const animalDisplayNames = {
  cow: "Cow",
  bull: "Bull",
  goat: "Sheep",
  sheep: "Ram",
  chicken: "Chicken",
  rooster: "Rooster",
  doe: "Doe",
  buck: "Buck",
  cat: "Cat",
  dog: "Dog"
};

// Connect as public viewer
socket.emit("public:connect");

// Socket Events
socket.on("state:update", (state) => {
  currentState = state;
  window.currentState = state;
  console.log("Public: Received state update", state);
  renderPublicState(state);
});

socket.on("auction:started", () => {
  console.log("Public: Auction started event");
  socket.emit("state:request");
  animateAuctionStart();
});

socket.on("auction:ended", ({ winnerId, animalType, gadgetType, itemCategory }) => {
  console.log("Public: Auction ended", { winnerId, animalType, gadgetType, itemCategory });

  const isBlind = currentState?.auction?.auctionType === "blind";

  if (isBlind && itemCategory === "gadget" && gadgetType) {
    // Blind gadget — reveal the gadget image briefly then reset
    setTimeout(() => {
      document.getElementById("animal-display").style.display = "flex";
      document.getElementById("mystery-box").style.display = "none";
      showGadgetImage(gadgetType);
      animateReveal();
    }, 500);
  } else if (isBlind && animalType) {
    // Blind animal — reveal animation
    setTimeout(() => {
      showAnimalImage(animalType);
      animateReveal();
    }, 500);
  } else {
    animateAuctionEnd();
  }

  // Request updated state — server will have isActive=false, which resets display to waiting
  setTimeout(() => socket.emit("state:request"), 1000);
});

socket.on("auction:cancelled", () => {
  console.log("Public: Auction cancelled");
  socket.emit("state:request");
});
// Add this socket listener to public.js - around line 55-60, after the other socket.on handlers
socket.on("auction:animal:revealed", ({ animalType }) => {
  console.log("Public: Animal revealed by admin", animalType);

  if (animalType) {
    // Show the revealed animal immediately
    showAnimalImage(animalType);

    // Also update the current state
    if (currentState?.auction) {
      currentState.auction.animalType = animalType;
    }

    // Trigger reveal animation
    animateReveal();

    // If in side-by-side layout, sync to huge display
    if (window.syncImageToHugeDisplay) {
      setTimeout(() => {
        window.syncImageToHugeDisplay();
      }, 100);
    }
  }
});

socket.on("auction:gadget:revealed", ({ gadgetType }) => {
  console.log("Public: Gadget revealed by admin", gadgetType);

  if (gadgetType) {
    // Show the revealed gadget immediately
    showGadgetImage(gadgetType);

    // Update current state
    if (currentState?.auction) {
      currentState.auction.gadgetType = gadgetType;
    }

    // Trigger reveal animation
    animateReveal();

    // Sync to huge display if needed
    if (window.syncImageToHugeDisplay) {
      setTimeout(() => {
        window.syncImageToHugeDisplay();
      }, 100);
    }
  }
});

// Render Public State
function renderPublicState(state) {
  const auction = state.auction;

  if (!auction) {
    console.log("Public: No auction data");
    return;
  }

  console.log("Public: Rendering state", auction);

  // Auction Status
  const statusDisplay = document.getElementById("auction-status-display");
  if (statusDisplay) {
    if (auction.isActive) {
      statusDisplay.textContent = "🟢 Auction Active";
      statusDisplay.style.color = "rgba(255,244,230,.95)";
    } else {
      statusDisplay.textContent = "⚪ No active auction";
      statusDisplay.style.color = "rgba(255,244,230,.60)";
    }
  }

  if (auction.isActive) {
    console.log("Public: Auction is active, animal type:", auction.animalType);

    // Show podium content
    // NEW - switch gadget shows image, only blind-with-no-reveal shows mystery box:
if (auction.itemCategory === "gadget") {
  if (auction.auctionType === "blind" && !auction.gadgetType) {
    document.getElementById("animal-display").style.display = "none";
    document.getElementById("mystery-box").style.display = "block";
    document.getElementById("animal-name-large").textContent = "Mystery Gadget";
  } else if (auction.gadgetType) {
    document.getElementById("animal-display").style.display = "flex";
    document.getElementById("mystery-box").style.display = "none";
    showGadgetImage(auction.gadgetType);
  }
} else if (auction.auctionType === "blind" && !auction.animalType) {
      // Blind auction - show mystery box
      console.log("Public: Showing mystery box (blind auction)");
      document.getElementById("animal-display").style.display = "none";
      document.getElementById("mystery-box").style.display = "block";
      document.getElementById("animal-name-large").textContent = "Mystery Animal or Gadget";
    } else {
      // Normal animal auction - show animal with IMAGE
      console.log("Public: Showing animal display");
      document.getElementById("animal-display").style.display = "flex";
      document.getElementById("mystery-box").style.display = "none";

      if (auction.animalType) {
        showAnimalImage(auction.animalType);
      } else {
        document.getElementById("animal-name-large").textContent = "Unknown Animal";
        document.getElementById("animal-icon-large").innerHTML = "❓";
      }
    }

    // Price Display
    const priceEl = document.getElementById("current-price-large");
    if (priceEl) {
      const oldPrice = priceEl.textContent.replace("$", "");
      const newPrice = auction.currentPrice;
      if (oldPrice !== newPrice.toString()) {
        animatePriceChange();
      }
      priceEl.textContent = `$${newPrice}`;
    }

    // Highest Bidder
    const highestBidder = state.teams ? state.teams.find((t) => t.id === auction.highestBidderId) : null;
    const bidderEl = document.getElementById("highest-bidder-large");
    if (bidderEl) {
      if (highestBidder) {
        if (bidderEl.textContent !== highestBidder.username) {
          animateBidderChange();
        }
        bidderEl.textContent = highestBidder.username;
      } else {
        bidderEl.textContent = "—";
      }
    }

    // Auction Type
    const typeText = auction.auctionType ?
      auction.auctionType.charAt(0).toUpperCase() + auction.auctionType.slice(1) + " Auction" :
      "Normal Auction";

    const typeEl = document.getElementById("auction-type-text");
    if (typeEl) typeEl.textContent = typeText;

  } else {
    // No active auction
    console.log("Public: No active auction");
    document.getElementById("animal-display").style.display = "flex";
    document.getElementById("mystery-box").style.display = "none";
    document.getElementById("animal-icon-large").innerHTML = "🏛️";
    document.getElementById("animal-name-large").textContent = "Waiting for auction...";

    const priceEl = document.getElementById("current-price-large");
    if (priceEl) priceEl.textContent = "$0";

    const bidderEl = document.getElementById("highest-bidder-large");
    if (bidderEl) bidderEl.textContent = "—";

    const typeEl = document.getElementById("auction-type-text");
    if (typeEl) typeEl.textContent = "—";

    const statusDisplay = document.getElementById("auction-status-display");
    if (statusDisplay) {
      statusDisplay.textContent = "Waiting for auction...";
      statusDisplay.style.color = "rgba(255,244,230,.60)";
    }
  }

  renderTopTeams(state);
}

function renderTopTeams(state) {
  const container = document.getElementById("public-top-teams");
  if (!container) return;
  const teams = (state.teams || []).slice().sort((a, b) => (b.farmValue || 0) - (a.farmValue || 0)).slice(0, 5);
  if (teams.length === 0) {
    container.innerHTML = '<div style="opacity:0.75;">No teams yet.</div>';
    return;
  }

  container.innerHTML = teams.map((t, idx) => {
    const counts = {};
    (t.gadgets || []).forEach(g => { counts[g.type] = (counts[g.type] || 0) + 1; });
    const thumbs = Object.entries(counts).slice(0, 8).map(([type, count]) => {
      const img = gadgetImages[type] || "/images/gadgets/placeholder.png";
      const name = gadgetNames[type] || type;
      return `
        <div title="${name} x${count}" style="position:relative;width:26px;height:26px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.25);">
          <img src="${img}" alt="${type}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.textContent='🧩'; this.parentElement.style.display='flex'; this.parentElement.style.alignItems='center'; this.parentElement.style.justifyContent='center'; this.parentElement.style.fontSize='14px';" />
          ${count > 1 ? `<div style="position:absolute;bottom:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.18);font-size:10px;display:flex;align-items:center;justify-content:center;">${count}</div>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
          <div style="font-weight:900; color: ${idx === 0 ? "var(--gold-primary)" : "var(--cream-light)"}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${idx + 1}. ${t.username}</div>
          <div style="opacity:0.8; font-weight:800; font-size:0.9rem;">${t.farmValue || 0} pts</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:55%;">
        </div>
      </div>
    `;
  }).join("");
}

// Show animal with ACTUAL IMAGE

// Show gadget with image on the public podium
function showGadgetImage(gadgetType) {
  const animalIcon = document.getElementById("animal-icon-large");
  const animalName = document.getElementById("animal-name-large");
  if (!animalIcon || !animalName) return;

  const imgSrc = gadgetImages[gadgetType];
  const name = gadgetNames[gadgetType] || gadgetType;
  const emoji = { cow_milker:"🪣", bull_harness:"🧰", goat_bell:"🔔", sheep_shears:"✂️",
    chicken_nest:"🪺", rooster_whistle:"📯", doe_saltlick:"🧂", buck_antler_oil:"🧴",
    cat_yarnball:"🧶", dog_treats:"🦴" }[gadgetType] || "🧩";

  animalIcon.innerHTML = '';
  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = name;
  img.onerror = function() { animalIcon.innerHTML = emoji; };
  animalIcon.appendChild(img);
  animalName.textContent = name;
}

function showAnimalImage(animalType) {
  const animalIcon = document.getElementById("animal-icon-large");
  const animalName = document.getElementById("animal-name-large");

  if (!animalIcon || !animalName) return;

  // Get image path
  const imgSrc = animalImages[animalType];
  const displayName = animalDisplayNames[animalType] ||
    animalType.charAt(0).toUpperCase() + animalType.slice(1);

  console.log(`Public: Loading image for ${animalType}: ${imgSrc}`);

  // Create image element
  animalIcon.innerHTML = '';
  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = displayName;
  img.onerror = function () {
    console.error(`Failed to load image: ${imgSrc}`);
    // Fallback to emoji
    animalIcon.innerHTML = getAnimalEmoji(animalType);
  };

  animalIcon.appendChild(img);
  animalName.textContent = displayName;
}

// Animations (keep your existing animation functions)
function animateAuctionStart() {
  const podium = document.getElementById("podium");
  if (podium) {
    podium.classList.add("animate-start");
    setTimeout(() => {
      podium.classList.remove("animate-start");
    }, 1000);
  }
}

function animateReveal() {
  const mysteryBox = document.getElementById("mystery-box");
  const animalDisplay = document.getElementById("animal-display");

  if (mysteryBox && mysteryBox.style.display !== "none") {
    mysteryBox.classList.add("animate-reveal");
    setTimeout(() => {
      mysteryBox.classList.remove("animate-reveal");
      document.getElementById("mystery-box").style.display = "none";
      document.getElementById("animal-display").style.display = "flex";
      animateAuctionEnd();
    }, 1500);
  } else if (animalDisplay) {
    animalDisplay.classList.add("animate-pulse");
    setTimeout(() => {
      animalDisplay.classList.remove("animate-pulse");
    }, 500);
  }
}

function animatePriceChange() {
  const priceEl = document.getElementById("current-price-large");
  if (priceEl) {
    priceEl.classList.add("animate-pulse");
    setTimeout(() => {
      priceEl.classList.remove("animate-pulse");
    }, 500);
  }
}

function animateBidderChange() {
  const bidderEl = document.getElementById("highest-bidder-large");
  if (bidderEl) {
    bidderEl.classList.add("animate-bounce");
    setTimeout(() => {
      bidderEl.classList.remove("animate-bounce");
    }, 600);
  }
}

function animateAuctionEnd() {
  const podium = document.getElementById("podium");
  if (podium) {
    podium.classList.add("animate-celebration");
    setTimeout(() => {
      podium.classList.remove("animate-celebration");
    }, 2000);
  }
}

// Utility Functions
function getAnimalEmoji(type) {
  const emojis = {
    cow: "🐄", bull: "🐂", goat: "🐐", sheep: "🐑",
    chicken: "🐔", rooster: "🐓", doe: "🦌", buck: "🦌",
    cat: "🐱", dog: "🐶"
  };
  return emojis[type] || "❓";
}

// Request initial state
socket.on("connect", () => {
  console.log("Public: Connected to server");
  socket.emit("state:request");
});

// EXPOSE REVEAL FUNCTION TO OUTSIDE (for side-by-side layout)
// EXPOSE REVEAL FUNCTION TO OUTSIDE (for side-by-side layout)
// EXPOSE REVEAL FUNCTION TO OUTSIDE (for side-by-side layout)
function revealAnimal() {
  console.log("Public.js: Manual reveal triggered");

  // Get the auction from current state
  const auction = currentState?.auction;

  if (!auction || !auction.isActive) {
    console.log("Cannot reveal: No active auction");
    alert("No active auction to reveal!");
    return false;
  }

  if (auction.auctionType !== "blind") {
    console.log("Cannot reveal: Not a blind auction");
    alert("Not a blind auction!");
    return false;
  }

  if (!auction.animalType) {
    console.log("Cannot reveal: Animal type unknown");
    alert("Cannot reveal: Animal type not known!");
    return false;
  }

  console.log("Revealing animal:", auction.animalType);

  // Show the animal image
  showAnimalImage(auction.animalType);

  // Trigger reveal animation
  animateReveal();

  // Emit to server so admin knows (optional)
  socket.emit("public:animal:reveal", { animalType: auction.animalType });

  return true;


  // Not a Mystery Animal or Gadget or not a blind auction
  console.log("Not a Mystery Animal or Gadget or not blind auction");
  return false;
}

// Make it globally accessible
window.revealAnimal = revealAnimal;