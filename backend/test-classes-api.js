/**
 * Test script to verify the /api/classes/:classId/students endpoint
 * Run with: node test-classes-api.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ClassAssignment from './models/ClassAssignment.js';
import Student from './models/Student.js';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Attendance-Track';

async function testClassesAPI() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Find a class assignment
    console.log('📋 Step 1: Finding a class assignment...');
    const assignment = await ClassAssignment.findOne({ active: true, status: 'Active' })
      .populate('facultyId', 'name email');
    
    if (!assignment) {
      console.log('❌ No active class assignments found');
      process.exit(1);
    }

    console.log('✅ Found assignment:', {
      _id: assignment._id,
      batch: assignment.batch,
      year: assignment.year,
      semester: assignment.semester,
      semesterType: typeof assignment.semester,
      section: assignment.section,
      faculty: assignment.facultyId.name
    });

    // 2. Build classId string (same logic as in routes/classes.js)
    console.log('\n📋 Step 2: Building classId string...');
    const semesterString = typeof assignment.semester === 'number' 
      ? `Sem ${assignment.semester}` 
      : assignment.semester.toString();
    
    const classIdString = `${assignment.batch}_${assignment.year}_${semesterString}_${assignment.section}`;
    console.log('🔍 ClassId string:', classIdString);
    console.log('🔍 Semester conversion:', assignment.semester, '=>', semesterString);

    // 3. Query students
    console.log('\n📋 Step 3: Querying students...');
    const students = await Student.find({
      'semesters.classId': classIdString,
      'semesters.status': 'active',
      status: 'active'
    })
    .select('regNo name email mobile parentMobile')
    .lean();

    console.log(`📊 Found ${students.length} students`);

    if (students.length > 0) {
      console.log('\n📝 Sample student (RAW from DB):');
      console.log(JSON.stringify(students[0], null, 2));

      // 4. Format student (same as in routes/classes.js)
      console.log('\n📋 Step 4: Formatting student data...');
      const formattedStudent = {
        _id: students[0]._id,
        regNo: students[0].regNo,
        rollNumber: students[0].regNo,  // Added for frontend
        name: students[0].name,
        email: students[0].email,
        mobile: students[0].mobile,
        parentMobile: students[0].parentMobile,
        parentContact: students[0].parentMobile  // Added for frontend
      };

      console.log('\n📝 Formatted student (as API returns):');
      console.log(JSON.stringify(formattedStudent, null, 2));

      console.log('\n✅ Field check:');
      console.log('  - Has regNo:', !!formattedStudent.regNo);
      console.log('  - Has rollNumber:', !!formattedStudent.rollNumber);
      console.log('  - Has parentMobile:', !!formattedStudent.parentMobile);
      console.log('  - Has parentContact:', !!formattedStudent.parentContact);
      console.log('  - regNo === rollNumber:', formattedStudent.regNo === formattedStudent.rollNumber);
    } else {
      console.log('❌ No students found with classId:', classIdString);
      
      // Debug: Check what classIds exist
      console.log('\n🔍 Debugging: Checking existing classIds in database...');
      const allStudents = await Student.find({ status: 'active' })
        .select('name semesters.classId')
        .lean();
      
      const uniqueClassIds = [...new Set(
        allStudents.flatMap(s => s.semesters.map(sem => sem.classId))
      )];
      
      console.log('📊 Unique classIds found in database:');
      uniqueClassIds.forEach(id => console.log('  -', id));
    }

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testClassesAPI();

