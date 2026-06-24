/**
 * Strips out OCR artifacts (like asterisks, pipes) and common team prefixes/tags 
 * to isolate the base name token for database lookup.
 * 
 * Example: "* BAR Allauni" -> "allauni"
 * Example: "GŁ 69 Outcast" -> "outcast"
 */
export function normalizeOcrName(rawName: string): string {
  return rawName
    .replace(/[*+?^${}()|[\]\\#@!]/g, ' ') // Remove special OCR artifact characters
    .replace(/\bBAR\b/i, '')               // Strip common team prefix "BAR"
    .replace(/\bGŁ\b/i, '')               // Strip common team prefix "GŁ"
    .replace(/\s+/g, ' ')                  // Collapse multiple spaces
    .trim()
    .toLowerCase();                        // Lowercase for case-insensitive matching
}

/**
 * Interface representing your Nicknames lookup collection document
 */
export interface NicknameDoc {
  _id: string;      // The normalized lowercase nickname string (e.g., "allauni")
  playerId: number;  // Relates back to the main Player profile document ID
}

/**
 * Mocking a database lookup function to illustrate the workflow.
 * When you connect MongoDB/Firestore, this will be a direct indexed Key-Value fetch.
 */
export async function findPlayerIdByNickname(
  normalizedName: string, 
  mockNicknameDb: NicknameDoc[]
): Promise<number | null> {
  // In your actual DB code, this becomes something simple like:
  // const record = await db.collection('nicknames').findOne({ _id: normalizedName });
  // return record ? record.playerId : null;
  
  const match = mockNicknameDb.find(doc => doc._id === normalizedName);
  return match ? match.playerId : null;
}