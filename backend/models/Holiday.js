import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  holidayId: {
    type: String,
    unique: true,
    default: function() {
      return `HOL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  date: {
    type: String, // ISO date string (YYYY-MM-DD)
    required: [true, 'Holiday date is required'],
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Holiday date must be in YYYY-MM-DD format'
    }
  },
  reason: {
    type: String,
    required: [true, 'Holiday reason is required'],
    trim: true,
    maxlength: [255, 'Reason cannot exceed 255 characters']
  },
  declaredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Declared by is required']
  },
  scope: {
    type: String,
    required: [true, 'Scope is required'],
    enum: {
      values: ['class', 'global'],
      message: 'Scope must be either "class" or "global"'
    },
    default: 'class'
  },
  batchYear: {
    type: String,
    required: function() {
      return this.scope === 'class';
    },
    index: true
  },
  section: {
    type: String,
    required: function() {
      return this.scope === 'class';
    },
    index: true
  },
  semester: {
    type: String,
    required: function() {
      return this.scope === 'class';
    },
    index: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: false,
    index: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: {
      values: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
      message: 'Department must be one of: CSE, IT, ECE, EEE, Civil, Mechanical, CSBS, AIDS'
    },
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save hook to normalize dates to YYYY-MM-DD strings
holidaySchema.pre('save', function(next) {
  if (this.date instanceof Date) {
    // Convert Date to YYYY-MM-DD string
    this.date = this.date.toISOString().split('T')[0];
  } else if (typeof this.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
    // If it's a string but not in YYYY-MM-DD format, try to convert it
    const date = new Date(this.date);
    if (!isNaN(date.getTime())) {
      this.date = date.toISOString().split('T')[0];
    }
  }
  next();
});

// Index for efficient querying by date range and class context
holidaySchema.index({ date: 1, department: 1, isActive: 1, isDeleted: 1 });
holidaySchema.index({ date: 1, batchYear: 1, section: 1, semester: 1, department: 1, isActive: 1, isDeleted: 1 });

// Compound unique index to ensure holiday date is unique within each class scope
holidaySchema.index({ 
  date: 1, 
  batchYear: 1, 
  section: 1, 
  semester: 1, 
  department: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    isDeleted: false, 
    isActive: true,
    scope: 'class'
  }
});

// Compound unique index for global holidays
holidaySchema.index({ 
  date: 1, 
  department: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    isDeleted: false, 
    isActive: true,
    scope: 'global'
  }
});

export default mongoose.model('Holiday', holidaySchema);
