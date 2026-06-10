import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'operio';

// Initialize MongoDB Client
export const mongoClient = new MongoClient(MONGO_URI);
let dbConnected = false;

export async function getDb() {
  if (!dbConnected) {
    await mongoClient.connect();
    dbConnected = true;
  }
  return mongoClient.db(MONGO_DB);
}
