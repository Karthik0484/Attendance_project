import mongoose from 'mongoose';
import config from './config/config.js';

console.log('Starting diagnostic...');

mongoose.connect(config.MONGO_URI)
  .then(async () => {
    console.log('Connected to database');
    
    const db = mongoose.connection.db;
    
    // Check holidays
    const holidays = await db.collection('holidays').find({}).toArray();
    console.log('\n=== HOLIDAYS ===');
    console.log(`Total holidays: ${holidays.length}`);
    holidays.forEach(h => {
      console.log(`\n${h.date} - ${h.reason}`);
      console.log(`  Scope: ${h.scope}`);
      console.log(`  Dept: ${h.department}`);
      if (h.scope === 'class') {
        console.log(`  Batch: ${h.batchYear}`);
        console.log(`  Section: ${h.section}`);
        console.log(`  Semester: ${h.semester}`);
      }
      console.log(`  Active: ${h.isActive}, Deleted: ${h.isDeleted}`);
    });
    
    // Check students
    const students = await db.collection('students').find({ status: 'active' }).limit(3).toArray();
    console.log('\n\n=== STUDENTS ===');
    console.log(`Total active students: ${students.length}`);
    students.forEach(s => {
      console.log(`\n${s.name} (${s.rollNumber})`);
      console.log(`  Dept: ${s.department}`);
      console.log(`  Batch: ${s.batchYear}`);
      console.log(`  Semesters: ${s.semesters?.length || 0}`);
      if (s.semesters) {
        s.semesters.forEach((sem, i) => {
          console.log(`  Sem ${i+1}: ${sem.semesterName}, Batch: ${sem.batch}, Section: ${sem.section}, Dept: ${sem.department}`);
        });
      }
    });
    
    await mongoose.disconnect();
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

