# Farm Auction - Gameplay Specification

## 1. Overview
The **Farm Auction** is a real-time multiplayer game where 10 teams compete to build the most valuable farm. An Admin controls the auction, while the Public can watch the action unfold live.

## 2. Roles & Credentials

### **Admin**
-   **Role:** Controls the game flow (Start/Stop auctions, Reveal animals, Manage Buybacks).
-   **Login:**
    -   **Username:** `admin`
    -   **Password:** `rriadmin`

### **Teams (Players)**
-   **Role:** Buy animals, manage budget, and aim for high farm value.
-   **Starting Budget:** $100
-   **Teams:** 10 Pre-defined teams (Team 1 - Team 10).
-   **Login:**
    -   **Selection:** Click "Team X" on home screen.
    -   **PIN:** Simple 3-digit code (e.g., `101` for Team 1).
    -   **Full List:** See `credentials.txt`.

### **Public (Audience)**
-   **Role:** Watch the auction and leaderboards in real-time. Cannot bid.
-   **Login:**
    -   **Username:** `public`
    -   **Password:** `public`

## 3. Game Flow

### **Phase 1: The Auction**
1.  **Start:** Admin selects an animal and starts the bidding.
2.  **Bidding:** Teams place bids. Real-time updates show total bids and highest bidder.
    -   **Rule:** Bids must be higher than current price + $1.
    -   **Rule:** Cannot bid more than wallet balance.
3.  **End:** Admin stops the auction.
    -   **Winner:** Highest bidder gets the animal.
    -   **Payment:** Amount is deducted from balance.

### **Phase 2: Use of Switch (Special)**
-   **Switch Auction:** Admin can set a "Switch Target" (e.g., Win a Cow, but switch for a Bull).
-   **Decision:** The winner gets a popup: "Keep Cow" or "Switch to Bull".

### **Phase 3: Buybacks**
-   **Offer:** Admin can offer to buy an animal BACK from a team for cash.
-   **Decision:** Team gets a popup to Accept (get cash, lose animal) or Reject.

## 4. Scoring System
-   **Base Values:** Every animal has a point value (e.g., Cow = 10pts).
-   **Pairs Bonus:** Having a matching Male + Female pair creates a "Complete Pair".
    -   **Bonus Calculation:** (Male Value + Female Value) ADDED to total.
    -   *Example:* Cow (10) + Bull (15) = 25 Base + 25 Bonus = **50 Points Total**.

## 5. Deployment
-   **Platform:** Render.com (Web Service)
-   **Capacity:** 512 MB Ram (Sufficient for 50+ concurrent users).
-   **Availability:** 24/7 (Sleeps after 15m inactivity).
