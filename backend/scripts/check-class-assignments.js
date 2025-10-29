const mongoose = require('mongoose');

async function checkClassAssignments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance-Track', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to database\n');

    const Faculty = require('../models/Faculty.js').default;
    const ClassAssignment = require('../models/ClassAssignment.js').default;
    const User = require('../models/User.js').default;

    // Find the faculty user
    const user = await User.findOne({ email: 'karthikofficial0484@gmail.com' });
    console.log('👤 User ID:', user?._id);

    const faculty = await Faculty.findOne({ userId: user._id });
    console.log('👨‍🏫 Faculty ID:', faculty?._id);
    console.log('');

    // Check ALL ClassAssignments
    const allAssignments = await ClassAssignment.find({});
    console.log(`📚 Total ClassAssignments in DB: ${allAssignments.length}\n`);

    if (allAssignments.length > 0) {
      console.log('Sample ClassAssignment structure:');
      console.log(JSON.stringify(allAssignments[0], null, 2));
      console.log('');

      // Check for this specific faculty
      console.log(`🔍 Looking for assignments with facultyId: ${faculty._id}`);
      const facultyAssignments = await ClassAssignment.find({ facultyId: faculty._id });
      console.log(`Found ${facultyAssignments.length} assignments\n`);

      if (facultyAssignments.length > 0) {
        console.log('Faculty assignments:');
        facultyAssignments.forEach((assignment, idx) => {
          console.log(`${idx + 1}. ${assignment.batch} | ${assignment.year} | ${assignment.semester} | ${assignment.section}`);
          console.log(`   ClassId: ${assignment.classId}`);
          console.log(`   Status: ${assignment.status}`);
          console.log(`   FacultyId: ${assignment.facultyId}`);
          console.log('');
        });
      } else {
        console.log('❌ No assignments found for this faculty!');
        console.log('\nChecking if facultyId exists in any assignment...');
        
        const facultyIdString = faculty._id.toString();
        for (const assignment of allAssignments) {
          if (assignment.facultyId && assignment.facultyId.toString() === facultyIdString) {
            console.log('✓ Found matching assignment:', assignment.classId);
          }
        }
      }
    } else {
      console.log('❌ No ClassAssignments found in database!');
    }

    await mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkClassAssignments();

