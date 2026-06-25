export interface MatchPerformance {
  /** Auto-generated unique string or ObjectId for this specific match log entry */
  _id?: string;           
  /** Relational foreign key linking this performance back to the PlayerProfile */
  playerId: number;       
  /** Relational foreign key linking back to the master Match ID (_id from general_matches) */
  matchId: string;
  /** Track when the game happened */
  timestamp: Date;        
  /** Game-specific metrics */
  goals: number;
  assists: number;
  saves: number;
  passes: number;
  interceptions: number;
}