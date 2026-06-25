import { CareerStats } from "./career_stats.js";

/**
 * Core Player Profile Document structure stored inside your NoSQL database.
 * Represents the master identity state for a specific player.
 */
export interface PlayerProfile {
  _id: number;             
  nicknames: string[];     
  discordProfile: string | null;
  careerStats: CareerStats;
}