const mongoose = require('mongoose');

async function checkFacultyData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance-Track', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to database\n');

    const Faculty = require('../models/Faculty.js').default;
    const ClassAssignment = require('../models/ClassAssignment.js').default;
    const Student = require('../models/Student.js').default;
    const User = require('../models/User.js').default;

    // Find the faculty user (Karthik official)
    const user = await User.findOne({ email: 'karthikofficial0484@gmail.com' });
    console.log('👤 User found:', user ? `${user.name} (${user._id})` : 'NOT FOUND');

    if (!user) {
      console.log('❌ User not found!');
      await mongoose.connection.close();
      return;
    }

    // Find faculty record
    const faculty = await Faculty.findOne({ userId: user._id });
    console.log('👨‍🏫 Faculty found:', faculty ? `${faculty.name} (${faculty._id})` : 'NOT FOUND');

    if (!faculty) {
      console.log('❌ Faculty record not found!');
      await mongoose.connection.close();
      return;
    }

    console.log('📋 Faculty Details:');
    console.log('  - Name:', faculty.name);
    console.log('  - Department:', faculty.department);
    console.log('  - Status:', faculty.status);
    console.log('  - Is Class Advisor:', faculty.is_class_advisor);
    console.log('');

    // Find assigned classes
    const assignedClasses = await ClassAssignment.find({ 
      facultyId: faculty._id,
      status: 'active'
    });
    
    console.log(`🎓 Assigned Classes: ${assignedClasses.length}`);
    if (assignedClasses.length > 0) {
      assignedClasses.forEach(cls => {
        console.log(`  - ${cls.batch} | ${cls.year} | Sem ${cls.semester} | Section ${cls.section}`);
        console.log(`    ClassId: ${cls.classId}`);
        console.log(`    Status: ${cls.status}`);
      });
    }
    console.log('');

    // Count students for each class
    let totalStudents = 0;
    for (const cls of assignedClasses) {
      const count = await Student.countDocuments({
        department: faculty.department,
        'semesters.classId': cls.classId,
        'semesters.status': 'active',
        status: 'active'
      });
      console.log(`📊 Students in ${cls.classId}: ${count}`);
      totalStudents += count;
    }

    console.log('');
    console.log('📈 SUMMARY:');
    console.log('  - Total Assigned Classes:', assignedClasses.length);
    console.log('  - Total Students:', totalStudents);
    console.log('  - Active Semesters:', assignedClasses.length);

    await mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFacultyData();

