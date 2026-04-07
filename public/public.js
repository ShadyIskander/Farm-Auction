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

// ANIMAL DISPLAY NAMES
const animalDisplayNames = {
  cow: "Cow",
  bull: "Angus Bull",
  goat: "Alpine Goat",
  sheep: "Merino Ram",
  chicken: "Rhode Island Red Chicken",
  rooster: "Leghorn Rooster",
  doe: "White-tailed Doe",
  buck: "Whitetail Buck",
  cat: "Barn Cat",
  dog: "Shepherd Dog"
};

// Connect as public viewer
socket.emit("public:connect");

// Socket Events
socket.on("state:update", (state) => {
  currentState = state;
  console.log("Public: Received state update", state);
  renderPublicState(state);
});

socket.on("auction:started", () => {
  console.log("Public: Auction started event");
  socket.emit("state:request");
  animateAuctionStart();
});

socket.on("auction:ended", ({ winnerId, animalType }) => {
  console.log("Public: Auction ended", { winnerId, animalType });

  if (currentState?.auction?.auctionType === "blind" && animalType) {
    // Reveal animation for blind auctions
    setTimeout(() => {
      showAnimalImage(animalType);
      animateReveal();
    }, 500);
  } else {
    animateAuctionEnd();
  }

  // Request updated state
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
    if (auction.auctionType === "blind" && !auction.animalType) {
      // Blind auction - show mystery box
      console.log("Public: Showing mystery box (blind auction)");
      document.getElementById("animal-display").style.display = "none";
      document.getElementById("mystery-box").style.display = "block";
      document.getElementById("animal-name-large").textContent = "Mystery Animal";
    } else {
      // Normal auction - show animal with IMAGE
      console.log("Public: Showing animal display");
      document.getElementById("animal-display").style.display = "flex";
      document.getElementById("mystery-box").style.display = "none";

      if (auction.animalType) {
        showAnimalImage(auction.animalType);
      } else {
        // No animal type (shouldn't happen)
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
}

// Show animal with ACTUAL IMAGE
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


  // Not a mystery animal or not a blind auction
  console.log("Not a mystery animal or not blind auction");
  return false;
}

// Make it globally accessible
window.revealAnimal = revealAnimal;