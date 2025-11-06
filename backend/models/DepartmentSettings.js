import mongoose from 'mongoose';

const departmentSettingsSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
    unique: true,
    enum: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']
  },
  hodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  // Attendance Policy Settings
  attendancePolicy: {
    minimumPercentage: {
      type: Number,
      default: 75,
      min: 0,
      max: 100
    },
    graceDays: {
      type: Number,
      default: 0,
      min: 0
    },
    absenceTolerance: {
      type: Number,
      default: 3,
      min: 0
    },
    warningThresholds: {
      critical: {
        type: Number,
        default: 70,
        min: 0,
        max: 100
      },
      warning: {
        type: Number,
        default: 75,
        min: 0,
        max: 100
      },
      good: {
        type: Number,
        default: 90,
        min: 0,
        max: 100
      }
    }
  },
  // Auto Notification Settings
  autoNotifications: {
    enabled: {
      type: Boolean,
      default: false
    },
    notifyFacultyOnLowAttendance: {
      type: Boolean,
      default: true
    },
    notifyStudentsOnDefaulter: {
      type: Boolean,
      default: false
    },
    notifyHODOnTrends: {
      type: Boolean,
      default: true
    }
  },
  // Department Goals
  targetMetrics: {
    departmentAverageAttendance: {
      type: Number,
      default: 85,
      min: 0,
      max: 100
    },
    classAverageAttendance: {
      type: Number,
      default: 80,
      min: 0,
      max: 100
    }
  },
  // Last updated info
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for fast department lookup
departmentSettingsSchema.index({ department: 1 });

// Static method to get or create settings for a department
departmentSettingsSchema.statics.getOrCreateSettings = async function(department) {
  let settings = await this.findOne({ department });
  
  if (!settings) {
    settings = await this.create({ department });
  }
  
  return settings;
};

const DepartmentSettings = mongoose.model('DepartmentSettings', departmentSettingsSchema);

export default DepartmentSettings;
