const socket = io();

const joinForm = document.getElementById("join-form");
const usernameInput = document.getElementById("username");
const joinError = document.getElementById("join-error");

const bidForm = document.getElementById("bid-form");
const bidInput = document.getElementById("bid-amount");
const bidError = document.getElementById("bid-error");

const currentPriceEl = document.getElementById("current-price");
const highestBidderEl = document.getElementById("highest-bidder");
const itemNameEl = document.getElementById("item-name");
const itemDescriptionEl = document.getElementById("item-description");
const playersList = document.getElementById("players");
const historyList = document.getElementById("history");
const playerBalanceEl = document.getElementById("player-balance");
const playerLockedEl = document.getElementById("player-locked");

let currentPlayerId = null;

const formatCurrency = (num) => `${num.toFixed(0)} pts`;

const renderState = (state) => {
  if (!state) return;

  itemNameEl.textContent = state.item.name;
  itemDescriptionEl.textContent = state.item.description;
  currentPriceEl.textContent = formatCurrency(state.item.currentPrice);

  const highest = state.players.find((p) => p.id === state.item.highestBidderId);
  highestBidderEl.textContent = highest ? highest.username : "—";

  playersList.innerHTML = "";
  state.players
    .sort((a, b) => b.balance - a.balance)
    .forEach((player) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = player.username;
      const meta = document.createElement("span");
      meta.innerHTML = `${formatCurrency(player.balance)} ${
        state.item.highestBidderId === player.id ? '<span class="badge">Highest</span>' : ""
      }`;
      li.appendChild(name);
      li.appendChild(meta);
      playersList.appendChild(li);
    });

  historyList.innerHTML = "";
  [...state.bidHistory]
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach((bid) => {
      const li = document.createElement("li");
      const player = state.players.find((p) => p.id === bid.playerId);
      const name = player ? player.username : "Unknown";
      li.innerHTML = `<span>${name}</span><span>${formatCurrency(bid.amount)}</span>`;
      historyList.appendChild(li);
    });

  if (currentPlayerId) {
    const player = state.players.find((p) => p.id === currentPlayerId);
    if (player) {
      playerBalanceEl.textContent = formatCurrency(player.balance);
      playerLockedEl.textContent = formatCurrency(player.lockedBid);
    }
  }
};

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  joinError.textContent = "";
  const username = usernameInput.value.trim();
  if (!username) {
    joinError.textContent = "Please enter a username.";
    return;
  }
  socket.emit("join", { username });
});

bidForm.addEventListener("submit", (e) => {
  e.preventDefault();
  bidError.textContent = "";
  const amount = Number(bidInput.value);
  if (!currentPlayerId) {
    bidError.textContent = "Join the auction first.";
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    bidError.textContent = "Enter a valid bid amount.";
    return;
  }
  socket.emit("bid:place", { amount });
  bidInput.value = "";
});

socket.on("join:success", ({ player, state }) => {
  currentPlayerId = player.id;
  joinForm.querySelector("button").disabled = true;
  usernameInput.disabled = true;
  renderState(state);
});

socket.on("join:error", ({ message }) => {
  joinError.textContent = message || "Unable to join.";
});

socket.on("bid:error", ({ message }) => {
  bidError.textContent = message || "Bid rejected.";
});

socket.on("state:update", (state) => {
  renderState(state);
});

socket.on("connect_error", () => {
  bidError.textContent = "Connection lost. Retry...";
});

