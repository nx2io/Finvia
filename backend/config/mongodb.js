import mongoose from 'mongoose';
import { MONGODB_URI, NODE_ENV } from '../config/env.js';


const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: NODE_ENV });

    console.log(`✅ Connected to database in ${NODE_ENV} mode`);
  } catch (error) {
    console.error('Error connecting to database: ', error);

    process.exit(1);
  }
}

export default connectToDatabase;