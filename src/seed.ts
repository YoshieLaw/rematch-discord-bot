
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

  const TARGET_PLAYER_ID = -1; 

  const barPlayersToSeed = [
    { id: 21, nicks: ['allauni', 'allaunigk', 'barallauni', 'barallaunigk'] },
    { id: 22, nicks: ['totallysilv', 'totallysilvgk', 'bargktotallysilv'] },
    { id: 23, nicks: ['velops', 'velopsgk', 'barvelops', 'barvelopsgk'] },
    { id: 24, nicks: ['zomu', 'barzomu'] },
    { id: 25, nicks: ['maxfort', 'barmaxfort'] }
  ];
    
  // 1. Define the fresh Master Player Record with clean career baseline stats
 // Loop through each player configuration sequentially
for (const playerData of barPlayersToSeed) {
  const currentId = playerData.id;

  // 1. Define the fresh Master Player Record with clean career baseline stats
  const masterProfile = {
    _id: currentId,
    nicknames: playerData.nicks,
    discordProfile: '', // Stays empty until they run !register
    careerStats: {
      goals: 0,
      assists: 0,
      saves: 0,
      passes: 0,
      interceptions: 0,
      matchesPlayed: 0
    }
  };

  console.log(`💾 Writing master profile record for ID: ${currentId}`);
  await playerRepo.saveProfile(masterProfile);

  // 2. Build the inverted lookup indexes for name matching
  for (const nick of masterProfile.nicknames) {
      console.log(`🔗 Linking lookup key [${nick}] ➔ Player ID: ${currentId}`);
      await nicknameRepo.registerNickname(nick, currentId);
    }
  }

  console.log('✅ Seeding complete! 5 player profiles and their lookup keys have been written.')

  
  // 3. Provision the immutable Mock Match history entries
  const MOCK_MATCH_ID = 'test_game_1';
  console.log(`🎬 Provisioning mock match history entry [${MOCK_MATCH_ID}]...`);

  // Insert general match event mapping
  await getDb().collection('matches').insertOne({
    _id: 'test_game_1',
    fileName: 'test_game_1.png',
    imageHash: '956a934cbfa6e933611814a20fcaaff3da55cd1586c65bf596e90020a930d7c042',
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