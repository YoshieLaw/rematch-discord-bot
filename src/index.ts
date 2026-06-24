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
    if (!attachment || !attachment.contentType?.startsWith('image/')) {
      await message.reply('❌ Please attach a screenshot file alongside your `!submit` command.');
      return;
    }

    const statusMessage = await message.reply('⏳ Step 1/2: Fetching raw OCR text matrix...');

    try {
      // 1. Extract the raw text directly from the API response
      const rawTextOutput = await extractTextFromUrl(attachment.url);
      
      await statusMessage.edit('⏳ Step 2/2: Mapping tokens through parser implementation...');

      // 2. Pass the text to your sliding-window parsing logic
      const parsedPlayers = parseOcrTable(rawTextOutput);

      // 3. Construct the dual comparison payload blocks
      const rawTextSegment = `📝 **RAW OCR SPACE API RESPONSE:**\n\`\`\`text\n${rawTextOutput || '[Empty String Returned]'}\n\`\`\``;
      const parsedJsonSegment = `📊 **POST-PARSED RESULT OBJECTS ARRAY:**\n\`\`\`json\n${JSON.stringify(parsedPlayers, null, 2)}\n\`\`\``;

      // Clean up the initial status message wrapper
      await statusMessage.delete().catch(() => {});

      // Send the raw data blocks sequentially to bypass Discord's 2000 character limit ceiling safely
      await message.channel.send(rawTextSegment);
      await message.channel.send(parsedJsonSegment);

    } catch (error) {
      console.error('Manual comparison execution failed:', error);
      await statusMessage.edit('❌ Processing failed. Check your local application console logs.');
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is missing inside your .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);