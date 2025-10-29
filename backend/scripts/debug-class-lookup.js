const mongoose = require('mongoose');

async function debugClassLookup() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance-Track');
    console.log('✅ Connected\n');

    const Faculty = require('../models/Faculty.js').default;
    const User = require('../models/User.js').default;
    
    // Get user
    const user = await User.findOne({ email: 'karthikofficial0484@gmail.com' });
    console.log('User ID:', user._id);
    
    // Get faculty
    const faculty = await Faculty.findOne({ userId: user._id });
    console.log('Faculty ID:', faculty._id);
    console.log('Faculty userId:', faculty.userId);
    console.log('');

    // Check ClassAssignment collection directly
    const db = mongoose.connection.db;
    const classAssignments = await db.collection('classassignments').find({}).toArray();
    
    console.log(`Total ClassAssignments: ${classAssignments.length}\n`);
    
    if (classAssignments.length > 0) {
      console.log('Sample ClassAssignment:');
      console.log(JSON.stringify(classAssignments[0], null, 2));
      console.log('');
      
      // Check what field names exist
      const sampleKeys = Object.keys(classAssignments[0]);
      console.log('Fields in ClassAssignment:', sampleKeys);
      console.log('');
      
      // Try to find by different fields
      console.log('Searching by faculty._id:', faculty._id);
      const byFacultyId = classAssignments.filter(c => 
        c.facultyId && c.facultyId.toString() === faculty._id.toString()
      );
      console.log('  Found:', byFacultyId.length);
      
      console.log('Searching by user._id:', user._id);
      const byUserId = classAssignments.filter(c => 
        c.facultyId && c.facultyId.toString() === user._id.toString()
      );
      console.log('  Found:', byUserId.length);
      
      // Show all unique facultyId values
      const allFacultyIds = [...new Set(classAssignments.map(c => c.facultyId?.toString()))];
      console.log('\nAll facultyId values in collection:', allFacultyIds);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

debugClassLookup();

