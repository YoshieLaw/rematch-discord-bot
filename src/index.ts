// src/index.ts
import { Client, GatewayIntentBits, Message } from 'discord.js';
import 'dotenv/config';
import { extractTextFromUrl, parseOcrTable } from './services/parser.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', (readyClient) => {
  console.log(`✅ Success! Parser Testing Bot is online as: ${readyClient.user.tag}`);
});

client.on('messageCreate', async (message: Message): Promise<void> => {
  if (message.author.bot) return;

  const command = message.content.toLowerCase().trim();

  if (command === '!ping') {
    await message.reply('🏓 Pong! Bot is listening.');
    return;
  }

  // Parsed Stats Test
  if (command.startsWith('!submit')) {
    const attachment = message.attachments.first();

    if (!attachment) {
      await message.reply('❌ Please attach a screenshot file alongside your `!submit` command.');
      return;
    }

    const isImage = attachment.contentType?.startsWith('image/');
    if (!isImage) {
      await message.reply('❌ The attached file must be an image format (PNG or JPEG).');
      return;
    }

    const statusMessage = await message.reply('⏳ Step 1/2: Extracting text via OCR.space...');

    try {
      // 1. Extract the raw text from the image URL
      const rawTextOutput = await extractTextFromUrl(attachment.url);
      
      await statusMessage.edit('⏳ Step 2/2: Feeding text into the sliding-window parser...');

      // 2. Parse the text using our tokenizing algorithm
      const parsedPlayers = parseOcrTable(rawTextOutput);

      // 3. Format the structured output array nicely for Discord
      if (parsedPlayers.length === 0) {
        await statusMessage.edit('⚠️ OCR ran successfully, but the parser couldn\'t find any player stats matching the expected score windows.');
        return;
      }

      let responseLines = ['✅ **Successfully Parsed Player Stats!**\n'];
      
      parsedPlayers.forEach((player) => {
        responseLines.push(
          `👤 **${player.username}**` +
          `\n   ↳ Goals: \`${player.goals}\` | Assists: \`${player.assists}\` | Passes: \`${player.passes}\` | Interceptions: \`${player.interceptions}\` | Saves: \`${player.saves}\``
        );
      });

      const finalResponse = responseLines.join('\n');
      
      // If the message is somehow too long for Discord's 2000 character limit, wrap it safe
      if (finalResponse.length > 2000) {
        await statusMessage.edit('✅ Stats parsed! (Output too long for standard text, printing fallback JSON):');
        await message.channel.send(`\`\`\`json\n${JSON.stringify(parsedPlayers, null, 2)}\n\`\`\``);
      } else {
        await statusMessage.edit(finalResponse);
      }

    } catch (error) {
      console.error('Parser Test Failed:', error);
      await statusMessage.edit('❌ Failed to process match screenshot. Check your local console logs.');
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is missing inside your .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);