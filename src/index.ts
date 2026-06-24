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

client.on('messageCreate', async (message: Message): Promise<void> => {
  if (message.author.bot) return;

  const command = message.content.toLowerCase().trim();

  // Handle the !submit command
  if (command.startsWith('!submit')) {
    // Look for the first file attached to the user's message
    const attachment = message.attachments.first();

    // 1. Guard Clause: Verify an attachment actually exists
    if (!attachment) {
      await message.reply('❌ Please attach your postgame screenshot when using the `!submit` command.');
      return;
    }

    // 2. Guard Clause: Check if the file type is an image
    // The contentType will look like 'image/png' or 'image/jpeg'
    const isImage = attachment.contentType?.startsWith('image/');
    if (!isImage) {
      await message.reply('❌ The attached file must be an image (PNG or JPEG).');
      return;
    }

    // 3. Extract the image URL hosted on Discord's CDN servers
    const imageUrl = attachment.url;

    // Temporal response confirming the bot grabbed the file link successfully
    await message.reply(`📸 Image detected! I successfully found the image file: **${attachment.name}**.\nURL link: <${imageUrl}>`);
    
    // TODO: Phase 3 will send this imageUrl directly to the OCR.space API
  }

  if (command === '!ping') {
    await message.reply('🏓 Pong!');
  }
});

// Safely log the bot in using your token
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is missing in your .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);