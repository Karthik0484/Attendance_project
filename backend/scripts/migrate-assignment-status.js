import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import model after env is loaded
const ClassAssignment = (await import('../models/ClassAssignment.js')).default;

const migrateAssignmentStatus = async () => {
  try {
    console.log('🔄 Starting ClassAssignment status migration...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/Attendance-Track';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB:', mongoURI);

    // Find all assignments without status field or with null status
    const assignmentsToUpdate = await ClassAssignment.find({
      $or: [
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`📋 Found ${assignmentsToUpdate.length} assignments to update`);

    let updated = 0;
    for (const assignment of assignmentsToUpdate) {
      // Set status based on active field
      assignment.status = assignment.active ? 'Active' : 'Inactive';
      
      // Initialize statusHistory if it doesn't exist
      if (!assignment.statusHistory || assignment.statusHistory.length === 0) {
        assignment.statusHistory = [{
          status: assignment.status,
          updatedAt: assignment.assignedDate || new Date(),
          updatedBy: assignment.assignedBy,
          reason: 'Migrated from legacy active field'
        }];
      }
      
      await assignment.save();
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`   ✓ Updated ${updated} assignments...`);
      }
    }

    console.log(`✅ Migration complete! Updated ${updated} assignments`);
    
    // Verify the migration
    const activeCount = await ClassAssignment.countDocuments({ status: 'Active' });
    const inactiveCount = await ClassAssignment.countDocuments({ status: 'Inactive' });
    
    console.log('\n📊 Summary:');
    console.log(`   Active assignments: ${activeCount}`);
    console.log(`   Inactive assignments: ${inactiveCount}`);
    console.log(`   Total: ${activeCount + inactiveCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateAssignmentStatus();

