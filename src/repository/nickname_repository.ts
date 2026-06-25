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

const MONGO_NICKNAME_DB_NAME = 'nicknames';

export class NicknameMappingRepository {
  private get collection() {
    return getDb().collection<NicknameDocument>(MONGO_NICKNAME_DB_NAME);
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

  /**
   * Scans the nicknames collection to find any existing nickname that is a substring 
   * of the incoming name, or vice versa.
   * @returns The matching playerId number, or null if no fuzzy match exists.
   */
  async findFuzzyPlayerId(normalizedNick: string): Promise<number | null> {
    // We query for any document where the nickname (_id) is contained within the incoming name,
    // OR where the nickname contains the incoming name.
    // Using MongoDB's $expr allows us to do a substring match against the document's own _id string.
    const match = await this.collection.findOne({
      $or: [
        // Case A: The existing nickname is hidden inside the incoming text
        { $expr: { $regexMatch: { input: normalizedNick, regex: "$_id" } } },
        // Case B: The incoming text is a shorter substring of an existing nickname
        { _id: { $regex: normalizedNick } }
      ]
    });

    return match ? match.playerId : null;
  }
}