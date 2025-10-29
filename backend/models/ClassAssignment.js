import mongoose from 'mongoose';

const classAssignmentSchema = new mongoose.Schema({
  departmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  facultyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  batch: { 
    type: String, 
    required: true,
    match: [/^\d{4}-\d{4}$/, 'Batch must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  year: { 
    type: String, 
    required: true,
    enum: {
      values: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      message: 'Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year'
    }
  },
  semester: { 
    type: Number, 
    required: true,
    min: [1, 'Semester must be between 1 and 8'],
    max: [8, 'Semester must be between 1 and 8']
  },
  section: { 
    type: String, 
    required: true,
    enum: {
      values: ['A', 'B', 'C'],
      message: 'Section must be one of: A, B, C'
    },
    trim: true
  },
  assignedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedDate: { 
    type: Date, 
    default: Date.now 
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Completed'],
    default: 'Active',
    index: true
  },
  role: {
    type: String,
    enum: ['Class Advisor', 'Subject Faculty'],
    default: 'Class Advisor',
    index: true
  },
  // Additional metadata
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Track when assignment was deactivated
  deactivatedDate: {
    type: Date
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Status change history for audit
  statusHistory: [{
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Completed']
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      maxlength: 300
    }
  }],
  // Legacy field for backward compatibility
  active: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

// Compound index to ensure only one active assignment per batch-year-semester-section
classAssignmentSchema.index({
  batch: 1,
  year: 1,
  semester: 1,
  section: 1,
  departmentId: 1,
  role: 1
}, {
  unique: true,
  partialFilterExpression: { status: 'Active' },
  name: 'unique_active_assignment_per_section_role'
});

// Index for efficient faculty queries
classAssignmentSchema.index({
  facultyId: 1,
  status: 1,
  role: 1
});

// Index for department queries
classAssignmentSchema.index({
  departmentId: 1,
  status: 1,
  role: 1
});

// Virtual for formatted class display
classAssignmentSchema.virtual('classDisplay').get(function() {
  return `${this.year} | Semester ${this.semester} | Section ${this.section}`;
});

// Virtual for batch-year-semester-section key
classAssignmentSchema.virtual('classKey').get(function() {
  return `${this.batch}-${this.year}-${this.semester}-${this.section}`;
});

// Method to deactivate assignment
classAssignmentSchema.methods.deactivate = async function(deactivatedBy, reason = 'Deactivated by administrator') {
  this.status = 'Inactive';
  this.active = false; // Legacy field
  this.deactivatedDate = new Date();
  this.deactivatedBy = deactivatedBy;
  
  // Add to status history
  this.statusHistory.push({
    status: 'Inactive',
    updatedAt: new Date(),
    updatedBy: deactivatedBy,
    reason
  });
  
  // Also update Faculty model
  const Faculty = (await import('./Faculty.js')).default;
  const faculty = await Faculty.findOne({ userId: this.facultyId });
  
  if (faculty) {
    faculty.assignedClasses = faculty.assignedClasses.map(assignment => {
      if (assignment.batch === this.batch && 
          assignment.year === this.year && 
          assignment.semester === this.semester && 
          assignment.section === this.section &&
          assignment.active) {
        return { ...assignment.toObject(), active: false };
      }
      return assignment;
    });
    await faculty.save();
  }
  
  return this.save();
};

// Method to completely remove assignment from both models
classAssignmentSchema.methods.completeRemoval = async function() {
  // Remove from Faculty model
  const Faculty = (await import('./Faculty.js')).default;
  const faculty = await Faculty.findOne({ userId: this.facultyId });
  
  if (faculty) {
    console.log('🔄 Removing assignment from Faculty model:', { 
      batch: this.batch, 
      year: this.year, 
      semester: this.semester, 
      section: this.section 
    });
    
    faculty.assignedClasses = faculty.assignedClasses.filter(assignment => 
      !(assignment.batch === this.batch && 
        assignment.year === this.year && 
        assignment.semester === this.semester && 
        assignment.section === this.section)
    );
    
    await faculty.save();
    console.log('✅ Assignment removed from Faculty model. Remaining assignments:', faculty.assignedClasses.length);
  }
  
  // Delete the ClassAssignment record completely
  await this.deleteOne();
  console.log('✅ ClassAssignment record deleted completely');
};

// Static method to get active assignments for a faculty
classAssignmentSchema.statics.getActiveAssignments = function(facultyId, role = null) {
  const query = {
    facultyId,
    $or: [
      { status: 'Active' },
      { status: { $exists: false }, active: true }
    ]
  };
  if (role) query.role = role;
  
  return this.find(query)
    .populate('assignedBy', 'name email')
    .sort({ assignedDate: -1 });
};

// Static method to get current advisor for a class
classAssignmentSchema.statics.getCurrentAdvisor = function(batch, year, semester, section, departmentId, role = 'Class Advisor') {
  return this.findOne({
    batch,
    year,
    semester,
    section,
    departmentId,
    role,
    status: 'Active'
  }).populate('facultyId', 'name email position');
};

// Static method to assign new advisor (handles replacement and auto-deactivation)
classAssignmentSchema.statics.assignAdvisor = async function(assignmentData) {
  const { facultyId, batch, year, semester, section, departmentId, assignedBy, notes, role = 'Class Advisor' } = assignmentData;
  
  const session = await this.db.startSession();
  session.startTransaction();
  
  try {
    // Step 1: Find all active assignments for this faculty with the same role (handle both old and new schema)
    const facultyActiveAssignments = await this.find({
      facultyId,
      departmentId,
      role,
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    }).session(session);

    console.log(`📋 Found ${facultyActiveAssignments.length} active ${role} assignment(s) for faculty`);

    // Step 2: Deactivate all existing active assignments for this faculty/role
    const deactivatedAssignments = [];
    for (const assignment of facultyActiveAssignments) {
      assignment.status = 'Inactive';
      assignment.active = false; // Legacy field
      assignment.deactivatedDate = new Date();
      assignment.deactivatedBy = assignedBy;
      assignment.statusHistory.push({
        status: 'Inactive',
        updatedAt: new Date(),
        updatedBy: assignedBy,
        reason: 'New assignment created - auto-deactivated'
      });
      await assignment.save({ session });
      
      deactivatedAssignments.push({
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section,
        classDisplay: `${assignment.batch} | ${assignment.year} | Sem ${assignment.semester} | Sec ${assignment.section}`
      });
      
      console.log(`✅ Deactivated: ${assignment.batch} ${assignment.year} Sem ${assignment.semester} Sec ${assignment.section}`);
    }

    // Step 3: Check if this specific class already has an active advisor (handle both old and new schema)
    const existingClassAdvisor = await this.findOne({
      batch,
      year,
      semester,
      section,
      departmentId,
      role,
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    }).session(session);

    let replacedAdvisor = null;
    if (existingClassAdvisor) {
      // Get the advisor details before deactivation
      const User = (await import('./User.js')).default;
      const advisorUser = await User.findById(existingClassAdvisor.facultyId);
      if (advisorUser) {
        replacedAdvisor = {
          userId: advisorUser._id,
          name: advisorUser.name,
          email: advisorUser.email
        };
      }

      // Deactivate existing class advisor
      existingClassAdvisor.status = 'Inactive';
      existingClassAdvisor.active = false;
      existingClassAdvisor.deactivatedDate = new Date();
      existingClassAdvisor.deactivatedBy = assignedBy;
      existingClassAdvisor.statusHistory.push({
        status: 'Inactive',
        updatedAt: new Date(),
        updatedBy: assignedBy,
        reason: 'Replaced by new advisor'
      });
      await existingClassAdvisor.save({ session });
      
      console.log(`✅ Replaced existing advisor for class`);
    }

    // Step 4: Create new assignment
    const newAssignment = new this({
      facultyId,
      batch,
      year,
      semester,
      section,
      departmentId,
      assignedBy,
      notes,
      role,
      status: 'Active',
      active: true, // Legacy field
      statusHistory: [{
        status: 'Active',
        updatedAt: new Date(),
        updatedBy: assignedBy,
        reason: 'Initial assignment'
      }]
    });

    await newAssignment.save({ session });
    console.log(`✅ Created new ${role} assignment: ${batch} ${year} Sem ${semester} Sec ${section}`);

    // Step 5: Update Faculty model
    const Faculty = (await import('./Faculty.js')).default;
    const faculty = await Faculty.findOne({ userId: facultyId }).session(session);
    
    if (faculty) {
      // Update all existing assignments to inactive
      faculty.assignedClasses = faculty.assignedClasses.map(assignment => {
        if (assignment.active && facultyActiveAssignments.some(a => 
          a.batch === assignment.batch &&
          a.year === assignment.year &&
          a.semester === assignment.semester &&
          a.section === assignment.section
        )) {
          return { ...assignment.toObject(), active: false };
        }
        return assignment;
      });
      
      // Remove the new class if it exists
      faculty.assignedClasses = faculty.assignedClasses.filter(assignment => 
        !(assignment.batch === batch && 
          assignment.year === year && 
          assignment.semester === semester && 
          assignment.section === section)
      );
      
      // Add new assignment
      faculty.assignedClasses.push({
        batch,
        year,
        semester,
        section,
        assignedBy,
        assignedDate: new Date(),
        active: true
      });
      
      await faculty.save({ session });
      console.log('✅ Faculty model updated successfully');
    }

    // Commit transaction
    await session.commitTransaction();
    console.log('✅ Transaction committed successfully');

    return {
      assignment: newAssignment,
      deactivatedAssignments,
      replacedAdvisor
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Transaction failed, rolling back:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Ensure virtual fields are included in JSON output
classAssignmentSchema.set('toJSON', { virtuals: true });
classAssignmentSchema.set('toObject', { virtuals: true });

export default mongoose.model('ClassAssignment', classAssignmentSchema);
