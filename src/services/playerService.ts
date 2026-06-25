// src/service/playerService.ts
import { PlayerProfileRepository } from '../repository/playerprofile_repository.js';
import { NicknameMappingRepository } from '../repository/nickname_repository.js';
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

      // 3. Fallback: If no mapping exists, create a brand-new player identity
      if (playerId === null) {
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
}