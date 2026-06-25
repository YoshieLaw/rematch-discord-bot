import { getDb } from '../services/db.js';
import { MatchPerformance } from '../entity/match_performance.js';

export class MatchPerformanceRepository {
  private get collection() {
    // db named match_performances
    return getDb().collection<MatchPerformance>('match_performances');
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