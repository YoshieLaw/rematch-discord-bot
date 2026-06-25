// src/repository/matchRepository.ts
import { getDb } from '../services/db.js';
import { Match } from '../entity/match.js';

export class MatchRepository {
  private get collection() {
    return getDb().collection<Match>('matches');
  }

  /**
   * Looks up a match by its exact filename string.
   */
  async findByFileName(fileName: string): Promise<Match | null> {
    const doc = await this.collection.findOne({ fileName });
    return doc ? doc : null;
  }

  /**
   * Attempts to insert a new master match record.
   * Returns true if saved successfully; false if it breaks uniqueness (_id collision).
   */
  async createMatchIfNew(match: Match): Promise<boolean> {
    try {
      await this.collection.insertOne(match);
      return true;
    } catch (error: any) {
      if (error.code === 11000) {
        return false; 
      }
      throw error;
    }
  }

  /**
   * Looks up a match record using its unique SHA-256 image byte hash.
   * Used by the gatekeeper phase to block identical screenshot uploads.
   */
  async findByHash(imageHash: string): Promise<Match | null> {
    const doc = await this.collection.findOne({ imageHash });
    return doc ? doc : null;
  }
}