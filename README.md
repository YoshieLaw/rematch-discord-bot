# 🤖 Rematch Match Tracker Discord Bot

A TypeScript-powered Discord Bot that extracts end-of-match stats from game screenshots using OCR processing, parses player metrics via layout anchoring algorithms, and links them instantly to a MongoDB database.

---

## 🕹️ Discord Bot Commands

All commands use the `!` prefix. Make sure parameters are separated by clean single spaces.

| Command | Arguments | Description | Example Usage |
| :--- | :--- | :--- | :--- |
| **`!register`** | `<@User/DiscordID>` `<PlayerID>` | Links a physical Discord user profile/snowflake to a master numerical sequential Player ID. | `!register @velops 23` |
| **`!nickname`** | `<Identifier>` `<Nicknames...>` | Appends one or many unique string aliases to a profile (accepts Player ID or Discord Snowflake). | `!nickname 23 barvelops velopsgk` |
| **`!submit`** | *(Requires Image Attachment)* | Uploads, validates, hashes, and parses score match screenshots through the OCR pipeline. | `!submit` *(with attached image)* |
| **`!leaderboard`** | `[metric]` | Renders a fixed monospace leaderboard grid of the top 15 players. Defaults to **goals**. | `!leaderboard assists` |

### 📊 Leaderboard Filtering Metrics
When calling the `!leaderboard` command, you can pass an optional secondary argument to re-sort the career statistics standings. The following filtering tokens are fully supported:

* `goals` *(Default)*
* `assists`
* `saves`
* `passes`
* `interceptions`

## 🛠️ Step 1: Get Your API Tokens

### 1. Discord Bot Token
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give your bot a name.
3. Navigate to the **Bot** tab on the left sidebar, click **Add Bot**, and click **Reset Token** to copy your secret string.
4. On the same page, scroll down to **Privileged Gateway Intents** and enable:
   * **Presence Intent**
   * **Server Members Intent**
   * **Message Content Intent** *(Critical for parsing text commands)*
5. Navigate to the **OAuth2** tab ➔ **URL Generator**. Check `bot` under scopes, check `Read Messages/View Channels` and `Send Messages` under permissions, then copy the link at the bottom to invite the bot to your server.

### 2. OCR.space API Key
1. Visit [OCR.space Free API Registration](https://ocr.space/ocrapi).
2. Enter your email to receive a free, instant API tier key via email (allows up to 25,000 free scans a month).

### 3. MongoDB Atlas Cloud URI
1. Register for a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Deploy a free **M0 Shared Cluster**.
3. Under Network Security, allow access from anywhere (`0.0.0.0/0`) during development.
4. Click **Connect** ➔ **Drivers** on your cluster dashboard and copy your connection string.

---

## ⚙️ Step 2: Local Project Setup

### 1. Clone & Install Dependencies
Open your project directory in your terminal and run:
```bash
npm install
```

### 2. Environment Configuration
Create a .env file in the root directory of your project and paste your keys exactly like this:
```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here

# Database Configuration
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/rematch_db?retryWrites=true&w=majority

# OCR Provider Configuration
OCR_API_KEY=your_ocr_space_or_provider_key_here
```

## 🚀 Step 3: Run the Bot
Run in Development Mode (Hot Reloading)
Monitors files for changes and restarts automatically:
```bash
npm run dev
```

## 🧪 Testing the Pipeline
Run this command on the [Sandbox discord server](https://discord.gg/wvQW5jBcN) when the bot is running:
```bash
!submit [Attach match screenshot here]
```