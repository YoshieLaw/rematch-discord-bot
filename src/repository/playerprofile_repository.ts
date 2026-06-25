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

export class PlayerProfileRepository {
  private get collection() {
    return getDb().collection<PlayerProfile>('players');
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

  async updateDiscordProfile(playerId:number, discordId:string) {
    await this.collection.updateOne(
      {_id: playerId},
      {
        $set: {discordProfile:discordId}
      }
    )
  }
}