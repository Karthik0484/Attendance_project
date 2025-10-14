/**
 * Migration Script: Convert existing students to multi-semester structure
 * 
 * This script migrates existing student records to the new multi-semester structure
 * by moving legacy semester data into the semesters array.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from '../models/Student.js';
import connectDB from '../config/database.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

/**
 * Migrate a single student record to multi-semester structure
 */
async function migrateStudent(student) {
  try {
    console.log(`🔄 Migrating student: ${student.name} (${student.rollNumber})`);
    
    // Check if student already has semesters array
    if (student.semesters && student.semesters.length > 0) {
      console.log(`✅ Student ${student.name} already migrated, skipping`);
      return { success: true, skipped: true };
    }

    // Create semester enrollment from legacy data
    const semesterEnrollment = {
      semesterName: student.semester,
      year: student.year,
      section: student.section || 'A',
      classAssigned: student.classAssigned,
      facultyId: student.facultyId,
      department: student.department,
      batch: student.batch,
      status: 'active',
      classId: student.classId || `${student.batch}_${student.year}_${student.semester}_${student.section || 'A'}`,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    // Update student with semesters array
    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      {
        $set: {
          semesters: [semesterEnrollment]
        }
      },
      { new: true }
    );

    console.log(`✅ Successfully migrated student: ${student.name}`);
    return { success: true, student: updatedStudent };

  } catch (error) {
    console.error(`❌ Error migrating student ${student.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllStudents() {
  try {
    console.log('🚀 Starting migration to multi-semester structure...');
    
    // Get all students that don't have semesters array or have empty semesters array
    const studentsToMigrate = await Student.find({
      $or: [
        { semesters: { $exists: false } },
        { semesters: { $size: 0 } }
      ]
    });

    console.log(`📊 Found ${studentsToMigrate.length} students to migrate`);

    if (studentsToMigrate.length === 0) {
      console.log('✅ No students need migration');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process students in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < studentsToMigrate.length; i += batchSize) {
      const batch = studentsToMigrate.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(studentsToMigrate.length / batchSize)}`);
      
      for (const student of batch) {
        const result = await migrateStudent(student);
        
        if (result.success) {
          if (result.skipped) {
            skippedCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} students`);
    console.log(`⏭️  Skipped (already migrated): ${skippedCount} students`);
    console.log(`❌ Errors: ${errorCount} students`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some students failed to migrate. Check the logs above for details.');
    } else {
      console.log('\n🎉 Migration completed successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  try {
    console.log('\n🔍 Verifying migration results...');
    
    const totalStudents = await Student.countDocuments();
    const migratedStudents = await Student.countDocuments({
      semesters: { $exists: true, $not: { $size: 0 } }
    });
    
    console.log(`📊 Total students: ${totalStudents}`);
    console.log(`📊 Migrated students: ${migratedStudents}`);
    console.log(`📊 Migration rate: ${((migratedStudents / totalStudents) * 100).toFixed(2)}%`);
    
    if (migratedStudents === totalStudents) {
      console.log('✅ All students successfully migrated!');
    } else {
      console.log('⚠️  Some students may not have been migrated');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🎯 Multi-Semester Student Migration Tool');
    console.log('=====================================');
    
    await migrateAllStudents();
    await verifyMigration();
    
    console.log('\n🏁 Migration process completed');
    
  } catch (error) {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateAllStudents, migrateStudent, verifyMigration };
