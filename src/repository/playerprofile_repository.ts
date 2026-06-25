import { getDb } from '../services/db.js';
import { PlayerProfile } from '../entity/player_profile.js';

// Define the shape of the incoming match stats we want to increment
export interface IncomingMatchDelta {
  goals: number;
  assists: number;
  saves: number;
  passes: number;
  interceptions: number;
}

const MONGO_PLAYERS_DB_NAME = 'players';

export class PlayerProfileRepository {
  private get collection() {
    return getDb().collection<PlayerProfile>(MONGO_PLAYERS_DB_NAME);
  }

  async findProfile(playerId: number): Promise<PlayerProfile | null> {
    const doc = await this.collection.findOne({ _id: playerId });
    return doc ? doc : null;
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    await this.collection.updateOne(
      { _id: profile._id },
      { 
        $set: { discordProfile: profile.discordProfile }, 
        $addToSet: { nicknames: { $each: profile.nicknames } } 
      },
      { upsert: true }
    );
  }

  /**
   * Atomically increments a player's career lifetime totals.
   * If a field doesn't exist yet, MongoDB will create it automatically starting at 0.
   */
  async incrementCareerStats(playerId: number, delta: IncomingMatchDelta): Promise<void> {
    await this.collection.updateOne(
      { _id: playerId },
      {
        $inc: {
          'careerStats.goals': delta.goals,
          'careerStats.assists': delta.assists,
          'careerStats.saves': delta.saves,
          'careerStats.passes': delta.passes,
          'careerStats.interceptions': delta.interceptions,
          'careerStats.matchesPlayed': 1 // Automatically bumps their total games played by 1
        }
      }
    );
  }

  async updateDiscordProfile(playerId:number, discordId:string): Promise<void> {
    await this.collection.updateOne(
      {_id: playerId},
      {
        $set: {discordProfile:discordId}
      }
    )
  }

  async findProfileByDiscordId(discordId: string): Promise<PlayerProfile | null> {
    return await this.collection.findOne({ discordProfile: discordId });
  }

  /**
   * Appends an array of new unique nicknames to an existing player profile document.
   * Uses $addToSet to prevent duplicate strings within the document's array field.
   * * @param playerId The internal unique numerical ID (_id) of the player
   * @param newNicknames An array of cleaned, normalized lowercase nicknames to append
   */
  async addNicknamesToProfile(playerId: number, newNicknames: string[]): Promise<void> {
    await this.collection.updateOne(
      { _id: playerId },
      { 
        $addToSet: { 
          nicknames: { $each: newNicknames } 
        } 
      }
    );
  }

  /**
   * Fetches all player profiles from the database
   */
  async getAllProfiles(): Promise<PlayerProfile[]> {
    return await this.collection.find({}).toArray();
  }
}