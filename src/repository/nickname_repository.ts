import { getDb } from '../services/db.js';

/**
 * Interface representing the lookup document schema inside MongoDB
 */
export interface NicknameDocument {
  /** The normalized lowercase nickname string acting as the unique primary key */
  _id: string;      
  /** Relates back to the master PlayerProfile _id */
  playerId: number;  
}

export class NicknameMappingRepository {
  private get collection() {
    return getDb().collection<NicknameDocument>('nicknames');
  }

  /**
   * Performs an instant O(1) indexed key lookup using a normalized name string.
   * @returns The associated playerId, or null if no mapping exists.
   */
  async findPlayerId(normalizedNickname: string): Promise<number | null> {
    const record = await this.collection.findOne({ _id: normalizedNickname });
    return record ? record.playerId : null;
  }

  /**
   * Links a new nickname variation directly to a player profile ID.
   * Uses upsert to seamlessly handle inserts or updates.
   */
  async registerNickname(normalizedNickname: string, playerId: number): Promise<void> {
    await this.collection.updateOne(
      { _id: normalizedNickname },
      { $set: { playerId } },
      { upsert: true }
    );
  }

  /**
   * Removes a nickname mapping from the dictionary.
   */
  async removeNickname(normalizedNickname: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: normalizedNickname });
    return result.deletedCount > 0;
  }
}