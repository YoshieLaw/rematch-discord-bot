import { PlayerStats } from '../entity/player_stats.js';

/**
 * Parses the text output string from OCR Space into structured player objects.
 * Accounts for inline layouts and fully decoupled top-to-bottom array streams cleanly.
 */
export function parseOcrTable(tableText: string): PlayerStats[] {
  const playersData: PlayerStats[] = [];

  // 1. Isolate and split common acronym/team tags before line splitting
  const structuredText = tableText
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z\u00C0-\u017F])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z\u00C0-\u017F])/g, '$1 $2');

  // Split lines cleanly to isolate text blocks from numeric blocks
  const lines = structuredText.split(/\r?\n/);
  
  const homeNames: string[] = [];
  const awayNames: string[] = [];
  let currentTeamContext: 'HOME' | 'AWAY' | null = null;

  // 2. Pre-scan lines to build full, clean username arrays for decoupled layouts
  for (const line of lines) {
    let cleanLine = line.replace(/\|/g, ' ').replace(/[\[\]\(\)>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanLine) continue;

    const upperLine = cleanLine.toUpperCase();
    if (upperLine.includes('HOME')) { currentTeamContext = 'HOME'; continue; }
    if (upperLine.includes('AWAY')) { currentTeamContext = 'AWAY'; continue; }
    
    // Stop scanning names if we hit the stats header grid block
    if (upperLine.includes('GOAL') || upperLine.includes('ASSIST') || upperLine.includes('SCORE') || upperLine.includes('TOTAL MATCH')) {
      continue;
    }

    // If the line contains letters and no multi-digit stat indicators, it's a pure name line!
    const tokens = cleanLine.split(' ');
    const hasLetters = /[a-zA-Z\u00C0-\u017F]/.test(cleanLine);
    const numericTokens = tokens.filter(t => /^\d+$/.test(t));

    if (hasLetters && numericTokens.length <= 1) {
      // Clean metadata characters out of the standalone name row
      let cleanName = cleanLine.replace(/\s*mvp\s*★?/i, '').replace(/[★\*\-]/g, '').trim();
      
      // Strip standalone jersey artifacts
      cleanName = cleanName.replace(/^\d+\s+/, '').replace(/\s+\d+$/, '').trim();

      if (cleanName && cleanName.toLowerCase() !== 'defeat' && cleanName.toLowerCase() !== 'victory' && cleanName.toLowerCase() !== 'ad') {
        if (currentTeamContext === 'HOME') homeNames.push(cleanName);
        if (currentTeamContext === 'AWAY') awayNames.push(cleanName);
      }
    }
  }

  // 3. Flatten the whole string for your token loop to find score milestones
  const preCleanedText = structuredText
    .replace(/\|/g, ' ')
    .replace(/[\[\]\(\)>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = preCleanedText.split(' ');
  const awayHeaderIdx = tokens.findIndex(t => t.toUpperCase() === 'AWAY');

  let homePlayerCount = 0;
  let awayPlayerCount = 0;

  // Loop through tokens to find score milestones
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isScore = /^\d[\d,]*$/.test(token);
    const scoreVal = parseInt(token.replace(/,/g, ''), 10);
    
    if (isScore && scoreVal >= 100 && scoreVal <= 25000) {
      
      let isTotalMatch = false;
      for (let check = Math.max(0, i - 8); check < i; check++) {
        if (tokens[check]?.toLowerCase() === 'total' || tokens[check]?.toLowerCase() === 'match') {
          isTotalMatch = true;
          break;
        }
      }
      if (isTotalMatch) continue;

      try {
        const numericStats: number[] = [];
        let walkIdx = i - 1;

        while (walkIdx >= 0 && numericStats.length < 5) {
          const currentTok = tokens[walkIdx];
          if (['HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'TOTAL', 'MATCH', 'GOAL', 'ASSIST', 'PASS', 'INTERCEPTION', 'SAVE', 'SCORE'].includes(currentTok.toUpperCase())) {
            break;
          }
          if (/^\d+$/.test(currentTok)) {
            numericStats.unshift(parseInt(currentTok, 10));
          }
          walkIdx--;
        }

        if (numericStats.length === 5) {
          const goals = numericStats[0];
          const assists = numericStats[1];
          const passes = numericStats[2];
          const interceptions = numericStats[3];
          const saves = numericStats[4];

          const isAwayTeam = awayHeaderIdx !== -1 && i > awayHeaderIdx;
          if (!isAwayTeam) homePlayerCount++; else awayPlayerCount++;

          let nameEndIdx = walkIdx;
          const potentialJersey = tokens[nameEndIdx];
          if (potentialJersey && /^\d+$/.test(potentialJersey) && potentialJersey.length <= 2) {
            nameEndIdx--;
          }

          let nameStartIdx = nameEndIdx;
          while (nameStartIdx > 0) {
            const prevToken = tokens[nameStartIdx - 1];
            const prevTokenIsNum = /^\d[\d,]*$/.test(prevToken);
            const prevTokenVal = parseInt(prevToken.replace(/,/g, ''), 10);

            if (
              (prevTokenIsNum && prevTokenVal >= 100) || 
              ['HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'TOTAL', 'MATCH', 'GOAL', 'ASSIST', 'PASS', 'INTERCEPTION', 'SAVE', 'SCORE'].includes(prevToken.toUpperCase())
            ) {
              break;
            }
            nameStartIdx--;
          }

          const nameTokens = tokens.slice(nameStartIdx, nameEndIdx + 1).filter(tok => {
            return !['★', '*', '-', 'HOME', 'AWAY', 'VICTORY', 'DEFEAT', 'GOAL', 'ASSIST', 'PASS', 'INTERCEPTION', 'SAVE', 'SCORE'].includes(tok.toUpperCase());
          });

          let username = nameTokens.join(' ').replace(/\s*mvp\s*★?/i, '').replace(/★/g, '').trim();

          // 🚨 BULLETPROOF RECOVERY: If inline name parsing failed due to decoupled arrays,
          // instantly pull the full name from our pre-scanned line array!
          if (!username || username.length <= 1 || /^[0-9\s,]+$/.test(username)) {
            if (!isAwayTeam && homeNames[homePlayerCount - 1]) {
              username = homeNames[homePlayerCount - 1];
            } else if (isAwayTeam && awayNames[awayPlayerCount - 1]) {
              username = awayNames[awayPlayerCount - 1];
            }
          }

          const isPureNumbers = /^[0-9\s,]+$/.test(username);

          if (
            username && 
            !isPureNumbers &&
            username.length > 1 &&
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

  // Deduplicate entries by username
  const uniquePlayers = new Map<string, PlayerStats>();
  for (const player of playersData) {
    uniquePlayers.set(player.username.toLowerCase(), player);
  }

  const finalPlayersArray = Array.from(uniquePlayers.values());
  console.log(JSON.stringify(finalPlayersArray, null, 2));
  return finalPlayersArray;
}