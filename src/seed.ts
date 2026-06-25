
import 'dotenv/config';
import { connectDatabase, getDb } from './services/db.js';
import { PlayerProfileRepository } from './repository/playerprofile_repository.js';
import { NicknameMappingRepository } from './repository/nickname_repository.js';

async function runSeed() {
  console.log('🌱 Connecting to database pool for provisioning...');
  await connectDatabase();

  const playerRepo = new PlayerProfileRepository();
  const nicknameRepo = new NicknameMappingRepository();

  console.log('🧹 Purging stale development collections...');
  await getDb().collection('players').deleteMany({});
  await getDb().collection('nicknames').deleteMany({});
  await getDb().collection('matches').deleteMany({});             // Wipes general match metadata
  await getDb().collection('match_performances').deleteMany({});   // Wipes player stat lines

  const TARGET_PLAYER_ID = 24; 
  
  // 1. Define the fresh Master Player Record with clean career baseline stats
  const masterProfile = {
    _id: TARGET_PLAYER_ID,
    nicknames: ['allauni', 'allaunigk'],
    discordProfile: '28394019283749201',
    careerStats: {
      goals: 0,
      assists: 0,
      saves: 0,
      passes: 0,
      interceptions: 0,
      matchesPlayed: 0
    }
  };

  console.log(`💾 Writing master profile record for ID: ${TARGET_PLAYER_ID}`);
  await playerRepo.saveProfile(masterProfile);

  // 2. Build the inverted lookup indexes for name matching
  for (const nick of masterProfile.nicknames) {
    console.log(`🔗 Linking lookup key [${nick}] ➔ Player ID: ${TARGET_PLAYER_ID}`);
    await nicknameRepo.registerNickname(nick, TARGET_PLAYER_ID);
  }

  // 3. Provision the immutable Mock Match history entries
  const MOCK_MATCH_ID = 'game_1';
  console.log(`🎬 Provisioning mock match history entry [${MOCK_MATCH_ID}]...`);

  // Insert general match event mapping
  await getDb().collection('matches').insertOne({
    _id: 'game_1',
    fileName: 'game_1.png',
    imageHash: '956a934cbfa6e933611814a20fcff3da55cd1586c65bf596e90020a930d7c042',
    uploadedAt: new Date(),
    uploadedBy: '28394019283749201' 
  });

  // Insert granular individual player performance metrics line
  await getDb().collection('match_performances').insertOne({
    playerId: TARGET_PLAYER_ID,
    matchId: MOCK_MATCH_ID,
    timestamp: new Date(),
    goals: 3,
    assists: 1,
    saves: 2,
    passes: 14,
    interceptions: 5
  });

  // 4. Increment the career stats baseline to accurately reflect the seeded historical performance
  console.log('📈 Re-calculating baseline cumulative statistics...');
  await playerRepo.incrementCareerStats(TARGET_PLAYER_ID, {
    goals: 3,
    assists: 1,
    saves: 2,
    passes: 14,
    interceptions: 5
  });

  console.log('✅ Database seeding sequence completed successfully.');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Seeding process encountered an unhandled fault:', err);
  process.exit(1);
});