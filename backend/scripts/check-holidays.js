import mongoose from 'mongoose';
import Holiday from '../models/Holiday.js';
import Student from '../models/Student.js';
import config from '../config/config.js';

async function checkHolidays() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(config.MONGO_URI);
    console.log('✅ Connected\n');

    // Get all holidays
    console.log('📅 ALL HOLIDAYS IN DATABASE:');
    console.log('=' .repeat(80));
    const allHolidays = await Holiday.find({})
      .sort({ date: 1 });
    
    if (allHolidays.length === 0) {
      console.log('❌ NO HOLIDAYS FOUND IN DATABASE!');
      console.log('\nPlease declare a holiday first using the faculty interface.\n');
    } else {
      allHolidays.forEach((h, i) => {
        console.log(`\nHoliday ${i + 1}:`);
        console.log(`  ID: ${h.holidayId}`);
        console.log(`  Date: ${h.date}`);
        console.log(`  Reason: ${h.reason}`);
        console.log(`  Scope: ${h.scope}`);
        console.log(`  Department: ${h.department}`);
        if (h.scope === 'class') {
          console.log(`  Batch Year: ${h.batchYear}`);
          console.log(`  Section: ${h.section}`);
          console.log(`  Semester: ${h.semester}`);
        }
        console.log(`  Active: ${h.isActive}`);
        console.log(`  Deleted: ${h.isDeleted}`);
      });
    }

    // Get all students with semesters
    console.log('\n\n📚 ALL STUDENTS WITH SEMESTERS:');
    console.log('=' .repeat(80));
    const students = await Student.find({ status: 'active' })
      .select('name rollNumber department batchYear section semesters')
      .limit(5);
    
    if (students.length === 0) {
      console.log('❌ NO STUDENTS FOUND!');
    } else {
      students.forEach((s, i) => {
        console.log(`\nStudent ${i + 1}: ${s.name} (${s.rollNumber})`);
        console.log(`  Department: ${s.department}`);
        console.log(`  Batch Year: ${s.batchYear}`);
        console.log(`  Section: ${s.section}`);
        console.log(`  Semesters Count: ${s.semesters?.length || 0}`);
        
        if (s.semesters && s.semesters.length > 0) {
          s.semesters.forEach((sem, j) => {
            console.log(`\n  Semester ${j + 1}:`);
            console.log(`    Name: ${sem.semesterName}`);
            console.log(`    Year: ${sem.year}`);
            console.log(`    Section: ${sem.section}`);
            console.log(`    Batch: ${sem.batch}`);
            console.log(`    Department: ${sem.department}`);
            console.log(`    ClassId: ${sem.classId}`);
          });
        }
      });
    }

    // Try to match holidays with student semesters
    if (allHolidays.length > 0 && students.length > 0) {
      console.log('\n\n🔄 MATCHING ANALYSIS:');
      console.log('=' .repeat(80));
      
      students.forEach(student => {
        console.log(`\n📖 Student: ${student.name}`);
        
        if (!student.semesters || student.semesters.length === 0) {
          console.log('  ⚠️ No semesters array!');
          return;
        }

        student.semesters.forEach(sem => {
          console.log(`\n  Semester: ${sem.semesterName} (${sem.year})`);
          console.log(`  Looking for holidays with:`);
          console.log(`    - department: "${sem.department}"`);
          console.log(`    - batch: "${sem.batch}"`);
          console.log(`    - section: "${sem.section}"`);
          console.log(`    - semester: "${sem.semesterName}"`);
          
          const matchingHolidays = allHolidays.filter(h => {
            // Global holidays match
            if (h.scope === 'global' && h.department === sem.department) {
              return true;
            }
            // Class-specific holidays match
            if (h.scope === 'class' && 
                h.department === sem.department &&
                h.batchYear === sem.batch &&
                h.section === sem.section &&
                h.semester === sem.semesterName) {
              return true;
            }
            return false;
          });

          if (matchingHolidays.length > 0) {
            console.log(`  ✅ Found ${matchingHolidays.length} matching holiday(s):`);
            matchingHolidays.forEach(h => {
              console.log(`    - ${h.date}: ${h.reason} (${h.scope})`);
            });
          } else {
            console.log(`  ❌ NO matching holidays found!`);
            
            // Show what doesn't match
            const classHolidays = allHolidays.filter(h => h.scope === 'class');
            if (classHolidays.length > 0) {
              console.log(`\n  🔍 Available class holidays:`);
              classHolidays.forEach(h => {
                console.log(`    Holiday: ${h.date} - ${h.reason}`);
                console.log(`      dept: "${h.department}" vs "${sem.department}" → ${h.department === sem.department ? '✅' : '❌'}`);
                console.log(`      batch: "${h.batchYear}" vs "${sem.batch}" → ${h.batchYear === sem.batch ? '✅' : '❌'}`);
                console.log(`      section: "${h.section}" vs "${sem.section}" → ${h.section === sem.section ? '✅' : '❌'}`);
                console.log(`      semester: "${h.semester}" vs "${sem.semesterName}" → ${h.semester === sem.semesterName ? '✅' : '❌'}`);
              });
            }
          }
        });
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkHolidays();

