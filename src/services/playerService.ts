import { PlayerProfileRepository } from '../repository/playerprofile_repository.js';
import { NicknameMappingRepository } from '../repository/nickname_repository.js';
import { PlayerProfile } from '../entity/player_profile.js';
import { getDb } from '../services/db.js';
import { PlayerStats } from '../entity/player_stats.js';

export class PlayerService {
  private playerRepo = new PlayerProfileRepository();
  private nicknameRepo = new NicknameMappingRepository();

  /**
   * Processes a list of parsed scoreboard rows, handles profile creation 
   * for unregistered names, and increments lifetime career statistics.
   * @returns A map matching the player's raw scoreboard name to their internal unique numerical ID.
   */
  async processMatchPlayers(parsedPlayers: PlayerStats[]): Promise<Map<string, number>> {
    const nameToIdMap = new Map<string, number>();

    for (const playerRow of parsedPlayers) {
      // 1. Clean out standard 3-letter club prefixes (like BAR) or bracket tags, plus garbage characters
      let cleanName = playerRow.username
        .replace(/\b[A-Z]{3}\b/g, '') // Strips standalone 3-letter capital words like "BAR"
        .replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters, preserving numbers and letters

      const normalizedNick = cleanName.toLowerCase().trim();
      // If name is invalid or empty, skip it
      if (!normalizedNick) continue;

      // 2. Query our inverted lookup table to find an existing Master Player ID
      let playerId = await this.nicknameRepo.findPlayerId(normalizedNick);

      // 3. Do a check with the if the nickname has a regex pattern match to another existing nickname
      // If not, create a new profile
      if (playerId === null) {
        
        playerId = await this.nicknameRepo.findFuzzyPlayerId(normalizedNick);

        if (playerId !== null) {
          console.log(`🎯 Fuzzy identity link discovered! "${playerRow.username}" matched to existing Player ID: ${playerId}`);
          
          // Auto-register this new structural variation so next time it runs instantly via exact match
          await this.playerRepo.addNicknamesToProfile(playerId, [normalizedNick]);
          await this.nicknameRepo.registerNickname(normalizedNick, playerId);
        } else {
          console.log(`✨ Unrecognized identity found for "${playerRow.username}". Generating new profile...`);
          
          // Generate a new sequential unique integer ID using MongoDB atomic counters
          playerId = await this.getNextSequenceId('player_id_sequence');

          // Initialize a clean, empty master profile for them
          await this.playerRepo.saveProfile({
            _id: playerId,
            nicknames: [normalizedNick],
            discordProfile: '', // To be optionally linked by the user later via an account link command
            careerStats: {
              goals: 0,
              assists: 0,
              saves: 0,
              passes: 0,
              interceptions: 0,
              matchesPlayed: 0
            }
          });

          // Register their initial nickname mapping so future matches find this ID
          await this.nicknameRepo.registerNickname(normalizedNick, playerId);
        }
      }

      // 4. Update their cumulative lifetime career statistics atomically
      await this.playerRepo.incrementCareerStats(playerId, {
        goals: playerRow.goals,
        assists: playerRow.assists,
        saves: playerRow.saves,
        passes: playerRow.passes,
        interceptions: playerRow.interceptions
      });

      // Keep track of the resolved ID so Step 4/5 can use it to log individual match history rows
      nameToIdMap.set(playerRow.username, playerId);
    }

    return nameToIdMap;
  }

  /**
   * Helper to generate a sequential integer ID using a counters collection
   */
  private async getNextSequenceId(sequenceName: string): Promise<number> {
    // 1. Define the internal schema layout for our counter documents
    interface CounterDoc {
      _id: string;
      seq: number;
    }

    // 2. Pass the interface into the collection so TypeScript knows what fields exist
    const counterCollection = getDb().collection<CounterDoc>('counters');
    
    const result = await counterCollection.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    // 3. Fallback check: If for some reason the result is null, start at 1
    if (!result) {
      throw new Error(`🛑 Failed to generate a sequential tracking ID for sequence: ${sequenceName}`);
    }

    return result.seq;
  }

  /**
   * Links a Discord Profile ID to an existing Player ID.
   * If the player ID is not found, it initializes a brand-new profile document.
   * 
   * @param playerId The unique numeric ID assigned to the player profile
   * @param discordId The raw numeric string ID of the Discord account
   * @returns An object indicating if a new profile was created, along with the action status.
   */
  async registerDiscordProfile(playerId: number, discordId: string): Promise<{ isNew: boolean }> {
    // 1. Check if a profile already exists for this numeric ID
    // Note: Assuming your repository exposes a method like findById, or you can query it via your DB handler
    const existingProfile = await this.playerRepo.findProfile(playerId); 
    
    if (!existingProfile) {
      // 2. Step 2: Fallback to creating a new profile if the ID doesn't exist
      console.log(`✨ Creating a clean skeleton profile for new Player ID: ${playerId} with Discord tag link.`);
      
      await this.playerRepo.saveProfile({
        _id: playerId,
        nicknames: [], // Empty initially; will fill when they show up on scoreboards
        discordProfile: discordId, // Store the linked profile ID string directly
        careerStats: {
          goals: 0,
          assists: 0,
          saves: 0,
          passes: 0,
          interceptions: 0,
          matchesPlayed: 0
        }
      });
      
      return { isNew: true };
    }

    // 3. Step 3: Update the player row with the correct discord profile id
    // Note: Assuming you add an update field method or can utilize your save/update pipeline
    console.log(`✨ Updating existing Player ID: ${playerId} with Discord Profile ID: ${discordId}`);
    await this.playerRepo.updateDiscordProfile(playerId, discordId);
    
    return { isNew: false };
  }

  /**
   * Finds a player profile by either Player ID or Discord ID, appends unique 
   * new nicknames, and registers those mappings in the nicknames database.
   * * @param identifier Can be a numeric string Player ID or a numeric string Discord ID
   * @param rawNicknames Array of new nicknames to attach
   * @returns Object with the updated profile, or null if no profile was found
   */
  async addPlayerNicknames(identifier: string, rawNicknames: string[]): Promise<{ updatedProfile: any; addedCount: number } | null> {
    let masterProfile: PlayerProfile | null = null;

    // 1. Differentiate between an internal Player ID and a Discord Snowflake
    // If it's a long Snowflake string (typically 17-19 digits), look it up via the new repo method
    if (/^\d+$/.test(identifier) && identifier.length >= 17) {
      masterProfile = await this.playerRepo.findProfileByDiscordId(identifier);
    } else {
      // Otherwise, treat it as your sequential base-10 numerical Player ID
      const playerId:number = parseInt(identifier, 10);
      if (!isNaN(playerId)) {
        masterProfile = await this.playerRepo.findProfile(playerId); // Uses your existing find helper
      }
    }

    // If no profile could be located by either lookup strategy, bail out early
    if (!masterProfile) return null;

    const playerId:number = masterProfile._id;

    // 2. Normalize inputs down to lowercase alphanumeric strings
    const cleanNicks:string[] = rawNicknames
      .map(n => n.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim())
      .filter(n => n.length > 0);

    // 3. Filter out nicknames the player already has inside their master profile array
    const existingNicks:string[] = masterProfile.nicknames || [];
    const newNicksToRegister = cleanNicks.filter(n => !existingNicks.includes(n));

    if (newNicksToRegister.length > 0) {
      // Append the new nicknames atomically into the player profile document
      await this.playerRepo.addNicknamesToProfile(playerId, newNicksToRegister)

      // Insert the reverse lookup mappings inside your Inverted Index nicknames collection
      for (const nick of newNicksToRegister) {
        await this.nicknameRepo.registerNickname(nick, playerId);
      }
    }

    // Fetch a fresh document snapshot to return to the command block
    const updatedProfile = await this.playerRepo.findProfile(playerId);

    return {
      updatedProfile,
      addedCount: newNicksToRegister.length
    };
  }

  /**
   * Retrieves all registered player profiles from the underlying repository.
   * @returns Array of master player profile documents
   */
  async getAllPlayers(): Promise<PlayerProfile[]> {
    return await this.playerRepo.getAllProfiles();
  }
}