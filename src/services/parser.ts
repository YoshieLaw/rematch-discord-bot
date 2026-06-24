// src/parser.ts
import axios from 'axios';
import FormData from 'form-data';
import { PlayerStats } from '../entity/player_stats.js';

/**
 * Sends a hosted image URL to the OCR.space API and returns the raw parsed text.
 * @param imageUrl The Discord CDN attachment URL string
 */
export async function extractTextFromUrl(imageUrl: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_KEY;
  
  if (!apiKey) {
    throw new Error('Missing OCR_SPACE_KEY in your environment variables.');
  }

  try {
    const form = new FormData();
    // Fields come from https://ocr.space/ocrapi
    form.append('apikey', apiKey);
    form.append('url', imageUrl);
    form.append('isOverlayRequired', 'false');
    form.append('scale', 'true'); // Upscales image internally to improve digit recognition accuracy
    form.append('isTable', 'true'); // Crucial: Tells the engine to recognize tabular grids
    form.append('OCREngine', '3'); // Enable Engine 3 for advanced table/markdown translation layout
    form.append('isCreateSearchablePdf', 'true'); // Enable Searchable PDF Layer configuration

    // Send POST request to OCR.space endpoint
    const response = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: form.getHeaders(),
    });

    // Check if the API itself threw an operational error
    if (response.data.OCRExitCode !== 1) {
      throw new Error(`OCR Space Error: ${response.data.ErrorMessage || 'Unknown processing error'}`);
    }

    // Grab the parsed raw text output string from the response structure
    const rawText: string = response.data.ParsedResults[0].ParsedText;
    return rawText;
    
  } catch (error) {
    console.error('Failed to communicate with OCR.space:', error);
    throw error;
  }
}

/**
 * Parses the Markdown or unstructured text output string from OCR Space into structured player objects.
 * @param tableText Raw text string containing the player data layout
 */
export function parseOcrTable(tableText: string): PlayerStats[] {
  // 1. Fix fused prefix issues from tight column boundaries (e.g., "BARTotally" -> "BAR Totally")
  let preCleanedText = tableText
    .replace(/\bBAR(?=[A-Z0-9])/g, 'BAR ') // Inserts space if BAR is smashed against a name
    .replace(/\bGŁ(?=[0-9])/g, 'GŁ ');    // Inserts space if GŁ is smashed against a jersey number

  // 2. Strip markdown pipes and flatten all newlines/spaces into one massive array of pure data tokens
  const cleanText = preCleanedText.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleanText.split(' ');
  const playersData: PlayerStats[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    // Check if the current token is a final score (a number usually between 100 and 25000)
    // and make sure it's not part of the 'Total match' summary lines
    const isScore = /^\d[\d,]*$/.test(token);
    const scoreVal = parseInt(token.replace(/,/g, ''), 10);
    
    if (isScore && scoreVal >= 100 && scoreVal <= 25000) {
      // Look backward from the score index to ensure we don't accidentally grab a 'Total' summary block
      let isTotalMatch = false;
      for (let check = Math.max(0, i - 15); check < i; check++) {
        if (tokens[check]?.toLowerCase() === 'total' || tokens[check]?.toLowerCase() === 'match') {
          isTotalMatch = true;
          break;
        }
      }

      if (!isTotalMatch) {
        try {
          // Collect numeric tokens backward to find the 5 core game metrics
          const numericStats: number[] = [];
          let searchIdx = i - 1;
          
          // Step backward and collect up to 5 valid numbers for stats
          while (searchIdx >= 0 && numericStats.length < 5) {
            const currentToken = tokens[searchIdx];
            // If we run into a major section header or column label, stop stat hunting
            if (
              currentToken.toUpperCase() === 'HOME' || 
              currentToken.toUpperCase() === 'AWAY' || 
              currentToken.toUpperCase() === 'SCORE'
            ) {
              break;
            }
            
            // If it's a pure digit stat line, record it
            if (/^\d+$/.test(currentToken)) {
              numericStats.unshift(parseInt(currentToken, 10));
            }
            searchIdx--;
          }

          // We must have exactly 5 stats extracted (Goals, Assists, Passes, Interceptions, Saves)
          if (numericStats.length === 5) {
            const goals = numericStats[0];
            const assists = numericStats[1];
            const passes = numericStats[2];
            const interceptions = numericStats[3];
            const saves = numericStats[4];

            // The remaining text to the left of our furthest stat token belongs to the name
            let nameEndIdx = searchIdx;

            // Check for a single-digit jersey number marker standing right before the stats window
            const potentialJersey = tokens[nameEndIdx];
            if (potentialJersey && /^\d+$/.test(potentialJersey) && potentialJersey.length === 1) {
              nameEndIdx--; 
            }

            // Gather everything left backward until we hit either another score value or a team header
            let nameStartIdx = nameEndIdx;
            while (nameStartIdx > 0) {
              const prevToken = tokens[nameStartIdx - 1];
              const prevTokenIsNum = /^\d[\d,]*$/.test(prevToken);
              const prevTokenVal = parseInt(prevToken.replace(/,/g, ''), 10);
              
              // Stop gathering username words if we run into headers, labels, or other scores
              if (
                (prevTokenIsNum && prevTokenVal >= 100) || 
                prevToken.toUpperCase() === 'HOME' || 
                prevToken.toUpperCase() === 'AWAY' ||
                prevToken.toUpperCase() === 'VICTORY' ||
                prevToken.toUpperCase() === 'DEFEAT' ||
                prevToken.toUpperCase() === 'GOAL' ||
                prevToken.toUpperCase() === 'ASSIST' ||
                prevToken.toUpperCase() === 'PASS' ||
                prevToken.toUpperCase() === 'INTERCEPTION' ||
                prevToken.toUpperCase() === 'SAVE' ||
                prevToken.toUpperCase() === 'SCORE'
              ) {
                break;
              }
              nameStartIdx--;
            }

            // Piece the username tokens together cleanly
            const rawName = tokens.slice(nameStartIdx, nameEndIdx + 1).join(' ');
            
            // Clean out both trailing MVP text tags and loose star icons seamlessly
            const username = rawName.replace(/\s*mvp\s*★?/i, '').replace(/★/g, '').trim();

            // Prevent empty lines or leaked static boilerplate columns
            if (
              username !== '' && 
              username.toLowerCase() !== 'player' && 
              username.toLowerCase() !== 'score' &&
              username.toLowerCase() !== 'save'
            ) {
              playersData.push({ username, goals, assists, passes, interceptions, saves });
            }
          }
        } catch (err) {
          console.error('Token slicing window boundary fault skipped a line:', err);
        }
      }
    }
    i++;
  }

  return playersData;
}