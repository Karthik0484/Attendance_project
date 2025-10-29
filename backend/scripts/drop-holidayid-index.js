import mongoose from 'mongoose';
import config from '../config/config.js';

async function dropHolidayIdIndex() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(config.MONGO_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('holidays');

    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop the problematic holidayId_1 index
    try {
      console.log('🗑️  Dropping holidayId_1 index...');
      await collection.dropIndex('holidayId_1');
      console.log('✅ Successfully dropped holidayId_1 index');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index holidayId_1 does not exist, skipping...');
      } else {
        console.log('⚠️  Error dropping index:', err.message);
      }
    }

    // Find and fix documents with null holidayId
    console.log('🔍 Finding holidays with null or missing holidayId...');
    const holidaysWithoutId = await collection.find({
      $or: [
        { holidayId: null },
        { holidayId: { $exists: false } }
      ]
    }).toArray();

    console.log(`📋 Found ${holidaysWithoutId.length} holidays without holidayId`);

    // Update each one with a unique ID
    for (const holiday of holidaysWithoutId) {
      const newId = `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await collection.updateOne(
        { _id: holiday._id },
        { $set: { holidayId: newId } }
      );
      console.log(`✅ Updated holiday ${holiday._id} with holidayId: ${newId}`);
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay for unique IDs
    }

    // Check for duplicate holidayIds
    console.log('🔍 Checking for duplicate holidayIds...');
    const allHolidays = await collection.find({}).toArray();
    const idMap = new Map();
    const duplicates = [];

    for (const holiday of allHolidays) {
      if (holiday.holidayId) {
        if (idMap.has(holiday.holidayId)) {
          duplicates.push(holiday);
        } else {
          idMap.set(holiday.holidayId, holiday._id);
        }
      }
    }

    console.log(`📋 Found ${duplicates.length} duplicate holidayIds`);

    // Fix duplicates
    for (const holiday of duplicates) {
      const newId = `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await collection.updateOne(
        { _id: holiday._id },
        { $set: { holidayId: newId } }
      );
      console.log(`✅ Fixed duplicate: ${holiday._id} -> ${newId}`);
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Recreate the index with sparse option to handle any edge cases
    console.log('🔧 Creating new holidayId index with sparse option...');
    await collection.createIndex(
      { holidayId: 1 },
      { 
        unique: true, 
        sparse: true, // This allows documents without the field
        background: true 
      }
    );
    console.log('✅ Successfully created holidayId index');

    // Final verification
    console.log('🔍 Final verification...');
    const finalIndexes = await collection.indexes();
    console.log('Final indexes:', finalIndexes.map(i => i.name));

    const finalCount = await collection.countDocuments({});
    console.log(`📊 Total holidays: ${finalCount}`);

    await mongoose.disconnect();
    console.log('✅ All done! Holiday index fixed successfully.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropHolidayIdIndex();

