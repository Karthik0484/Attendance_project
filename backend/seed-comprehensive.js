import mongoose from 'mongoose';
import User from './models/User.js';
import Faculty from './models/Faculty.js';
import Student from './models/Student.js';
import ClassAssignment from './models/ClassAssignment.js';
import config from './config/config.js';

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const seedDatabase = async () => {
  try {
    console.log('\n🌱 Starting comprehensive database seeding...\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Faculty.deleteMany({});
    await Student.deleteMany({});
    await ClassAssignment.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // ==================== ADMIN ====================
    console.log('👨‍💻 Creating Admin...');
    const admin = new User({
      name: 'System Administrator',
      email: 'admin@pmc.edu',
      password: 'admin123',
      role: 'admin',
      phone: '9876543210',
      address: 'PMC College Campus'
    });
    await admin.save();
    console.log('✅ Admin Created: admin@pmc.edu / admin123\n');

    // ==================== PRINCIPAL ====================
    console.log('🎓 Creating Principal...');
    const principal = new User({
      name: 'Dr. Rajesh Kumar',
      email: 'principal@pmc.edu',
      password: 'principal123',
      role: 'principal',
      phone: '9876543211',
      address: 'PMC College Campus',
      createdBy: admin._id
    });
    await principal.save();
    console.log('✅ Principal Created: principal@pmc.edu / principal123\n');

    // ==================== HODs ====================
    console.log('🧑‍🏫 Creating HODs...');
    
    // CSE HOD
    const hodCSE = new User({
      name: 'Dr. Suresh Babu',
      email: 'hod.cse@pmc.edu',
      password: 'hod123',
      role: 'hod',
      department: 'CSE',
      phone: '9876543212',
      address: 'CSE Department, PMC',
      createdBy: admin._id
    });
    await hodCSE.save();
    console.log('✅ HOD (CSE) Created: hod.cse@pmc.edu / hod123');

    // IT HOD
    const hodIT = new User({
      name: 'Prof. Lakshmi Reddy',
      email: 'hod.it@pmc.edu',
      password: 'hod123',
      role: 'hod',
      department: 'IT',
      phone: '9876543213',
      address: 'IT Department, PMC',
      createdBy: admin._id
    });
    await hodIT.save();
    console.log('✅ HOD (IT) Created: hod.it@pmc.edu / hod123');

    // ECE HOD
    const hodECE = new User({
      name: 'Dr. Venkat Rao',
      email: 'hod.ece@pmc.edu',
      password: 'hod123',
      role: 'hod',
      department: 'ECE',
      phone: '9876543214',
      address: 'ECE Department, PMC',
      createdBy: admin._id
    });
    await hodECE.save();
    console.log('✅ HOD (ECE) Created: hod.ece@pmc.edu / hod123\n');

    // ==================== FACULTY (CSE) ====================
    console.log('👩‍🏫 Creating Faculty Members (CSE)...');
    
    // Faculty 1 - Class Advisor
    const facultyUser1 = new User({
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@pmc.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'CSE',
      phone: '9876543215',
      createdBy: hodCSE._id
    });
    await facultyUser1.save();

    const faculty1 = new Faculty({
      userId: facultyUser1._id,
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@pmc.edu',
      position: 'Associate Professor',
      department: 'CSE',
      phone: '9876543215',
      is_class_advisor: true,
      batch: '2023-2027',
      year: '2nd Year',
      semester: 3,
      section: 'A',
      assignedClass: '2023-2027, 2nd Year, Sem 3, Section A',
      assignedClasses: [{
        batch: '2023-2027',
        year: '2nd Year',
        semester: 3,
        section: 'A',
        assignedDate: new Date(),
        assignedBy: hodCSE._id,
        active: true
      }],
      createdBy: hodCSE._id
    });
    await faculty1.save();
    console.log('✅ Faculty (CSE) Created: priya.sharma@pmc.edu / faculty123 (Class Advisor)');

    // Create ClassAssignment for Faculty 1
    const classAssignment1 = new ClassAssignment({
      facultyId: facultyUser1._id,
      batch: '2023-2027',
      year: '2nd Year',
      semester: 3,
      section: 'A',
      departmentId: hodCSE._id,
      assignedBy: hodCSE._id,
      status: 'Active',
      active: true,
      role: 'Class Advisor',
      notes: 'Initial class advisor assignment'
    });
    await classAssignment1.save();

    // Faculty 2 - Regular Faculty
    const facultyUser2 = new User({
      name: 'Prof. Arun Kumar',
      email: 'arun.kumar@pmc.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'CSE',
      phone: '9876543216',
      createdBy: hodCSE._id
    });
    await facultyUser2.save();

    const faculty2 = new Faculty({
      userId: facultyUser2._id,
      name: 'Prof. Arun Kumar',
      email: 'arun.kumar@pmc.edu',
      position: 'Assistant Professor',
      department: 'CSE',
      phone: '9876543216',
      is_class_advisor: false,
      assignedClass: 'None',
      assignedClasses: [],
      createdBy: hodCSE._id
    });
    await faculty2.save();
    console.log('✅ Faculty (CSE) Created: arun.kumar@pmc.edu / faculty123');

    // Faculty 3 - Class Advisor for another section
    const facultyUser3 = new User({
      name: 'Dr. Meena Krishnan',
      email: 'meena.krishnan@pmc.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'CSE',
      phone: '9876543217',
      createdBy: hodCSE._id
    });
    await facultyUser3.save();

    const faculty3 = new Faculty({
      userId: facultyUser3._id,
      name: 'Dr. Meena Krishnan',
      email: 'meena.krishnan@pmc.edu',
      position: 'Professor',
      department: 'CSE',
      phone: '9876543217',
      is_class_advisor: true,
      batch: '2023-2027',
      year: '2nd Year',
      semester: 3,
      section: 'B',
      assignedClass: '2023-2027, 2nd Year, Sem 3, Section B',
      assignedClasses: [{
        batch: '2023-2027',
        year: '2nd Year',
        semester: 3,
        section: 'B',
        assignedDate: new Date(),
        assignedBy: hodCSE._id,
        active: true
      }],
      createdBy: hodCSE._id
    });
    await faculty3.save();
    console.log('✅ Faculty (CSE) Created: meena.krishnan@pmc.edu / faculty123 (Class Advisor)\n');

    // Create ClassAssignment for Faculty 3
    const classAssignment3 = new ClassAssignment({
      facultyId: facultyUser3._id,
      batch: '2023-2027',
      year: '2nd Year',
      semester: 3,
      section: 'B',
      departmentId: hodCSE._id,
      assignedBy: hodCSE._id,
      status: 'Active',
      active: true,
      role: 'Class Advisor',
      notes: 'Initial class advisor assignment'
    });
    await classAssignment3.save();

    // ==================== FACULTY (IT) ====================
    console.log('👩‍🏫 Creating Faculty Members (IT)...');
    
    const facultyUser4 = new User({
      name: 'Prof. Ramesh Naidu',
      email: 'ramesh.naidu@pmc.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'IT',
      phone: '9876543218',
      createdBy: hodIT._id
    });
    await facultyUser4.save();

    const faculty4 = new Faculty({
      userId: facultyUser4._id,
      name: 'Prof. Ramesh Naidu',
      email: 'ramesh.naidu@pmc.edu',
      position: 'Assistant Professor',
      department: 'IT',
      phone: '9876543218',
      is_class_advisor: true,
      batch: '2024-2028',
      year: '1st Year',
      semester: 1,
      section: 'A',
      assignedClass: '2024-2028, 1st Year, Sem 1, Section A',
      assignedClasses: [{
        batch: '2024-2028',
        year: '1st Year',
        semester: 1,
        section: 'A',
        assignedDate: new Date(),
        assignedBy: hodIT._id,
        active: true
      }],
      createdBy: hodIT._id
    });
    await faculty4.save();
    console.log('✅ Faculty (IT) Created: ramesh.naidu@pmc.edu / faculty123 (Class Advisor)\n');

    // Create ClassAssignment for Faculty 4
    const classAssignment4 = new ClassAssignment({
      facultyId: facultyUser4._id,
      batch: '2024-2028',
      year: '1st Year',
      semester: 1,
      section: 'A',
      departmentId: hodIT._id,
      assignedBy: hodIT._id,
      status: 'Active',
      active: true,
      role: 'Class Advisor',
      notes: 'Initial class advisor assignment'
    });
    await classAssignment4.save();

    // ==================== STUDENTS (CSE - Section A) ====================
    console.log('🎒 Creating Students (CSE - Section A)...');
    
    const cseStudentsA = [
      {
        name: 'Rahul Verma',
        email: 'rahul.verma@student.pmc.edu',
        rollNumber: 'CSE23A001',
        dateOfBirth: new Date('2005-03-15'),
        mobile: '9876543301',
        parentContact: '9876543302',
        address: 'Hyderabad, Telangana'
      },
      {
        name: 'Anjali Reddy',
        email: 'anjali.reddy@student.pmc.edu',
        rollNumber: 'CSE23A002',
        dateOfBirth: new Date('2005-06-20'),
        mobile: '9876543303',
        parentContact: '9876543304',
        address: 'Warangal, Telangana'
      },
      {
        name: 'Karthik Sai',
        email: 'karthik.sai@student.pmc.edu',
        rollNumber: 'CSE23A003',
        dateOfBirth: new Date('2005-01-10'),
        mobile: '9876543305',
        parentContact: '9876543306',
        address: 'Nizamabad, Telangana'
      },
      {
        name: 'Divya Krishna',
        email: 'divya.krishna@student.pmc.edu',
        rollNumber: 'CSE23A004',
        dateOfBirth: new Date('2005-08-25'),
        mobile: '9876543307',
        parentContact: '9876543308',
        address: 'Karimnagar, Telangana'
      },
      {
        name: 'Srinivas Rao',
        email: 'srinivas.rao@student.pmc.edu',
        rollNumber: 'CSE23A005',
        dateOfBirth: new Date('2005-11-30'),
        mobile: '9876543309',
        parentContact: '9876543310',
        address: 'Khammam, Telangana'
      }
    ];

    for (const studentData of cseStudentsA) {
      // Create User
      const studentUser = new User({
        name: studentData.name,
        email: studentData.email,
        password: 'student123',
        role: 'student',
        department: 'CSE',
        class: '2023-2027_2nd Year_3_A',
        phone: studentData.mobile,
        createdBy: facultyUser1._id
      });
      await studentUser.save();

      // Create Student
      const student = new Student({
        userId: studentUser._id,
        name: studentData.name,
        email: studentData.email,
        rollNumber: studentData.rollNumber,
        dateOfBirth: studentData.dateOfBirth,
        mobile: studentData.mobile,
        parentContact: studentData.parentContact,
        address: studentData.address,
        emergencyContact: studentData.parentContact,
        department: 'CSE',
        batchYear: '2023-2027',
        section: 'A',
        status: 'active',
        semesters: [
          {
            year: '2nd Year',
            semesterName: 'Sem 3',
            semesterNumber: 3,
            classId: '2023-2027_2nd Year_3_A',
            facultyId: facultyUser1._id,
            status: 'active',
            enrolledDate: new Date()
          }
        ],
        currentSemester: 3,
        createdBy: facultyUser1._id,
        facultyId: facultyUser1._id
      });
      await student.save();
      console.log(`✅ Student Created: ${studentData.email} / student123 (${studentData.rollNumber})`);
    }

    // ==================== STUDENTS (CSE - Section B) ====================
    console.log('\n🎒 Creating Students (CSE - Section B)...');
    
    const cseStudentsB = [
      {
        name: 'Preethi Sharma',
        email: 'preethi.sharma@student.pmc.edu',
        rollNumber: 'CSE23B001',
        dateOfBirth: new Date('2005-02-14'),
        mobile: '9876543311',
        parentContact: '9876543312',
        address: 'Hyderabad, Telangana'
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.singh@student.pmc.edu',
        rollNumber: 'CSE23B002',
        dateOfBirth: new Date('2005-07-18'),
        mobile: '9876543313',
        parentContact: '9876543314',
        address: 'Secunderabad, Telangana'
      },
      {
        name: 'Nithya Kumar',
        email: 'nithya.kumar@student.pmc.edu',
        rollNumber: 'CSE23B003',
        dateOfBirth: new Date('2005-04-22'),
        mobile: '9876543315',
        parentContact: '9876543316',
        address: 'Mancherial, Telangana'
      }
    ];

    for (const studentData of cseStudentsB) {
      // Create User
      const studentUser = new User({
        name: studentData.name,
        email: studentData.email,
        password: 'student123',
        role: 'student',
        department: 'CSE',
        class: '2023-2027_2nd Year_3_B',
        phone: studentData.mobile,
        createdBy: facultyUser3._id
      });
      await studentUser.save();

      // Create Student
      const student = new Student({
        userId: studentUser._id,
        name: studentData.name,
        email: studentData.email,
        rollNumber: studentData.rollNumber,
        dateOfBirth: studentData.dateOfBirth,
        mobile: studentData.mobile,
        parentContact: studentData.parentContact,
        address: studentData.address,
        emergencyContact: studentData.parentContact,
        department: 'CSE',
        batchYear: '2023-2027',
        section: 'B',
        status: 'active',
        semesters: [
          {
            year: '2nd Year',
            semesterName: 'Sem 3',
            semesterNumber: 3,
            classId: '2023-2027_2nd Year_3_B',
            facultyId: facultyUser3._id,
            status: 'active',
            enrolledDate: new Date()
          }
        ],
        currentSemester: 3,
        createdBy: facultyUser3._id,
        facultyId: facultyUser3._id
      });
      await student.save();
      console.log(`✅ Student Created: ${studentData.email} / student123 (${studentData.rollNumber})`);
    }

    // ==================== STUDENTS (IT - Section A) ====================
    console.log('\n🎒 Creating Students (IT - Section A)...');
    
    const itStudentsA = [
      {
        name: 'Sneha Patel',
        email: 'sneha.patel@student.pmc.edu',
        rollNumber: 'IT24A001',
        dateOfBirth: new Date('2006-05-12'),
        mobile: '9876543317',
        parentContact: '9876543318',
        address: 'Adilabad, Telangana'
      },
      {
        name: 'Arjun Reddy',
        email: 'arjun.reddy@student.pmc.edu',
        rollNumber: 'IT24A002',
        dateOfBirth: new Date('2006-09-08'),
        mobile: '9876543319',
        parentContact: '9876543320',
        address: 'Nalgonda, Telangana'
      }
    ];

    for (const studentData of itStudentsA) {
      // Create User
      const studentUser = new User({
        name: studentData.name,
        email: studentData.email,
        password: 'student123',
        role: 'student',
        department: 'IT',
        class: '2024-2028_1st Year_1_A',
        phone: studentData.mobile,
        createdBy: facultyUser4._id
      });
      await studentUser.save();

      // Create Student
      const student = new Student({
        userId: studentUser._id,
        name: studentData.name,
        email: studentData.email,
        rollNumber: studentData.rollNumber,
        dateOfBirth: studentData.dateOfBirth,
        mobile: studentData.mobile,
        parentContact: studentData.parentContact,
        address: studentData.address,
        emergencyContact: studentData.parentContact,
        department: 'IT',
        batchYear: '2024-2028',
        section: 'A',
        status: 'active',
        semesters: [
          {
            year: '1st Year',
            semesterName: 'Sem 1',
            semesterNumber: 1,
            classId: '2024-2028_1st Year_1_A',
            facultyId: facultyUser4._id,
            status: 'active',
            enrolledDate: new Date()
          }
        ],
        currentSemester: 1,
        createdBy: facultyUser4._id,
        facultyId: facultyUser4._id
      });
      await student.save();
      console.log(`✅ Student Created: ${studentData.email} / student123 (${studentData.rollNumber})`);
    }

    // ==================== SUMMARY ====================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    console.log('\n📊 SUMMARY:');
    console.log('   👨‍💻 1 Admin');
    console.log('   🎓 1 Principal');
    console.log('   🧑‍🏫 3 HODs (CSE, IT, ECE)');
    console.log('   👩‍🏫 4 Faculty Members (3 CSE, 1 IT)');
    console.log('   🎒 10 Students (5 CSE-A, 3 CSE-B, 2 IT-A)');
    console.log('   📋 4 Class Assignments');

    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('\n   ADMIN:');
    console.log('   ├─ Email: admin@pmc.edu');
    console.log('   └─ Password: admin123');
    
    console.log('\n   PRINCIPAL:');
    console.log('   ├─ Email: principal@pmc.edu');
    console.log('   └─ Password: principal123');
    
    console.log('\n   HODs:');
    console.log('   ├─ CSE: hod.cse@pmc.edu / hod123');
    console.log('   ├─ IT:  hod.it@pmc.edu / hod123');
    console.log('   └─ ECE: hod.ece@pmc.edu / hod123');
    
    console.log('\n   FACULTY:');
    console.log('   ├─ Dr. Priya Sharma (CSE, Class Advisor): priya.sharma@pmc.edu / faculty123');
    console.log('   ├─ Prof. Arun Kumar (CSE): arun.kumar@pmc.edu / faculty123');
    console.log('   ├─ Dr. Meena Krishnan (CSE, Class Advisor): meena.krishnan@pmc.edu / faculty123');
    console.log('   └─ Prof. Ramesh Naidu (IT, Class Advisor): ramesh.naidu@pmc.edu / faculty123');
    
    console.log('\n   STUDENTS (All have password: student123):');
    console.log('   ├─ CSE Section A: rahul.verma@student.pmc.edu (and 4 more)');
    console.log('   ├─ CSE Section B: preethi.sharma@student.pmc.edu (and 2 more)');
    console.log('   └─ IT Section A: sneha.patel@student.pmc.edu (and 1 more)');

    console.log('\n📚 CLASS ASSIGNMENTS:');
    console.log('   ├─ 2023-2027, 2nd Year, Sem 3, Section A → Dr. Priya Sharma (CSE)');
    console.log('   ├─ 2023-2027, 2nd Year, Sem 3, Section B → Dr. Meena Krishnan (CSE)');
    console.log('   └─ 2024-2028, 1st Year, Sem 1, Section A → Prof. Ramesh Naidu (IT)');

    console.log('\n' + '='.repeat(70));
    console.log('✨ You can now login and test the system!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ SEEDING ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the seeding process
connectDB().then(() => {
  seedDatabase();
});

