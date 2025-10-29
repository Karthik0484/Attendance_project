import mongoose from 'mongoose';
import Holiday from '../models/Holiday.js';
import config from '../config/config.js';

const fixHolidayIds = async () => {
  try {
    console.log('🔧 Starting Holiday holidayId fix...');
    
    // Connect to database
    await mongoose.connect(config.MONGO_URI);
    console.log('✅ Connected to database');

    // Find all holidays with null or missing holidayId
    const holidaysWithoutId = await Holiday.find({
      $or: [
        { holidayId: null },
        { holidayId: { $exists: false } }
      ]
    });

    console.log(`📋 Found ${holidaysWithoutId.length} holidays without holidayId`);

    if (holidaysWithoutId.length === 0) {
      console.log('✅ No holidays need fixing');
      
      // Check for duplicate holidayIds
      const allHolidays = await Holiday.find({});
      const holidayIdMap = new Map();
      let duplicates = 0;
      
      for (const holiday of allHolidays) {
        if (holiday.holidayId) {
          if (holidayIdMap.has(holiday.holidayId)) {
            console.log(`⚠️  Duplicate holidayId found: ${holiday.holidayId}`);
            duplicates++;
            // Generate new unique ID for duplicate
            const newId = `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            holiday.holidayId = newId;
            await holiday.save();
            console.log(`✅ Updated duplicate to new ID: ${newId}`);
          } else {
            holidayIdMap.set(holiday.holidayId, true);
          }
        }
      }
      
      if (duplicates === 0) {
        console.log('✅ No duplicate holidayIds found');
      }
      
      await mongoose.disconnect();
      console.log('✅ All done!');
      process.exit(0);
    }

    // Update each holiday with a unique holidayId
    let updated = 0;
    for (const holiday of holidaysWithoutId) {
      const newHolidayId = `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Use updateOne to bypass validation and unique constraint temporarily
      await Holiday.updateOne(
        { _id: holiday._id },
        { $set: { holidayId: newHolidayId } }
      );
      
      console.log(`✅ Updated holiday ${holiday._id}: date=${holiday.date}, reason=${holiday.reason}, newId=${newHolidayId}`);
      updated++;
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    console.log(`✅ Updated ${updated} holidays with unique holidayIds`);

    // Now check for any remaining duplicates
    const allHolidays = await Holiday.find({});
    const holidayIdMap = new Map();
    let duplicates = 0;
    
    for (const holiday of allHolidays) {
      if (holiday.holidayId) {
        if (holidayIdMap.has(holiday.holidayId)) {
          console.log(`⚠️  Duplicate holidayId found: ${holiday.holidayId}`);
          duplicates++;
          // Generate new unique ID for duplicate
          const newId = `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await Holiday.updateOne(
            { _id: holiday._id },
            { $set: { holidayId: newId } }
          );
          console.log(`✅ Fixed duplicate with new ID: ${newId}`);
          await new Promise(resolve => setTimeout(resolve, 5));
        } else {
          holidayIdMap.set(holiday.holidayId, true);
        }
      }
    }

    // Drop and recreate the index to fix any index corruption
    console.log('🔧 Recreating holidayId index...');
    try {
      await Holiday.collection.dropIndex('holidayId_1');
      console.log('✅ Dropped old holidayId index');
    } catch (err) {
      console.log('ℹ️  Index may not exist, continuing...');
    }

    // Create the index with unique constraint
    await Holiday.collection.createIndex(
      { holidayId: 1 }, 
      { 
        unique: true,
        sparse: false,
        background: false
      }
    );
    console.log('✅ Created new holidayId index');

    // Verify all holidays have unique holidayIds
    const finalCheck = await Holiday.find({});
    const finalIds = new Set();
    let hasNulls = false;
    let hasDuplicates = false;

    for (const holiday of finalCheck) {
      if (!holiday.holidayId) {
        console.log(`❌ Holiday still has null holidayId: ${holiday._id}`);
        hasNulls = true;
      } else if (finalIds.has(holiday.holidayId)) {
        console.log(`❌ Duplicate holidayId still exists: ${holiday.holidayId}`);
        hasDuplicates = true;
      } else {
        finalIds.add(holiday.holidayId);
      }
    }

    if (!hasNulls && !hasDuplicates) {
      console.log('✅ All holidays have unique holidayIds');
    }

    await mongoose.disconnect();
    console.log('✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

fixHolidayIds();

