# Deployment Guide (Free Tier)

This guide walks you through deploying your Farm Auction game to **Render.com** for free.

## 1. Prerequisites
-   A **GitHub** account.
-   Your code needs to be pushed to a GitHub repository.

## 2. Setting up Render
1.  Go to [Render.com](https://render.com) and sign up (login with GitHub is easiest).
2.  On the dashboard, click the **New +** button and select **Web Service**.
3.  Connect your GitHub repository.

## 3. Configuration
Render will ask for some settings. Use these EXACT values:

-   **Name:** `farm-auction` (or whatever you like)
-   **Region:** Choose the one closest to you (e.g., Frankfurt or Singapore).
-   **Branch:** `main` (or `master`)
-   **Root Directory:** (Leave blank)
-   **Runtime:** `Node`
-   **Build Command:** `npm install && npm run build`
-   **Start Command:** `npm start`
-   **Instance Type:** **Free**

Click **Create Web Service**.

## 4. Deploying
Render will start building your app. It might take 2-3 minutes.
-   Watch the logs. You should see `Build successful` and then `Farm Auction server running on...`.
-   Once active, you will see your URL at the top left (e.g., `https://farm-auction.onrender.com`).

## 5. IMPORTANT: The "Sleep" Timer
Because this is the **Free Tier**:
-   If no one visits the site for **15 minutes**, Render puts the server to "sleep".
-   **To Wake it Up:** Simply open the URL.
-   **Wait Time:** The *first* load after sleeping will take **~50-60 seconds**.
-   **Pro Tip:** Open the link yourself 2 minutes before you start the game to wake it up. Then it will be fast for everyone else.

## 6. How to Play
1.  **Admin:** Open the URL on your laptop. Log in as **Admin**.
2.  **Screen:** Project your laptop screen or share it so everyone can see the main Auction display.
3.  **Teams:** Send the link to your players. They open it on their phones, click their Team Name (Team 1, Team 2, etc.), and enter their PIN.
