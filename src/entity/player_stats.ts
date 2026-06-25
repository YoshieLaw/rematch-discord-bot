/**
 * The Data Transfer Object (DTO) populated by your OCR Parser module.
 * Represents an unmapped string username alongside transient raw in-game stats.
 */
export interface PlayerStats {
  username: string;
  goals: number;
  assists: number;
  passes: number;
  interceptions: number;
  saves: number;
}