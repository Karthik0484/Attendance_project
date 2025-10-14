import mongoose from 'mongoose';

// Semester enrollment schema
const semesterEnrollmentSchema = new mongoose.Schema({
  semesterName: {
    type: String,
    required: [true, 'Semester name is required'],
    enum: {
      values: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
      message: 'Semester must be one of: Sem 1 ... Sem 8'
    }
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    enum: {
      values: ['1st', '2nd', '3rd', '4th', '1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st, 2nd, 3rd, 4th, 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    enum: {
      values: ['A', 'B'],
      message: 'Section must be A or B'
    }
  },
  classAssigned: {
    type: String,
    required: [true, 'Class assignment is required'],
    enum: {
      values: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'],
      message: 'Class must be one of: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B'
    }
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Faculty assignment is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
      message: 'Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'
    }
  },
  batch: {
    type: String,
    required: [true, 'Batch is required'],
    match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  classId: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true,
    unique: false // Will be unique per batch via compound index
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  // Global student information
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
      message: 'Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'
    }
  },
  batchYear: {
    type: String,
    required: [true, 'Batch year is required'],
    match: [/^\d{4}-\d{4}$/, 'Batch year must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    enum: {
      values: ['A', 'B'],
      message: 'Section must be A or B'
    }
  },
  // Multi-semester enrollment array
  semesters: [semesterEnrollmentSchema],
  // Legacy fields for backward compatibility (will be deprecated)
  classId: {
    type: String,
    required: false,
    trim: true
  },
  classAssigned: {
    type: String,
    required: false,
    enum: {
      values: ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'],
      message: 'Class must be one of: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B'
    }
  },
  year: {
    type: String,
    required: false,
    enum: {
      values: ['1st', '2nd', '3rd', '4th', '1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st, 2nd, 3rd, 4th, 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  semester: {
    type: String,
    required: false,
    enum: {
      values: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'],
      message: 'Semester must be one of: Sem 1 ... Sem 8'
    }
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: false // Will be moved to semesters array
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  phone: {
    type: String,
    trim: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Mobile number must be exactly 10 digits'
    }
  },
  parentContact: {
    type: String,
    required: [true, 'Parent contact is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Parent contact must be exactly 10 digits'
    }
  },
  address: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, {
  timestamps: true
});

// Pre-save middleware to auto-generate classId for semesters
studentSchema.pre('save', function(next) {
  // Generate classId for each semester enrollment
  if (this.semesters && this.semesters.length > 0) {
    this.semesters.forEach(semester => {
      if (!semester.classId) {
        semester.classId = `${semester.batch}_${semester.year}_${semester.semesterName}_${semester.section}`;
      }
    });
  }
  
  // Legacy support - generate classId for old structure
  if (!this.classId && this.batch && this.year && this.semester) {
    this.classId = `${this.batch}_${this.year}_${this.semester}_${this.section || 'A'}`;
  }
  next();
});

// Compound unique index to enforce roll number unique within batch and section
studentSchema.index(
  { batchYear: 1, section: 1, rollNumber: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

// Index for efficient querying by semester enrollment
studentSchema.index({ 
  'semesters.semesterName': 1, 
  'semesters.year': 1, 
  'semesters.facultyId': 1,
  'semesters.status': 1 
});

// Index for faculty queries by semester
studentSchema.index({ 
  'semesters.facultyId': 1, 
  'semesters.status': 1,
  status: 1 
});

// Index for department queries
studentSchema.index({ department: 1, status: 1 });

// Index for batch queries
studentSchema.index({ batchYear: 1, section: 1, status: 1 });

// Index for legacy classId queries (backward compatibility)
studentSchema.index({ classId: 1, status: 1 });

// Index for legacy facultyId queries (backward compatibility)
studentSchema.index({ facultyId: 1, status: 1 });

// Remove password from JSON output (legacy safety if present)
studentSchema.methods.toJSON = function() {
  const studentObject = this.toObject();
  if (studentObject.password) delete studentObject.password;
  return studentObject;
};

export default mongoose.model('Student', studentSchema);
