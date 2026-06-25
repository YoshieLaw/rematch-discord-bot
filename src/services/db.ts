import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * 1. The Gateway Creator (connectDatabase)
 * This is called exactly ONCE when your Discord bot boots up. It opens the 
 * pipe to MongoDB Atlas, configures your indexes, and caches the database instance.
 */
export async function connectDatabase(): Promise<Db> {
  if (db) return db; // If already connected, reuse the existing connection pool!

    if (!process.env.MONGO_URI) {
        console.error('❌ Error: MONGOURI is missing inside your .env file!');
        process.exit(1);
    }

  const uri: string = process.env.MONGO_URI; 
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); 

  // 🛡️ RUN THE HEALTH CHECK HERE
  try {
    // A database ping requests a minimalist response to check network/auth health
    await db.command({ ping: 1 });
    console.log('🏁 MongoDB Atlas Connection Ping: SUCCESS! Database is fully responsive.');
  } catch (pingError) {
    console.error('❌ MongoDB Atlas Connection Ping: FAILED!');
    throw pingError;
  }
  
  // Create database indexes at boot time
  await db.collection('nicknames').createIndex({ _id: 1 });
  return db;
}

/**
 * 2. The Shared Instance Provider (getDb)
 * This is what your repositories call. It instantly hands back the active, 
 * already-connected database instance without making a new network request.
 */
export function getDb(): Db {
  if (!db) {
    throw new Error('Database connection has not been initialized yet.');
  }
  return db;
}