// src/index.ts
import { Client, GatewayIntentBits, Message } from 'discord.js';
import 'dotenv/config';

// Initialize the Discord Client with required permissions
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Triggers once when the bot successfully logs in
client.once('ready', (readyClient) => {
  console.log(`✅ Success! Bot is online and logged in as: ${readyClient.user.tag}`);
});

// Triggers whenever someone sends a text message
client.on('messageCreate', async (message: Message): Promise<void> => {
  // Ignore bots to avoid infinite response loops
  if (message.author.bot) return;

  // Simple ping-pong check
  if (message.content.toLowerCase() === '!ping') {
    await message.reply('🏓 Pong! TypeScript environment is responding perfectly.');
  }
});

// Safely log the bot in using your token
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is missing in your .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);