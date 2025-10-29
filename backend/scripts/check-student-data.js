import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from '../models/Student.js';
import User from '../models/User.js';

dotenv.config();

const checkAndFixStudentData = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_tracker');
    console.log('✅ Connected to database');

    // Find all student users
    console.log('\n📊 Checking student users...');
    const studentUsers = await User.find({ role: 'student' }).select('_id name email department');
    console.log(`Found ${studentUsers.length} student users`);

    for (const user of studentUsers) {
      console.log(`\n👤 Checking user: ${user.name} (${user.email})`);
      console.log(`   User ID: ${user._id}`);

      // Find corresponding student record
      const student = await Student.findOne({ userId: user._id });

      if (!student) {
        console.log(`   ❌ No student record found for this user!`);
        console.log(`   Action needed: Create student record for this user`);
        continue;
      }

      console.log(`   ✅ Student record found`);
      console.log(`   Student ID: ${student._id}`);
      console.log(`   Roll Number: ${student.rollNumber}`);
      console.log(`   Department: ${student.department}`);
      console.log(`   Batch: ${student.batchYear}`);
      console.log(`   Section: ${student.section}`);
      console.log(`   Status: ${student.status}`);
      console.log(`   Semesters Array Length: ${student.semesters?.length || 0}`);
      
      // Check old structure fields
      console.log(`   Old Structure:`);
      console.log(`     - classId: ${student.classId || 'Not set'}`);
      console.log(`     - semester: ${student.semester || 'Not set'}`);
      console.log(`     - year: ${student.year || 'Not set'}`);
      console.log(`     - classAssigned: ${student.classAssigned || 'Not set'}`);
      console.log(`     - facultyId: ${student.facultyId || 'Not set'}`);

      // Check if student has semester data
      const hasSemesters = student.semesters && student.semesters.length > 0;
      const hasOldStructure = student.classId && student.semester;

      if (!hasSemesters && !hasOldStructure) {
        console.log(`   ⚠️  WARNING: Student has NO semester data (neither array nor old structure)`);
        console.log(`   Action needed: Assign student to a class/semester`);
      } else if (!hasSemesters && hasOldStructure) {
        console.log(`   ⚠️  Student using old structure (should be migrated to semesters array)`);
        console.log(`   Current semester: ${student.semester}`);
        console.log(`   Current classId: ${student.classId}`);
      } else {
        console.log(`   ✅ Student has semesters array with ${student.semesters.length} semester(s)`);
        student.semesters.forEach((sem, idx) => {
          console.log(`   Semester ${idx + 1}:`);
          console.log(`     - Name: ${sem.semesterName}`);
          console.log(`     - Year: ${sem.year}`);
          console.log(`     - Section: ${sem.section}`);
          console.log(`     - Class: ${sem.classAssigned}`);
          console.log(`     - ClassId: ${sem.classId}`);
          console.log(`     - Status: ${sem.status}`);
        });
      }
    }

    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the script
checkAndFixStudentData();


