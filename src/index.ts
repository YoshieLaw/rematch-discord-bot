// src/index.ts
import { Attachment, Client, GatewayIntentBits, Message } from 'discord.js';
import 'dotenv/config';
import { parseOcrTable } from './services/parser.js';
import { OcrDataProvider } from './services/DataProvider/ocrProvider.js';
import { MatchRepository } from './repository/match_repository.js';
import { MatchPerformanceRepository } from './repository/match_performance_repository.js';
import { PlayerProfileRepository } from './repository/playerprofile_repository.js';
import { NicknameMappingRepository } from './repository/nickname_repository.js';
import { PlayerService } from './services/playerService.js';
import { ImageProcessingService } from './services/imageProcessingService.js';
import { connectDatabase } from './services/db.js';
import { Match } from './entity/match.js';

// Initialize our repository management pool
const matchRepo = new MatchRepository();
const performanceRepo = new MatchPerformanceRepository();


// Initilize Services
const playerService = new PlayerService();
const imageService = new ImageProcessingService();

// Instantiate the provider service once at system boot
const ocrProvider = new OcrDataProvider();

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

/**
 * Helper method to check if a screenshot is valid for processing.
 * @returns true if the screenshot is new and safe to process; false if it's a duplicate.
 */
async function getValidatedScreenshotHash(message: any, attachment: Attachment): Promise<string | null> {
  const IS_DUPLICATE_CHECK_ENABLED = process.env.DUPLICATE_CHECK_ENABLED === 'true';
  const imageHash = await imageService.generateImageHash(attachment.url);

  if (IS_DUPLICATE_CHECK_ENABLED) {
    
    const existingMatch = await matchRepo.findByHash(imageHash); 
      if (existingMatch) {
        await message.reply('⚠️ This exact screenshot has already been processed and logged!');
        return null;
      }
  }

  return imageHash; 
}

client.on('messageCreate', async (message: Message): Promise<void> => {
  if (message.author.bot) return;

  const command = message.content.toLowerCase().trim();

  if (command === '!ping') {
    await message.reply('🏓 Pong! Bot is listening.');
    return;
  }

  // Parsed Stats Test
  if (command.startsWith('!submit')) {
  // 1. Collect all attachments that are valid images
  const validAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/'));

  // Checks if at least one image was included
  if (validAttachments.size === 0) {
    await message.reply('❌ Please attach at least one screenshot file alongside your `!submit` command.');
    return;
  }

  // Create a single tracking message to keep the chat clean
  const statusMessage = await message.reply(`⏳ Initializing processing for **${validAttachments.size}** screenshot(s)...`);
  
  let successCount = 0;
  let skippedCount = 0;

  try {
    // 2. Loop through every single attachment sequentially
    for (const [attachmentId, attachment] of validAttachments) {
      const attachmentName = attachment.name || `unknown_${attachmentId}`;
      const matchId = attachmentName.split(".")[0];
      
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 1/5: Checking for duplicates & validating hash...`);

      // Checks if the screenshot has already been submitted 
      const imageHash = await getValidatedScreenshotHash(message, attachment);
      if (imageHash === null) {
        // Skip this specific screenshot since the helper already warned the user about a duplicate
        skippedCount++;
        continue; 
      }

      // Step 1 - Make the call to OCR endpoint
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 1/5: Fetching raw OCR text matrix...`);
      const rawTextOutput = await ocrProvider.extractTextFromUrl(attachment.url);
      
      // Step 2 - Parse the player logic out of it
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 2/5: Mapping tokens through parser implementation...`);
      const parsedPlayers = parseOcrTable(rawTextOutput);
      
      // Step 3 - Save the players data to the player by updating their career stats in the player profile
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 3/5: Saving players and updating their career stats...`);
      const playerIdentityMap = await playerService.processMatchPlayers(parsedPlayers);
      
      // Step 4 - Then save all the player's match performances to the match performance repo/table
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 4/5: Saving match and all player performances...`);

      for (const row of parsedPlayers) {
        // Retrieve the resolved numerical unique ID from our identity map using their raw username
        const targetPlayerId = playerIdentityMap.get(row.username);

        if (targetPlayerId !== undefined) {
          // Log this snapshot performance card directly into the match_performances ledger
          await performanceRepo.recordMatch({
            matchId: matchId, // Derived from attachment name, e.g., "game_1"
            playerId: targetPlayerId,
            timestamp: new Date(),
            goals: row.goals,
            assists: row.assists,
            saves: row.saves,
            passes: row.passes,
            interceptions: row.interceptions
          });
          
          console.log(`📊 Logged match performance card for player ID [${targetPlayerId}] (Match: ${matchId})`);
        } else {
          console.warn(`⚠️ Warning: Player identity map missing a reference for username: ${row.username}`);
        }
      }

      // Step 5 - Lock down the master match so it can't be uploaded again
      await statusMessage.edit(`⏳ **[File: ${attachmentName}]** Step 5/5: Finishing up final steps...`);

      const matchData: Match = {
        _id: matchId,              // Unique file identifier
        fileName: attachmentName,   // Filename
        imageHash: imageHash,       // Fixed: Passing down the unique hash signature generated in the helper!
        uploadedAt: new Date(),     
        uploadedBy: message.author.id, 
      };

      // Commit the parent record to the 'matches' collection
      await matchRepo.createMatchIfNew(matchData);
      
      successCount++;
    }

    // 3. Final completion status across all processed files
    let finalResponse = `✅ **Processing Complete!**\n• Successfully processed **${successCount}** match screenshots.`;
    if (skippedCount > 0) {
      finalResponse += `\n• Skipped **${skippedCount}** duplicate screenshots.`;
    }

    await statusMessage.edit(finalResponse);
    
  } catch (error) {
    console.error('Manual comparison execution failed:', error);
    await statusMessage.edit('❌ Processing failed mid-execution. Check your local application console logs.');
  }
}

  // Register Discord Profile to Player ID command
  if (command.startsWith('!registerExistingPlayer')) {
    // 1. Remove the prefix and separate the command and arguments
    const args = message.content.slice(1).trim().split(/ +/);

    if (args.length !== 3) {
      await message.reply('❌ Please make sure there are only 2 parameters passed into the `!registerExistingPlayer` command.');
      return;
    }
    const discordInput:string = args[1];
    const playerIdInput: number = parseInt(args[2], 10);

    // 2. Extract raw Discord ID if they used an @mention (looks like <@123456789>)
    const discordIdRegex = /^<@!?(\d+)>$/;
    const match = discordInput.match(discordIdRegex);
    const targetDiscordId = match ? match[1] : discordInput;


    // 3. Validation Guardrails
    if (!/^\d+$/.test(targetDiscordId)) {
      await message.reply('❌ **Error:** The first parameter must be a valid Discord mention or a raw numeric user ID.');
      return;
    }

    if (isNaN(playerIdInput)) {
      await message.reply('❌ **Error:** The player ID must be a valid number.');
      return;
    }

    try {
      // 4. Pass the extracted parameters straight into your PlayerService logic
      const result = await playerService.registerDiscordProfile(playerIdInput, targetDiscordId);

      if (result.isNew) {
        await message.reply(`🆕 **Profile Created:** Generated a new player profile for ID \`${playerIdInput}\` and linked it to <@${targetDiscordId}>.`);
      } else {
        await message.reply(`✅ **Profile Linked:** Player ID \`${playerIdInput}\` has been successfully updated to point to <@${targetDiscordId}>.`);
      }
    } catch (error) {
      console.error('Failed to register Discord profile link:', error);
      await message.reply('❌ An internal database error occurred while trying to save the registration.');
    }
  }

  // Register Nicknames to a Player or Discord Profile Command
  if (command.startsWith('!nickname')) {
    const args = message.content.slice(1).trim().split(/ +/);

    // Validation check: command + identifier + at least 1 nickname = length 3 minimum
    if (args.length < 3) {
      await message.reply('❌ **Invalid Usage:** Use `!nickname <@User or PlayerId> <nickname1> <nickname2> ...`');
      return;
    }

    const identityInput = args[1];
    // Gather all tokens from index 2 onwards as the list of nicknames
    const nicknamesList = args.slice(2); 

    // Clean raw input parameter down if it happens to be a Discord Mention tag 
    const discordIdRegex = /^<@!?(\d+)>$/;
    const match = identityInput.match(discordIdRegex);
    const TargetIdentifier = match ? match[1] : identityInput;

    try {
      // Pass the identifier and array directly over to the service layer
      const result = await playerService.addPlayerNicknames(TargetIdentifier, nicknamesList);

      if (!result) {
        await message.reply(`❌ **Profile Not Found:** Could not locate a player matching identifier token: \`${identityInput}\``);
        return;
      }

      if (result.addedCount === 0) {
        await message.reply(`ℹ️ All provided nicknames are already registered to Player ID \`${result.updatedProfile._id}\`.`);
      } else {
        await message.reply(`✅ **Nicknames Updated:** Successfully added **${result.addedCount}** new nickname(s) to Player ID \`${result.updatedProfile._id}\` and updated mapping records.`);
      }

    } catch (error) {
      console.error('Failed to append player nickname records:', error);
      await message.reply('❌ An internal error occurred while trying to save the nickname updates.');
    }
  }

  // Leaderboard Command
  if (command.startsWith('!leaderboard')) {
    const args = message.content.slice(1).trim().split(/ +/);
    
    // 1. Map out all 5 valid sorting metrics
    const validMetrics = ['goals', 'assists', 'saves', 'passes', 'interceptions'] as const;
    type MetricType = typeof validMetrics[number];

    let metric: MetricType = 'goals';
    const inputMetric = args[1]?.toLowerCase();

    if (validMetrics.includes(inputMetric as any)) {
      metric = inputMetric as MetricType;
    }

    try {
      const players = await playerService.getAllPlayers();

      if (players.length === 0) {
        await message.reply('ℹ️ No player profiles found to display on the leaderboard.');
        return;
      }

      // 2. Sort players descending based on chosen metric
      players.sort((a, b) => (b.careerStats[metric] || 0) - (a.careerStats[metric] || 0));

      // 3. Slice to Top 15 to stay safely under Discord's 2000 character ceiling
      const topPlayers = players.slice(0, 15);

      // 4. Build an expanded layout showing ALL stats side-by-side
      let leaderboardText = `🏆 **TOP 15 CAREER LEADERBOARD (${metric.toUpperCase()})** 🏆\n`;
      leaderboardText += '```\n';
      leaderboardText += 'Rank | Name         | Goals | Assist | Saves | Pass  | Int   \n';
      leaderboardText += '-------------------------------------------------------------\n';

      topPlayers.forEach((player, index) => {
        const rank = (index + 1).toString().padEnd(4, ' ');
        
        const nameStr = player.nicknames && player.nicknames.length > 0 
          ? player.nicknames[0] 
          : `Player ${player._id}`;
        const name = nameStr.substring(0, 12).padEnd(12, ' ');

        // Extract all 5 fields safely with fallbacks
        const g = (player.careerStats.goals || 0).toString().padEnd(5, ' ');
        const a = (player.careerStats.assists || 0).toString().padEnd(6, ' ');
        const s = (player.careerStats.saves || 0).toString().padEnd(5, ' ');
        const p = (player.careerStats.passes || 0).toString().padEnd(5, ' ');
        const i = (player.careerStats.interceptions || 0).toString().padEnd(5, ' ');

        leaderboardText += `${rank} | ${name} | ${g} | ${a} | ${s} | ${p} | ${i}\n`;
      });

      leaderboardText += '```\n';
      leaderboardText += `*Filter using: \`!leaderboard goals\`, \`assists\`, \`saves\`, \`passes\`, or \`interceptions\`*`;

      // 5. Safely ship it to Discord
      await message.reply(leaderboardText);

    } catch (error) {
      console.error('Failed to generate leaderboard:', error);
      await message.reply('❌ An error occurred while rendering the leaderboard.');
    }
  }
  
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN is missing inside your .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
async function startBot() {
  try {
    // 1. Force the database connection to complete FIRST
    console.log('🗄️ Connecting to MongoDB Atlas...');
    await connectDatabase();
    console.log('✅ Database connected successfully!');

    // 2. ONLY THEN log your Discord client in
    await client.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    console.error('❌ Failed to launch the application safely:', error);
    process.exit(1);
  }
}

// Fire the initialization routine
startBot();