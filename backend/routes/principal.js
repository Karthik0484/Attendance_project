import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import DepartmentSettings from '../models/DepartmentSettings.js';
import DepartmentHODMapping from '../models/DepartmentHODMapping.js';
import Notification from '../models/Notification.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import bcrypt from 'bcryptjs';
import DEPARTMENTS from '../config/departments.js';

const router = express.Router();

// All routes require Principal role
router.use(authenticate);
router.use(authorize('principal'));

// @desc    Get all departments with their HODs (Active and Inactive)
// @route   GET /api/principal/hods
// @access  Principal only
router.get('/hods', async (req, res) => {
  try {
    const { status = 'all', search = '', sortBy = 'department' } = req.query;
    const departments = DEPARTMENTS;
    
    const departmentsWithHODs = await Promise.all(
      departments.map(async (dept) => {
        // Get department settings
        const deptSettings = await DepartmentSettings.findOne({ department: dept });
        
        // Get active HOD mapping with populated fields
        const activeMapping = await DepartmentHODMapping.findOne({
          departmentId: dept,
          status: 'active'
        })
        .populate('hodId', 'name email department role status mobile createdAt lastLogin accessLevel expiryDate')
        .populate('assignedBy', 'name email');
        
        // Get all HOD mappings for this department (for history)
        const allMappings = await DepartmentHODMapping.find({ departmentId: dept })
          .populate('hodId', 'name email department role status mobile createdAt lastLogin accessLevel expiryDate')
          .populate('assignedBy', 'name email')
          .populate('deactivatedBy', 'name email')
          .sort({ assignedOn: -1 });
        
        // Get active HOD user details if exists
        let hodUser = null;
        if (activeMapping && activeMapping.hodId) {
          // Use the populated hodId from activeMapping, or fetch if not populated
          if (activeMapping.hodId && typeof activeMapping.hodId === 'object' && activeMapping.hodId.name) {
            hodUser = activeMapping.hodId;
          } else {
            hodUser = await User.findById(activeMapping.hodId)
              .select('name email department role status mobile createdAt lastLogin accessLevel expiryDate');
          }
        }
        
        // Get inactive HODs for this department
        const inactiveMappings = allMappings.filter(m => m.status === 'inactive');
        
        // Get the current active HOD for this department (if exists)
        const currentActiveMapping = allMappings.find(m => m.status === 'active');
        
        const inactiveHODs = inactiveMappings.map(mapping => {
          // Check if this inactive HOD was replaced
          let replacedBy = null;
          
          // If there's a current active HOD for this department, check if this inactive one was replaced by it
          if (currentActiveMapping && currentActiveMapping.hodId) {
            // Strategy 1: Check if notes indicate replacement
            if (mapping.notes && mapping.notes.toLowerCase().includes('replaced')) {
              replacedBy = {
                id: currentActiveMapping.hodId?._id || currentActiveMapping.hodId,
                name: currentActiveMapping.hodId?.name || 'Unknown',
                email: currentActiveMapping.hodId?.email || 'N/A'
              };
            }
            // Strategy 2: Check date logic - if active HOD was assigned after this one was deactivated
            else if (mapping.deactivatedOn) {
              const deactivatedDate = new Date(mapping.deactivatedOn);
              const activeAssignedDate = new Date(currentActiveMapping.assignedOn);
              
              // Allow for same-day replacements (within 24 hours)
              const timeDiff = activeAssignedDate.getTime() - deactivatedDate.getTime();
              const hoursDiff = timeDiff / (1000 * 60 * 60);
              
              // If active HOD was assigned within 24 hours after deactivation, it's likely the replacement
              if (timeDiff >= 0 && hoursDiff <= 24) {
                replacedBy = {
                  id: currentActiveMapping.hodId?._id || currentActiveMapping.hodId,
                  name: currentActiveMapping.hodId?.name || 'Unknown',
                  email: currentActiveMapping.hodId?.email || 'N/A'
                };
              }
            }
            // Strategy 3: If no deactivatedOn but there's an active HOD assigned after this one
            else {
              const inactiveAssignedDate = new Date(mapping.assignedOn);
              const activeAssignedDate = new Date(currentActiveMapping.assignedOn);
              
              // If active HOD was assigned after this inactive one, it's likely the replacement
              if (activeAssignedDate > inactiveAssignedDate) {
                replacedBy = {
                  id: currentActiveMapping.hodId?._id || currentActiveMapping.hodId,
                  name: currentActiveMapping.hodId?.name || 'Unknown',
                  email: currentActiveMapping.hodId?.email || 'N/A'
                };
              }
            }
          }
          
          return {
            id: mapping.hodId?._id || mapping.hodId,
            name: mapping.hodId?.name || 'Unknown',
            email: mapping.hodId?.email || 'N/A',
            mobile: mapping.hodId?.mobile || 'N/A',
            status: mapping.hodId?.status || 'inactive',
            lastLogin: mapping.hodId?.lastLogin || null,
            accessLevel: mapping.hodId?.accessLevel || 'restricted',
            expiryDate: mapping.hodId?.expiryDate || null,
            assignedOn: mapping.assignedOn,
            deactivatedOn: mapping.deactivatedOn,
            assignedBy: mapping.assignedBy?.name || 'Unknown',
            deactivatedBy: mapping.deactivatedBy?.name || 'Unknown',
            notes: mapping.notes || '',
            replacedBy: replacedBy
          };
        });
        
        // Calculate HOD tenure (days active)
        let tenureDays = null;
        if (activeMapping && activeMapping.assignedOn) {
          const assignedDate = new Date(activeMapping.assignedOn);
          const today = new Date();
          tenureDays = Math.floor((today - assignedDate) / (1000 * 60 * 60 * 24));
        }
        
        // Double-check: if department settings has hodId but we didn't find active mapping, fetch it
        if (!hodUser && deptSettings?.hodId) {
          const directHOD = await User.findById(deptSettings.hodId)
            .select('name email department role status mobile createdAt lastLogin accessLevel expiryDate');
          if (directHOD && directHOD.status === 'active') {
            hodUser = directHOD;
            // Find or create the mapping
            let directMapping = await DepartmentHODMapping.findOne({
              departmentId: dept,
              hodId: directHOD._id,
              status: 'active'
            });
            if (!directMapping) {
              // Create missing mapping
              directMapping = await DepartmentHODMapping.findOne({
                departmentId: dept,
                hodId: directHOD._id
              }).sort({ assignedOn: -1 });
            }
            if (directMapping && directMapping.assignedOn) {
              const assignedDate = new Date(directMapping.assignedOn);
              const today = new Date();
              tenureDays = Math.floor((today - assignedDate) / (1000 * 60 * 60 * 24));
            }
          }
        }
        
        return {
          department: dept,
          hodId: deptSettings?.hodId || null,
          hod: hodUser ? {
            id: hodUser._id,
            name: hodUser.name,
            email: hodUser.email,
            mobile: hodUser.mobile || 'N/A',
            status: hodUser.status,
            lastLogin: hodUser.lastLogin || null,
            accessLevel: hodUser.accessLevel || (hodUser.status === 'active' ? 'full' : 'restricted'),
            expiryDate: hodUser.expiryDate || null,
            assignedOn: activeMapping?.assignedOn || (hodUser.createdAt ? new Date(hodUser.createdAt) : new Date()),
            assignedBy: activeMapping?.assignedBy?.name || 'Unknown',
            tenureDays: tenureDays
          } : null,
          hasHOD: !!hodUser && hodUser.status === 'active',
          inactiveHODs: inactiveHODs,
          totalHODsAssigned: allMappings.length
        };
      })
    );

    // Apply filters
    let filteredData = departmentsWithHODs;
    
    // Filter by status - strict filtering
    if (status === 'active') {
      // Show departments with active HODs OR departments without any HOD assigned
      // This allows assigning HODs to vacant departments from the Active tab
      filteredData = filteredData.filter(dept => {
        const hasActiveHOD = dept.hasHOD && dept.hod && dept.hod.status === 'active';
        const hasNoHOD = !dept.hasHOD || !dept.hod;
        return hasActiveHOD || hasNoHOD;
      });
    } else if (status === 'inactive') {
      // Show departments with inactive HODs in history OR departments without active HODs
      // This allows showing replaced HODs even if there's a new active HOD
      filteredData = filteredData.filter(dept => {
        const hasActiveHOD = dept.hasHOD && dept.hod && dept.hod.status === 'active';
        const hasInactiveHistory = dept.inactiveHODs && dept.inactiveHODs.length > 0;
        
        // Include if:
        // 1. Has inactive HODs in history (even if there's also an active HOD - for replaced HODs)
        // 2. OR has no active HOD at all
        return hasInactiveHistory || !hasActiveHOD;
      });
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(dept => {
        const deptMatch = dept.department.toLowerCase().includes(searchLower);
        const hodMatch = dept.hod && (
          dept.hod.name.toLowerCase().includes(searchLower) ||
          dept.hod.email.toLowerCase().includes(searchLower)
        );
        const inactiveMatch = dept.inactiveHODs.some(hod => 
          hod.name.toLowerCase().includes(searchLower) ||
          hod.email.toLowerCase().includes(searchLower)
        );
        return deptMatch || hodMatch || inactiveMatch;
      });
    }
    
    // Sort data
    if (sortBy === 'department') {
      filteredData.sort((a, b) => a.department.localeCompare(b.department));
    } else if (sortBy === 'assignedDate') {
      filteredData.sort((a, b) => {
        const dateA = a.hod?.assignedOn ? new Date(a.hod.assignedOn) : new Date(0);
        const dateB = b.hod?.assignedOn ? new Date(b.hod.assignedOn) : new Date(0);
        return dateB - dateA; // Newest first
      });
    } else if (sortBy === 'tenure') {
      filteredData.sort((a, b) => {
        const tenureA = a.hod?.tenureDays || 0;
        const tenureB = b.hod?.tenureDays || 0;
        return tenureB - tenureA; // Longest tenure first
      });
    }

    res.status(200).json({
      success: true,
      data: filteredData,
      filters: {
        status,
        search,
        sortBy
      },
      summary: {
        total: departmentsWithHODs.length,
        active: departmentsWithHODs.filter(d => d.hasHOD && d.hod?.status === 'active').length,
        inactive: departmentsWithHODs.filter(d => !d.hasHOD || d.hod?.status !== 'active').length,
        withHistory: departmentsWithHODs.filter(d => d.inactiveHODs.length > 0).length
      }
    });
  } catch (error) {
    console.error('Error fetching HODs:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching HOD information'
    });
  }
});

// @desc    Create new HOD
// @route   POST /api/principal/hods
// @access  Principal only
router.post('/hods', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('department').isIn(DEPARTMENTS).withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}`),
  body('mobile').optional({ values: 'falsy' }).matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, department, mobile } = req.body;
    const principalId = req.user._id;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: 'User with this email already exists'
      });
    }

    // Check if department already has an active HOD
    const activeHODMapping = await DepartmentHODMapping.findOne({
      departmentId: department,
      status: 'active'
    });

    if (activeHODMapping) {
      return res.status(400).json({
        success: false,
        msg: `Department ${department} already has an active HOD. Please deactivate or replace the existing HOD first.`,
        existingHOD: {
          id: activeHODMapping.hodId,
          assignedOn: activeHODMapping.assignedOn
        }
      });
    }

    // Generate password if not provided
    let finalPassword = password;
    if (!finalPassword) {
      finalPassword = `HOD${department}${Date.now().toString().slice(-6)}`;
    }

    // Create HOD user
    const hodUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: finalPassword,
      role: 'hod',
      department: department,
      mobile: mobile || undefined,
      status: 'active',
      createdBy: principalId
    });

    await hodUser.save();

    // Update or create department settings
    let deptSettings = await DepartmentSettings.findOne({ department });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({
        department,
        hodId: hodUser._id,
        updatedBy: principalId
      });
    } else {
      deptSettings.hodId = hodUser._id;
      deptSettings.updatedBy = principalId;
    }
    await deptSettings.save();

    // Create HOD mapping for history
    const hodMapping = new DepartmentHODMapping({
      departmentId: department,
      hodId: hodUser._id,
      assignedBy: principalId,
      assignedOn: new Date(),
      status: 'active'
    });
    await hodMapping.save();

    // Remove password from response
    const hodUserResponse = hodUser.toObject();
    delete hodUserResponse.password;

    res.status(201).json({
      success: true,
      msg: `HOD created successfully for ${department} department`,
      data: {
        hod: hodUserResponse,
        generatedPassword: !password ? finalPassword : undefined,
        assignedBy: {
          id: principalId,
          name: req.user.name
        },
        assignedOn: hodMapping.assignedOn
      }
    });
  } catch (error) {
    console.error('Error creating HOD:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: 'Email or department mapping already exists'
      });
    }

    res.status(500).json({
      success: false,
      msg: 'Error creating HOD',
      error: error.message
    });
  }
});

// @desc    Replace existing HOD (deactivate old, create new)
// @route   PUT /api/principal/hods/:departmentId/replace
// @access  Principal only
router.put('/hods/:departmentId/replace', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('mobile').optional({ values: 'falsy' }).matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('deactivateOldHOD').optional().isBoolean().withMessage('deactivateOldHOD must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { departmentId } = req.params;
    const { name, email, password, mobile, deactivateOldHOD = true } = req.body;
    const principalId = req.user._id;

    // Validate department
    if (!DEPARTMENTS.includes(departmentId)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid department. Must be one of: ${DEPARTMENTS.join(', ')}`
      });
    }

    // Get current active HOD first
    const activeHODMapping = await DepartmentHODMapping.findOne({
      departmentId: departmentId,
      status: 'active'
    });

    // Check if email already exists (excluding the old HOD being replaced)
    const existingUser = await User.findOne({ 
      email: email.toLowerCase().trim(),
      status: 'active'
    });
    
    // Allow if the existing user is the old HOD being replaced
    if (existingUser && activeHODMapping) {
      const isOldHOD = existingUser._id.toString() === activeHODMapping.hodId.toString();
      if (!isOldHOD) {
        return res.status(400).json({
          success: false,
          msg: 'User with this email already exists and is active'
        });
      }
    } else if (existingUser && !activeHODMapping) {
      return res.status(400).json({
        success: false,
        msg: 'User with this email already exists and is active'
      });
    }

    // Deactivate old HOD if exists
    if (activeHODMapping && deactivateOldHOD) {
      await activeHODMapping.deactivate(principalId, 'Replaced by new HOD assignment');
      
      // Update old HOD user status to inactive and set expiry date (30 days from now)
      const oldHODUser = await User.findById(activeHODMapping.hodId);
      if (oldHODUser) {
        oldHODUser.status = 'inactive';
        oldHODUser.accessLevel = 'restricted';
        // Set expiry date to 30 days from now for view-only access
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        oldHODUser.expiryDate = expiryDate;
        await oldHODUser.save();

        // Create notification for old HOD
        try {
          await Notification.create({
            userId: oldHODUser._id,
            title: 'HOD Access Updated',
            message: `Your HOD access has been deactivated and set to view-only until ${expiryDate.toLocaleDateString('en-IN')}.`,
            type: 'system',
            priority: 'medium'
          });
        } catch (e) {
          console.warn('Notification creation failed:', e.message);
        }
        console.log('✅ Old HOD deactivated:', {
          id: oldHODUser._id,
          email: oldHODUser.email,
          status: oldHODUser.status,
          expiryDate: expiryDate
        });
      }
    }

    // Generate password if not provided
    let finalPassword = password;
    if (!finalPassword) {
      finalPassword = `HOD${departmentId}${Date.now().toString().slice(-6)}`;
    }

    // Create new HOD user
    const hodUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: finalPassword,
      role: 'hod',
      department: departmentId,
      mobile: mobile || undefined,
      status: 'active',
      createdBy: principalId
    });

    await hodUser.save();
    
    // Verify the user was created correctly
    const savedUser = await User.findById(hodUser._id);
    console.log('✅ New HOD User Created:', {
      id: savedUser._id,
      email: savedUser.email,
      role: savedUser.role,
      department: savedUser.department,
      status: savedUser.status,
      hasPassword: !!savedUser.password
    });

    // Update department settings
    let deptSettings = await DepartmentSettings.findOne({ department: departmentId });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({
        department: departmentId,
        hodId: hodUser._id,
        updatedBy: principalId
      });
    } else {
      deptSettings.hodId = hodUser._id;
      deptSettings.updatedBy = principalId;
    }
    await deptSettings.save();

    // Create new HOD mapping
    const hodMapping = new DepartmentHODMapping({
      departmentId: departmentId,
      hodId: hodUser._id,
      assignedBy: principalId,
      assignedOn: new Date(),
      status: 'active'
    });
    await hodMapping.save();

    // Verify user can login by checking the saved user
    const verifyUser = await User.findById(hodUser._id);
    if (!verifyUser || verifyUser.status !== 'active') {
      console.error('❌ ERROR: New HOD user not created correctly!', {
        found: !!verifyUser,
        status: verifyUser?.status,
        role: verifyUser?.role
      });
      return res.status(500).json({
        success: false,
        msg: 'Error creating HOD user. Please try again.'
      });
    }

    // Test password verification
    const passwordTest = await verifyUser.comparePassword(finalPassword);
    if (!passwordTest) {
      console.error('❌ ERROR: Password verification failed for new HOD!');
      return res.status(500).json({
        success: false,
        msg: 'Error setting HOD password. Please try again.'
      });
    }

    console.log('✅ Password verification successful for new HOD');

    // Remove password from response
    const hodUserResponse = verifyUser.toObject();
    delete hodUserResponse.password;

    res.status(200).json({
      success: true,
      msg: `HOD replaced successfully for ${departmentId} department`,
      data: {
        hod: hodUserResponse,
        generatedPassword: !password ? finalPassword : undefined,
        oldHODDeactivated: activeHODMapping ? true : false,
        assignedBy: {
          id: principalId,
          name: req.user.name
        },
        assignedOn: hodMapping.assignedOn,
        loginCredentials: {
          email: verifyUser.email,
          password: !password ? finalPassword : 'Password as provided',
          role: verifyUser.role,
          status: verifyUser.status
        }
      }
    });
  } catch (error) {
    console.error('Error replacing HOD:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: 'Email or department mapping already exists'
      });
    }

    res.status(500).json({
      success: false,
      msg: 'Error replacing HOD',
      error: error.message
    });
  }
});

// @desc    Deactivate HOD
// @route   PUT /api/principal/hods/:departmentId/deactivate
// @access  Principal only
router.put('/hods/:departmentId/deactivate', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const principalId = req.user._id;

    // Validate department
    if (!DEPARTMENTS.includes(departmentId)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid department. Must be one of: ${DEPARTMENTS.join(', ')}`
      });
    }

    // Get active HOD mapping
    const activeHODMapping = await DepartmentHODMapping.findOne({
      departmentId: departmentId,
      status: 'active'
    });

    if (!activeHODMapping) {
      return res.status(404).json({
        success: false,
        msg: `No active HOD found for ${departmentId} department`
      });
    }

    // Deactivate mapping
    await activeHODMapping.deactivate(principalId, 'Deactivated by Principal');

    // Update HOD user status and set expiry date
    const hodUser = await User.findById(activeHODMapping.hodId);
    if (hodUser) {
      hodUser.status = 'inactive';
      hodUser.accessLevel = 'restricted';
      // Set expiry date to 30 days from now for view-only access
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      hodUser.expiryDate = expiryDate;
      await hodUser.save();
      try {
        await Notification.create({
          userId: hodUser._id,
          title: 'HOD Access Deactivated',
          message: `Your HOD access has been deactivated and set to view-only until ${expiryDate.toLocaleDateString('en-IN')}.`,
          type: 'system',
          priority: 'medium'
        });
      } catch (e) {
        console.warn('Notification creation failed:', e.message);
      }
    }

    // Remove HOD from department settings
    const deptSettings = await DepartmentSettings.findOne({ department: departmentId });
    if (deptSettings) {
      deptSettings.hodId = null;
      deptSettings.updatedBy = principalId;
      await deptSettings.save();
    }

    res.status(200).json({
      success: true,
      msg: `HOD deactivated successfully for ${departmentId} department`,
      data: {
        deactivatedHOD: {
          id: activeHODMapping.hodId,
          deactivatedOn: activeHODMapping.deactivatedOn
        }
      }
    });
  } catch (error) {
    console.error('Error deactivating HOD:', error);
    res.status(500).json({
      success: false,
      msg: 'Error deactivating HOD',
      error: error.message
    });
  }
});

// @desc    Reactivate HOD
// @route   PUT /api/principal/hods/:hodId/reactivate
// @access  Principal only
router.put('/hods/:hodId/reactivate', authenticate, authorize('principal'), async (req, res) => {
  try {
    const { hodId } = req.params;
    const principalId = req.user._id;

    // Find the HOD user
    const hodUser = await User.findById(hodId);
    
    if (!hodUser) {
      return res.status(404).json({
        success: false,
        msg: 'HOD not found'
      });
    }

    if (hodUser.role !== 'hod') {
      return res.status(400).json({
        success: false,
        msg: 'User is not an HOD'
      });
    }

    // Check if department already has an active HOD
    const activeHODMapping = await DepartmentHODMapping.findOne({
      departmentId: hodUser.department,
      status: 'active'
    });

    if (activeHODMapping && activeHODMapping.hodId.toString() !== hodId) {
      return res.status(400).json({
        success: false,
        msg: `Department ${hodUser.department} already has an active HOD. Please deactivate the current HOD first.`
      });
    }

    // Reactivate the HOD
    hodUser.status = 'active';
    hodUser.accessLevel = 'full';
    hodUser.expiryDate = null; // Clear expiry date
    await hodUser.save();

    // Notify HOD about reactivation
    try {
      await Notification.create({
        userId: hodUser._id,
        title: 'HOD Access Reactivated',
        message: 'Your HOD access has been reactivated with full privileges.',
        type: 'system',
        priority: 'high'
      });
    } catch (e) {
      console.warn('Notification creation failed:', e.message);
    }

    // Update or create HOD mapping
    let hodMapping = await DepartmentHODMapping.findOne({
      departmentId: hodUser.department,
      hodId: hodUser._id
    }).sort({ assignedOn: -1 });

    if (!hodMapping) {
      // Create new mapping if doesn't exist
      hodMapping = new DepartmentHODMapping({
        departmentId: hodUser.department,
        hodId: hodUser._id,
        assignedBy: principalId,
        assignedOn: new Date(),
        status: 'active'
      });
      await hodMapping.save();
    } else {
      // Reactivate existing mapping
      hodMapping.status = 'active';
      hodMapping.assignedOn = new Date();
      hodMapping.assignedBy = principalId;
      hodMapping.deactivatedBy = null;
      hodMapping.deactivatedOn = null;
      hodMapping.notes = 'Reactivated by Principal';
      await hodMapping.save();
    }

    // Update department settings
    let deptSettings = await DepartmentSettings.findOne({ department: hodUser.department });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({
        department: hodUser.department,
        hodId: hodUser._id,
        updatedBy: principalId
      });
    } else {
      deptSettings.hodId = hodUser._id;
      deptSettings.updatedBy = principalId;
    }
    await deptSettings.save();

    res.status(200).json({
      success: true,
      msg: `HOD reactivated successfully for ${hodUser.department} department`,
      data: {
        hod: {
          id: hodUser._id,
          name: hodUser.name,
          email: hodUser.email,
          department: hodUser.department,
          status: hodUser.status,
          accessLevel: hodUser.accessLevel
        }
      }
    });
  } catch (error) {
    console.error('Error reactivating HOD:', error);
    res.status(500).json({
      success: false,
      msg: 'Error reactivating HOD',
      error: error.message
    });
  }
});

// @desc    Update HOD details
// @route   PUT /api/principal/hods/:hodId
// @access  Principal only
router.put('/hods/:hodId', [
  body('name').optional({ nullable: true, values: 'falsy' }).trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional({ nullable: true, values: 'falsy' }).isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('mobile').optional({ nullable: true, values: 'falsy' }).matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { hodId } = req.params;
    const { name, email, mobile, status } = req.body;

    // Find HOD user
    const hodUser = await User.findById(hodId);
    if (!hodUser) {
      return res.status(404).json({
        success: false,
        msg: 'HOD not found'
      });
    }

    if (hodUser.role !== 'hod') {
      return res.status(400).json({
        success: false,
        msg: 'User is not an HOD'
      });
    }

    // Check email uniqueness if email is being updated
    if (email && email.toLowerCase() !== hodUser.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          msg: 'Email already exists'
        });
      }
      hodUser.email = email.toLowerCase().trim();
    }

    // Update fields
    if (name) hodUser.name = name.trim();
    if (mobile) hodUser.mobile = mobile;
    if (status) hodUser.status = status;

    await hodUser.save();

    // Remove password from response
    const hodUserResponse = hodUser.toObject();
    delete hodUserResponse.password;

    res.status(200).json({
      success: true,
      msg: 'HOD updated successfully',
      data: {
        hod: hodUserResponse
      }
    });
  } catch (error) {
    console.error('Error updating HOD:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      msg: 'Error updating HOD',
      error: error.message
    });
  }
});

// @desc    Get HOD assignment history for a department
// @route   GET /api/principal/hods/:departmentId/history
// @access  Principal only
router.get('/hods/:departmentId/history', async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Validate department
    if (!DEPARTMENTS.includes(departmentId)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid department. Must be one of: ${DEPARTMENTS.join(', ')}`
      });
    }

    const history = await DepartmentHODMapping.find({ departmentId })
      .populate('hodId', 'name email department role status mobile lastLogin accessLevel expiryDate')
      .populate('assignedBy', 'name email')
      .populate('deactivatedBy', 'name email')
      .sort({ assignedOn: -1 });

    // Calculate tenure for each HOD
    const historyWithTenure = history.map(mapping => {
      const assignedDate = new Date(mapping.assignedOn);
      const deactivatedDate = mapping.deactivatedOn ? new Date(mapping.deactivatedOn) : new Date();
      const tenureDays = Math.floor((deactivatedDate - assignedDate) / (1000 * 60 * 60 * 24));
      
      return {
        ...mapping.toObject(),
        tenureDays: tenureDays
      };
    });

    res.status(200).json({
      success: true,
      data: historyWithTenure,
      department: departmentId
    });
  } catch (error) {
    console.error('Error fetching HOD history:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching HOD history',
      error: error.message
    });
  }
});

// @desc    Export HODs to Excel
// @route   GET /api/principal/hods/export
// @access  Principal only
router.get('/hods/export', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    // Get all HOD data
    const departments = DEPARTMENTS;
    
    const exportData = [];
    
    for (const dept of departments) {
      const deptSettings = await DepartmentSettings.findOne({ department: dept });
      const allMappings = await DepartmentHODMapping.find({ departmentId: dept })
        .populate('hodId', 'name email department role status mobile createdAt lastLogin accessLevel expiryDate')
        .populate('assignedBy', 'name email')
        .populate('deactivatedBy', 'name email')
        .sort({ assignedOn: -1 });
      
      // Add active HOD
      const activeMapping = allMappings.find(m => m.status === 'active');
      if (activeMapping && activeMapping.hodId) {
        const assignedDate = activeMapping.assignedOn;
        const today = new Date();
        const tenureDays = Math.floor((today - assignedDate) / (1000 * 60 * 60 * 24));
        
        exportData.push({
          'Department': dept,
          'HOD Name': activeMapping.hodId.name,
          'Email': activeMapping.hodId.email,
          'Mobile': activeMapping.hodId.mobile || 'N/A',
          'Status': 'Active',
          'Assigned On': new Date(assignedDate).toLocaleDateString('en-IN'),
          'Assigned By': activeMapping.assignedBy?.name || 'Unknown',
          'Tenure (Days)': tenureDays,
          'Deactivated On': '-',
          'Deactivated By': '-',
          'Notes': '-'
        });
      }
      
      // Add inactive HODs if status is 'all' or 'inactive'
      if (status === 'all' || status === 'inactive') {
        const inactiveMappings = allMappings.filter(m => m.status === 'inactive');
        inactiveMappings.forEach(mapping => {
          if (mapping.hodId) {
            const assignedDate = new Date(mapping.assignedOn);
            const deactivatedDate = mapping.deactivatedOn ? new Date(mapping.deactivatedOn) : new Date();
            const tenureDays = Math.floor((deactivatedDate - assignedDate) / (1000 * 60 * 60 * 24));
            
            exportData.push({
              'Department': dept,
              'HOD Name': mapping.hodId.name,
              'Email': mapping.hodId.email,
              'Mobile': mapping.hodId.mobile || 'N/A',
              'Status': 'Inactive',
              'Assigned On': assignedDate.toLocaleDateString('en-IN'),
              'Assigned By': mapping.assignedBy?.name || 'Unknown',
              'Tenure (Days)': tenureDays,
              'Deactivated On': mapping.deactivatedOn ? new Date(mapping.deactivatedOn).toLocaleDateString('en-IN') : '-',
              'Deactivated By': mapping.deactivatedBy?.name || 'Unknown',
              'Notes': mapping.notes || '-'
            });
          }
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: exportData,
      count: exportData.length
    });
  } catch (error) {
    console.error('Error exporting HODs:', error);
    res.status(500).json({
      success: false,
      msg: 'Error exporting HOD data',
      error: error.message
    });
  }
});

// @desc    Get dashboard statistics for Principal
// @route   GET /api/principal/dashboard/stats
// @access  Principal only
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Get total active students count
    // Filter: status = 'active' AND isDeleted != true (or not set)
    // Using countDocuments for performance (indexed query on status field)
    // The query uses $or to handle cases where isDeleted field may or may not exist
    const totalStudents = await Student.countDocuments({
      status: 'active',
      $or: [
        { isDeleted: { $exists: false } },  // Field doesn't exist
        { isDeleted: false },                // Field exists and is false
        { isDeleted: { $ne: true } }          // Field exists and is not true
      ]
    });

    // Get total active faculty count from Faculty collection
    // Filter: status = 'active' AND isDeleted != true
    // Using countDocuments for performance (indexed query on status field)
    // Note: HODs who are also faculty will have records in Faculty collection and are already counted
    const totalFaculty = await Faculty.countDocuments({
      status: 'active',
      $or: [
        { isDeleted: { $exists: false } },  // Field doesn't exist
        { isDeleted: false },                // Field exists and is false
        { isDeleted: { $ne: true } }          // Field exists and is not true
      ]
    });

    // Get total active departments count
    // Count unique departments that are actively used in the system
    // A department is considered active if it has:
    // 1. Settings configured (DepartmentSettings), OR
    // 2. Active students assigned, OR
    // 3. Active faculty assigned
    // This ensures we count all departments that are actually in use
    
    // Get unique departments from DepartmentSettings
    const departmentsWithSettings = await DepartmentSettings.distinct('department', {
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ]
    });
    
    // Get unique departments from active students
    const departmentsWithStudents = await Student.distinct('department', {
      status: 'active',
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ]
    });
    
    // Get unique departments from active faculty
    const departmentsWithFaculty = await Faculty.distinct('department', {
      status: 'active',
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ]
    });
    
    // Combine all unique departments
    const allDepartments = new Set([
      ...departmentsWithSettings,
      ...departmentsWithStudents,
      ...departmentsWithFaculty
    ]);
    
    const totalDepartments = allDepartments.size;

    // Calculate average attendance percentage
    // Formula: (Total Present + Total OD) / Total Marked * 100
    // Only include valid attendance records (not holidays, not deleted, active students, not future dates)
    let avgAttendance = null;
    
    try {
      // Get today's date in YYYY-MM-DD format to exclude future dates
      const today = new Date().toISOString().split('T')[0];
      
      // Get all active holidays (to exclude from attendance calculation)
      const activeHolidays = await Holiday.find({
        isActive: true,
        isDeleted: false
      }).select('date scope department');
      
      // Create a Set of holiday dates for quick lookup
      // Include both global and department-specific holidays
      const holidayDates = new Set();
      activeHolidays.forEach(holiday => {
        if (holiday.scope === 'global' || allDepartments.has(holiday.department)) {
          holidayDates.add(holiday.date);
        }
      });
      
      // Get all active student IDs for filtering (using aggregation for efficiency)
      const activeStudentIdsResult = await Student.aggregate([
        {
          $match: {
            status: 'active',
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false },
              { isDeleted: { $ne: true } }
            ]
          }
        },
        {
          $project: { _id: 1 }
        }
      ]);
      
      const activeStudentIds = activeStudentIdsResult.map(s => s._id);
      
      // If no active students, set attendance to 0
      if (activeStudentIds.length === 0) {
        avgAttendance = 0;
      } else {
        // Use aggregation to efficiently calculate attendance statistics
        // This aggregates all attendance records and counts present/absent/od
        const attendanceStats = await Attendance.aggregate([
          // Match only attendance records that are not on holidays and not in the future
          {
            $match: {
              date: { 
                $lte: today, // Exclude future dates
                $nin: Array.from(holidayDates) // Exclude holiday dates
              },
              status: { $in: ['draft', 'finalized', 'modified'] } // Only finalized/modified attendance
            }
          },
          // Unwind the records array to process each student's attendance
          {
            $unwind: '$records'
          },
          // Filter out records for inactive students
          {
            $match: {
              'records.studentId': { $in: activeStudentIds }
            }
          },
          // Group and count
          {
            $group: {
              _id: null,
              totalMarked: { $sum: 1 }, // Total valid attendance records
              totalPresent: {
                $sum: {
                  $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0]
                }
              },
              totalOD: {
                $sum: {
                  $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0]
                }
              }
            }
          }
        ]);
        
        // Calculate average attendance percentage
        if (attendanceStats.length > 0 && attendanceStats[0].totalMarked > 0) {
          const stats = attendanceStats[0];
          const totalPresentLike = stats.totalPresent + stats.totalOD;
          avgAttendance = Math.round((totalPresentLike / stats.totalMarked) * 100 * 10) / 10; // Round to 1 decimal place
        } else {
          avgAttendance = 0; // No attendance records yet
        }
      }
      
    } catch (attendanceError) {
      console.error('Error calculating average attendance:', attendanceError);
      // Set to null to show "--" in UI
      avgAttendance = null;
    }

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalFaculty,
        totalDepartments,
        avgAttendance
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
});

export default router;

