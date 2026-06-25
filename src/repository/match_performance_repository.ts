import { getDb } from '../services/db.js';
import { MatchPerformance } from '../entity/match_performance.js';


const MONGO_MATCH_PERFORMANCE_DB_NAME = 'match_performances';

export class MatchPerformanceRepository {
  private get collection() {
    // db named match_performances
    return getDb().collection<MatchPerformance>(MONGO_MATCH_PERFORMANCE_DB_NAME);
  }

  async recordMatch(performance: MatchPerformance): Promise<void> {
    await this.collection.insertOne(performance);
  }

  async findMatchesByPlayer(playerId: number): Promise<MatchPerformance[]> {
    return await this.collection
      .find({ playerId })
      .sort({ timestamp: -1 })
      .toArray();
  }
}