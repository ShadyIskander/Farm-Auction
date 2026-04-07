# Farm Auction - Digitalized

A multiplayer team-based auction game where teams compete to acquire animals and build the most valuable farm through strategic bidding and pair completion.

## Features

- **Three Separate Interfaces**:
  - **User Interface** (`/user.html`): Team login, farm management, and bidding
  - **Admin Interface** (`/admin.html`): Game control, auction management
  - **Public Display** (`/public.html`): Large-screen presentation view

- **Animal System**: 10 animals with fixed genders and base values
- **Pair Bonuses**: Owning both male and female of the same species doubles their combined value
- **Three Auction Types**:
  - Normal Auction: Animal visible during bidding
  - Blind Auction: Animal hidden until reveal
  - Normal + Switch: Winner can accept or switch to another animal

- **Real-time Updates**: Live bidding and state synchronization via Socket.IO
- **Farm Value Calculation**: Automatic calculation including pair bonuses

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the server:
   ```bash
   npm run build
   ```

3. Start the server:
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

4. Open the game:
   - Landing page: `http://localhost:3000`
   - Team interface: `http://localhost:3000/user.html`
   - Admin interface: `http://localhost:3000/admin.html`
   - Public display: `http://localhost:3000/public.html`

## Game Rules

### Starting Setup
- Each team starts with **$100 points**
- Maximum **10 teams** can register
- Teams register with username and password

### Animals

| Animal | Gender | Base Value |
|--------|--------|------------|
| Cow | Female | $10 |
| Bull | Male | $15 |
| Goat | Female | $5 |
| Sheep | Male | $10 |
| Chicken | Female | $3 |
| Rooster | Male | $5 |
| Doe | Female | $8 |
| Buck | Male | $12 |
| Cat | Female | $4 |
| Dog | Male | $6 |

### Pair Bonus System

If a team owns both the male and female of the same species, the combined value of that pair is **doubled**.

**Example:**
- Individual: Cow ($10) + Bull ($15) = $25
- With pair bonus: $25 × 2 = **$50**

### Auction Types

1. **Normal Auction**
   - Animal is visible on podium
   - Standard open bidding
   - Highest bidder wins immediately

2. **Blind Auction**
   - Animal is hidden (mystery box shown)
   - Teams bid without knowing the animal
   - Animal is revealed after auction ends

3. **Normal + Switch Auction**
   - Animal is visible during bidding
   - After winning, winner chooses:
     - Accept the animal
     - Switch to any other animal (30 second time limit)

### Admin Controls

**Default Admin Password:** `admin`

Admin can:
- Start auctions (select animal, set price, choose type)
- Stop auctions (awards animal to highest bidder)
- Cancel auctions (no winner, bids returned)
- View all teams and statistics

## Project Structure

```
├── server/
│   └── src/
│       ├── types.ts          # TypeScript type definitions
│       ├── gameState.ts      # Game logic and state management
│       └── server.ts         # Express + Socket.IO server
├── public/
│   ├── index.html            # Landing page
│   ├── user.html             # Team interface
│   ├── user.js               # Team interface logic
│   ├── admin.html            # Admin interface
│   ├── admin.js              # Admin interface logic
│   ├── public.html           # Public display
│   ├── public.js             # Public display logic
│   └── styles.css            # Shared styles
├── dist/                     # Compiled JavaScript (generated)
└── GAMEPLAY_SPECIFICATION.md # Detailed gameplay specification
```

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

This compiles TypeScript and starts the server.

## Gameplay Flow

1. **Setup**: Admin logs in, teams register/login
2. **Auction**: Admin starts an auction with selected animal/type/price
3. **Bidding**: Teams place bids in real-time
4. **Award**: Admin stops auction, animal goes to highest bidder
5. **Switch** (if applicable): Winner chooses accept/switch
6. **Repeat**: Admin starts next auction
7. **End Game**: Team with highest farm value wins

## Technical Details

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: Vanilla JavaScript (no framework)
- **Language**: TypeScript (server), JavaScript (client)
- **Real-time**: Socket.IO for bidirectional communication
- **State Management**: Authoritative server, clients receive state updates

## Security Notes

- Password hashing is simplified for demo purposes
- In production, use bcrypt for password hashing
- Implement rate limiting for bid submissions
- Add session management and CSRF protection
- Validate all inputs server-side

## License

This project is open source and available for educational purposes.
