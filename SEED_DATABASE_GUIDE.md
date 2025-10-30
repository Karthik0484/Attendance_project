# 🌱 Database Seeding Guide

This guide will help you populate your database with sample data for testing.

## 📋 What Gets Created

The comprehensive seed script creates a complete test environment with:

### 👥 Users by Role

| Role | Count | Description |
|------|-------|-------------|
| **Admin** | 1 | System administrator with full access |
| **Principal** | 1 | College principal with oversight access |
| **HODs** | 3 | Department heads (CSE, IT, ECE) |
| **Faculty** | 4 | Teaching staff (3 CSE, 1 IT) |
| **Students** | 10 | Students across departments and sections |

### 🎓 Department Distribution

- **CSE (Computer Science Engineering)**: 3 Faculty, 8 Students
- **IT (Information Technology)**: 1 Faculty, 2 Students
- **ECE (Electronics & Communication)**: 1 HOD (no faculty/students)

### 📚 Class Structure

**CSE Department:**
- Batch: 2023-2027
- Year: 2nd Year, Semester 3
- Section A: 5 Students (Class Advisor: Dr. Priya Sharma)
- Section B: 3 Students (Class Advisor: Dr. Meena Krishnan)

**IT Department:**
- Batch: 2024-2028
- Year: 1st Year, Semester 1
- Section A: 2 Students (Class Advisor: Prof. Ramesh Naidu)

## 🚀 How to Run

### Step 1: Navigate to Backend Directory

```bash
cd backend
```

### Step 2: Run the Seed Script

```bash
npm run seed:all
```

**Alternative method:**
```bash
node seed-comprehensive.js
```

### Step 3: Wait for Completion

You'll see output like:
```
🌱 Starting comprehensive database seeding...
🗑️  Clearing existing data...
✅ Cleared existing data
👨‍💻 Creating Admin...
✅ Admin Created: admin@pmc.edu / admin123
...
🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!
```

## 🔑 Login Credentials

### 🔐 Admin Account
```
Email:    admin@pmc.edu
Password: admin123
```

### 🎓 Principal Account
```
Email:    principal@pmc.edu
Password: principal123
```

### 🧑‍🏫 HOD Accounts
```
CSE HOD:  hod.cse@pmc.edu / hod123
IT HOD:   hod.it@pmc.edu / hod123
ECE HOD:  hod.ece@pmc.edu / hod123
```

### 👩‍🏫 Faculty Accounts
```
Dr. Priya Sharma (CSE, Class Advisor):     priya.sharma@pmc.edu / faculty123
Prof. Arun Kumar (CSE):                    arun.kumar@pmc.edu / faculty123
Dr. Meena Krishnan (CSE, Class Advisor):   meena.krishnan@pmc.edu / faculty123
Prof. Ramesh Naidu (IT, Class Advisor):    ramesh.naidu@pmc.edu / faculty123
```

### 🎒 Student Accounts (All use password: `student123`)

**CSE Section A:**
- rahul.verma@student.pmc.edu (CSE23A001)
- anjali.reddy@student.pmc.edu (CSE23A002)
- karthik.sai@student.pmc.edu (CSE23A003)
- divya.krishna@student.pmc.edu (CSE23A004)
- srinivas.rao@student.pmc.edu (CSE23A005)

**CSE Section B:**
- preethi.sharma@student.pmc.edu (CSE23B001)
- vikram.singh@student.pmc.edu (CSE23B002)
- nithya.kumar@student.pmc.edu (CSE23B003)

**IT Section A:**
- sneha.patel@student.pmc.edu (IT24A001)
- arjun.reddy@student.pmc.edu (IT24A002)

## 📊 Database Collections Populated

The script creates/updates these MongoDB collections:

1. **Users** - All user accounts with authentication
2. **Faculty** - Faculty profile details and class assignments
3. **Students** - Student records with semester enrollments
4. **ClassAssignments** - Active class advisor assignments

## ✅ Testing Scenarios

After seeding, you can test:

### 1. Admin Functions
- Login as admin
- Create new users
- View all faculty and students
- Manage departments

### 2. HOD Functions
- Login as HOD (CSE)
- View faculty in CSE department
- Assign classes to faculty
- Create new faculty members
- View students in department

### 3. Faculty Functions (Class Advisor)
- Login as Dr. Priya Sharma
- View assigned class (CSE 2023-2027, 2nd Year, Sem 3, Section A)
- View student list (5 students)
- Mark attendance
- Generate reports

### 4. Faculty Functions (Regular)
- Login as Prof. Arun Kumar
- View dashboard (no assigned classes)
- Request class assignment from HOD

### 5. Student Functions
- Login as any student
- View personal attendance
- View class schedule
- Update profile

## ⚠️ Important Notes

### Data Persistence
- ⚠️ **WARNING**: The seed script will **DELETE ALL EXISTING DATA** before seeding
- Make sure you're running this on a development/test database
- **DO NOT** run on production database

### Re-running the Script
- You can run the script multiple times
- Each run will clear and recreate all data
- Fresh start every time

### Customization
If you want to modify the seed data:
1. Open `backend/seed-comprehensive.js`
2. Edit the user/faculty/student data objects
3. Save and rerun: `npm run seed:all`

## 🔧 Troubleshooting

### Error: "Cannot connect to MongoDB"
**Solution:** 
- Ensure MongoDB is running
- Check your `.env` file has correct `MONGODB_URI`
- Default: `mongodb://localhost:27017/attendance`

### Error: "Module not found"
**Solution:**
```bash
cd backend
npm install
```

### Error: "Duplicate key error"
**Solution:**
- The script should clear data automatically
- If it persists, manually clear collections:
```bash
mongo
use attendance
db.users.deleteMany({})
db.faculties.deleteMany({})
db.students.deleteMany({})
db.classassignments.deleteMany({})
exit
```
Then rerun the seed script.

### Script hangs or doesn't complete
**Solution:**
- Press `Ctrl+C` to stop
- Check MongoDB connection
- Check for any error messages in terminal
- Ensure MongoDB has enough disk space

## 📖 Manual Verification

After seeding, you can verify the data in MongoDB:

```bash
# Connect to MongoDB
mongo

# Select database
use attendance

# Check user count
db.users.count()
# Should return: 18

# Check faculty count
db.faculties.count()
# Should return: 4

# Check student count
db.students.count()
# Should return: 10

# Check class assignments
db.classassignments.count()
# Should return: 4

# View admin user
db.users.findOne({ role: 'admin' })

# Exit
exit
```

## 🎯 Next Steps

After seeding:

1. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Start Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Login and Test**
   - Open browser: `http://localhost:5173`
   - Login as any user from the credentials above
   - Test all functionality

## 📚 Related Scripts

- `npm run seed` - Original basic seed script
- `npm run seed:all` - Comprehensive seed (recommended)
- `npm start` - Start backend server
- `npm run dev` - Start backend with auto-reload

## 🆘 Need Help?

If you encounter issues:
1. Check MongoDB is running
2. Check `.env` configuration
3. Verify Node.js version (should be 16+)
4. Check terminal for specific error messages
5. Try clearing database manually and rerunning

---

**Status:** ✅ Ready to use

**Last Updated:** December 2024

**Version:** 1.0.0

