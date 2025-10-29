import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const ClassAssignment = (await import('../models/ClassAssignment.js')).default;

const fixMultipleActiveAssignments = async () => {
  try {
    console.log('🔄 Starting fix for multiple active assignments...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/Attendance-Track';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Find all active assignments grouped by faculty
    const allAssignments = await ClassAssignment.find({
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true },
        { active: true }
      ]
    }).sort({ assignedDate: -1 });

    console.log(`📋 Found ${allAssignments.length} active assignments`);

    // Group by facultyId and role
    const facultyGroups = {};
    allAssignments.forEach(assignment => {
      const key = `${assignment.facultyId}_${assignment.role || 'Class Advisor'}`;
      if (!facultyGroups[key]) {
        facultyGroups[key] = [];
      }
      facultyGroups[key].push(assignment);
    });

    console.log(`👥 Found ${Object.keys(facultyGroups).length} faculty members with assignments`);

    let fixedCount = 0;
    let deactivatedCount = 0;

    // For each faculty, keep only the most recent assignment active
    for (const [key, assignments] of Object.entries(facultyGroups)) {
      if (assignments.length > 1) {
        console.log(`\n🔍 Faculty has ${assignments.length} active assignments:`);
        
        // Sort by date (newest first)
        assignments.sort((a, b) => b.assignedDate - a.assignedDate);
        
        // Keep the first (newest) active, deactivate the rest
        const [newest, ...older] = assignments;
        
        console.log(`   ✅ KEEPING: ${newest.batch} | ${newest.year} | Sem ${newest.semester} | Sec ${newest.section} (${newest.assignedDate})`);
        
        // Ensure the newest has correct status
        newest.status = 'Active';
        newest.active = true;
        if (!newest.statusHistory) {
          newest.statusHistory = [];
        }
        if (newest.statusHistory.length === 0) {
          newest.statusHistory.push({
            status: 'Active',
            updatedAt: newest.assignedDate,
            updatedBy: newest.assignedBy,
            reason: 'Migration: Set as active assignment'
          });
        }
        await newest.save();
        
        // Deactivate older assignments
        for (const old of older) {
          console.log(`   ❌ DEACTIVATING: ${old.batch} | ${old.year} | Sem ${old.semester} | Sec ${old.section} (${old.assignedDate})`);
          
          old.status = 'Inactive';
          old.active = false;
          old.deactivatedDate = new Date();
          
          if (!old.statusHistory) {
            old.statusHistory = [];
          }
          old.statusHistory.push({
            status: 'Inactive',
            updatedAt: new Date(),
            updatedBy: newest.assignedBy,
            reason: 'Migration: Auto-deactivated (multiple active assignments detected)'
          });
          
          await old.save();
          deactivatedCount++;
        }
        
        fixedCount++;
      }
    }

    console.log('\n✅ Fix complete!');
    console.log(`   Fixed faculty: ${fixedCount}`);
    console.log(`   Deactivated assignments: ${deactivatedCount}`);
    
    // Verify the fix
    const remainingActive = await ClassAssignment.find({
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total active assignments remaining: ${remainingActive.length}`);
    
    // Check for any faculty with multiple active assignments
    const stillMultiple = {};
    remainingActive.forEach(a => {
      const key = `${a.facultyId}_${a.role || 'Class Advisor'}`;
      stillMultiple[key] = (stillMultiple[key] || 0) + 1;
    });
    
    const problemFaculty = Object.values(stillMultiple).filter(count => count > 1);
    if (problemFaculty.length > 0) {
      console.log(`   ⚠️ Still have ${problemFaculty.length} faculty with multiple active assignments`);
    } else {
      console.log(`   ✅ All faculty now have single active assignment`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

// Run fix
fixMultipleActiveAssignments();

