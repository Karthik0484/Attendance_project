import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Attendance-Track';

console.log('🔌 Testing database connection...');
console.log('📡 MongoDB URI:', MONGODB_URI);

try {
  const conn = await mongoose.connect(MONGODB_URI);
  console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  console.log(`📊 Database: ${conn.connection.name}`);
  
  // Test a simple operation
  const collections = await conn.connection.db.listCollections().toArray();
  console.log(`📚 Collections found: ${collections.length}`);
  collections.forEach(col => console.log(`  - ${col.name}`));
  
  await mongoose.disconnect();
  console.log('✅ Database connection test completed successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.error('❌ Full error:', error);
  process.exit(1);
}

