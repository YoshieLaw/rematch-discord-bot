import { PlayerStats } from '../entity/player_stats.js';


/**
 * Parses the text output string from OCR Space into structured player objects.
 * @param tableText Raw text string containing the player data layout
 */
export function parseOcrTable(tableText: string): PlayerStats[] {
  // 1. Fix fused prefix issues from tight column boundaries (e.g., "BARTotally" -> "BAR Totally")
  let preCleanedText = tableText
    .replace(/\bBAR(?=[A-Z0-9])/g, 'BAR ')
    .replace(/\bGŁ(?=[0-9])/g, 'GŁ ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = preCleanedText.split(' ');
  const playersData: PlayerStats[] = [];

  // Loop through tokens to find score milestones
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isScore = /^\d[\d,]*$/.test(token);
    const scoreVal = parseInt(token.replace(/,/g, ''), 10);
    
    // Core player scores are between 100 and 25000
    if (isScore && scoreVal >= 100 && scoreVal <= 25000) {
      
      // Filter out 'Total match' score summaries by scanning 8 tokens back
      let isTotalMatch = false;
      for (let check = Math.max(0, i - 8); check < i; check++) {
        if (tokens[check]?.toLowerCase() === 'total' || tokens[check]?.toLowerCase() === 'match') {
          isTotalMatch = true;
          break;
        }
      }
      
      if (isTotalMatch) continue;

      try {
        // Collect exactly the 5 numeric game stats right before this score milestone
        const numericStats: number[] = [];
        let walkIdx = i - 1;

        while (walkIdx >= 0 && numericStats.length < 5) {
          const currentTok = tokens[walkIdx];
          
          // Only stop hunting stats if we hit hard macro team/match boundaries
          if (['HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'TOTAL', 'MATCH'].includes(currentTok.toUpperCase())) {
            break;
          }

          if (/^\d+$/.test(currentTok)) {
            numericStats.unshift(parseInt(currentTok, 10));
          }
          walkIdx--;
        }

        // If we successfully found the 5 core performance metrics, process the player name
        if (numericStats.length === 5) {
          const goals = numericStats[0];
          const assists = numericStats[1];
          const passes = numericStats[2];
          const interceptions = numericStats[3];
          const saves = numericStats[4];

          // The name starts to the left of the collected stats index
          let nameEndIdx = walkIdx;

          // Bypass an isolated single-or-double digit jersey number if present right before stats
          const potentialJersey = tokens[nameEndIdx];
          if (potentialJersey && /^\d+$/.test(potentialJersey) && potentialJersey.length <= 2) {
            nameEndIdx--;
          }

          // Gather name parts going backward until running into previous scores or clear team blocks
          let nameStartIdx = nameEndIdx;
          while (nameStartIdx > 0) {
            const prevToken = tokens[nameStartIdx - 1];
            const prevTokenIsNum = /^\d[\d,]*$/.test(prevToken);
            const prevTokenVal = parseInt(prevToken.replace(/,/g, ''), 10);

            if (
              (prevTokenIsNum && prevTokenVal >= 100) || 
              ['HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'TOTAL', 'MATCH'].includes(prevToken.toUpperCase()) ||
              prevToken.includes('>')
            ) {
              break;
            }
            nameStartIdx--;
          }

          // Filter out header labels if they bleed into the player name tokens array slice
          const nameTokens = tokens.slice(nameStartIdx, nameEndIdx + 1).filter(tok => {
            return !['>', 'HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'GOAL', 'ASSIST', 'PASS', 'INTERCEPTION', 'SAVE', 'SCORE'].includes(tok.toUpperCase());
          });

          const rawName = nameTokens.join(' ');
          const username = rawName.replace(/\s*mvp\s*★?/i, '').replace(/★/g, '').trim();

          // Reject boilerplate structural noise and summary rows explicitly
          if (
            username && 
            username.toLowerCase() !== 'player' && 
            username.toLowerCase() !== 'match' && 
            username.toLowerCase() !== 'total'
          ) {
            playersData.push({ username, goals, assists, passes, interceptions, saves });
          }
        }
      } catch (err) {
        console.error('Failed backward processing on player milestone:', err);
      }
    }
  }

  return playersData;
}