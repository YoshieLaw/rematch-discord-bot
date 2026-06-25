export interface Match {
  _id: string;        // The matchId extracted from the filename (e.g., "game_123")
  fileName: string;   // The raw filename (e.g., "game_123.png")
  imageHash: string;  // The unique SHA-256 byte signature 
  uploadedAt: Date;   // Timestamp of submission
  uploadedBy: string; // The Discord user ID snowflake
}