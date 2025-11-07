import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import DepartmentSettings from '../models/DepartmentSettings.js';
import DepartmentHODMapping from '../models/DepartmentHODMapping.js';
import Notification from '../models/Notification.js';
import bcrypt from 'bcryptjs';
import DEPARTMENTS from '../config/departments.js';

const router = express.Router();

// Middleware: Allow both Admin and Principal
const allowAdminOrPrincipal = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'principal') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      msg: 'Access denied. Admin or Principal role required.'
    });
  }
};

// All routes require authentication and Admin/Principal role
router.use(authenticate);
router.use(allowAdminOrPrincipal);

// @desc    Get list of all available departments
// @route   GET /api/hod-management/departments
// @access  Admin or Principal
router.get('/departments', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: DEPARTMENTS
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching departments list',
      error: error.message
    });
  }
});

// @desc    Get all departments with their HODs (Active and Inactive)
// @route   GET /api/hod-management/hods
// @access  Admin or Principal
router.get('/hods', async (req, res) => {
  try {
    const { status, search, sortBy } = req.query;
    const userRole = req.user.role;

    const departments = DEPARTMENTS;
    
    const departmentsData = await Promise.all(departments.map(async (dept) => {
      // Get department settings
      const deptSettings = await DepartmentSettings.findOne({ department: dept });
      
      // Get all mappings for this department
      const allMappings = await DepartmentHODMapping.find({ departmentId: dept })
        .populate('hodId', 'name email department role status mobile createdAt lastLogin accessLevel expiryDate')
        .populate('assignedBy', 'name email role')
        .populate('deactivatedBy', 'name email role')
        .sort({ assignedOn: -1 });
      
      // Get active mapping
      const activeMapping = allMappings.find(m => m.status === 'active');
      
      // Get active HOD user details if exists
      let hodUser = null;
      if (activeMapping && activeMapping.hodId) {
        if (activeMapping.hodId && typeof activeMapping.hodId === 'object' && activeMapping.hodId.name) {
          hodUser = activeMapping.hodId;
        } else {
          hodUser = await User.findById(activeMapping.hodId)
            .select('name email department role status mobile createdAt lastLogin accessLevel expiryDate');
        }
      }
      
      // Get inactive HODs for this department
      const inactiveMappings = allMappings.filter(m => m.status === 'inactive');
      
      // Process inactive HODs with replacedBy detection
      const inactiveHODs = inactiveMappings.map((mapping, idx) => {
        let replacedBy = null;
        if (idx === 0 && activeMapping) {
          // First inactive is likely replaced by the current active
          replacedBy = {
            id: activeMapping.hodId?._id || activeMapping.hodId,
            name: activeMapping.hodId?.name || 'Unknown',
            email: activeMapping.hodId?.email || 'N/A'
          };
        } else if (idx > 0) {
          // Check if this inactive was replaced by the previous one in the list
          const previousMapping = inactiveMappings[idx - 1];
          if (previousMapping && previousMapping.assignedOn > mapping.deactivatedOn) {
            replacedBy = {
              id: previousMapping.hodId?._id || previousMapping.hodId,
              name: previousMapping.hodId?.name || 'Unknown',
              email: previousMapping.hodId?.email || 'N/A'
            };
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
          createdByRole: mapping.createdByRole || 'principal',
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
          let directMapping = await DepartmentHODMapping.findOne({
            departmentId: dept,
            hodId: directHOD._id,
            status: 'active'
          });
          if (!directMapping) {
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
          createdByRole: activeMapping?.createdByRole || 'principal',
          assignedOn: activeMapping?.assignedOn || (hodUser.createdAt ? new Date(hodUser.createdAt) : new Date()),
          assignedBy: activeMapping?.assignedBy?.name || 'Unknown',
          tenureDays: tenureDays
        } : null,
        hasHOD: !!hodUser && hodUser.status === 'active',
        inactiveHODs: inactiveHODs,
        totalHODsAssigned: allMappings.length
      };
    }));

    // Apply filters
    let filtered = departmentsData;
    
    // For 'active' status, show departments with active HODs OR departments without any HOD
    // This allows assigning HODs to vacant departments from the Active tab
    if (status === 'active') {
      // Show: departments with active HODs OR departments with no HOD at all (null/undefined)
      filtered = filtered.filter(dept => {
        const hasActiveHOD = dept.hasHOD === true && dept.hod && dept.hod.status === 'active';
        const hasNoHOD = !dept.hod || dept.hod === null;
        return hasActiveHOD || hasNoHOD;
      });
    } else if (status === 'inactive') {
      filtered = filtered.filter(dept => !dept.hasHOD || (dept.inactiveHODs && dept.inactiveHODs.length > 0));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(dept => {
        const hodMatch = dept.hod && (
          dept.hod.name.toLowerCase().includes(searchLower) ||
          dept.hod.email.toLowerCase().includes(searchLower) ||
          dept.department.toLowerCase().includes(searchLower)
        );
        const inactiveMatch = dept.inactiveHODs.some(hod =>
          hod.name.toLowerCase().includes(searchLower) ||
          hod.email.toLowerCase().includes(searchLower)
        );
        return hodMatch || inactiveMatch || dept.department.toLowerCase().includes(searchLower);
      });
    }
    
    if (sortBy === 'department') {
      filtered.sort((a, b) => a.department.localeCompare(b.department));
    } else if (sortBy === 'assignedDate') {
      filtered.sort((a, b) => {
        const dateA = a.hod?.assignedOn ? new Date(a.hod.assignedOn) : new Date(0);
        const dateB = b.hod?.assignedOn ? new Date(b.hod.assignedOn) : new Date(0);
        return dateB - dateA;
      });
    }
    
    // Calculate summary
    const summary = {
      total: departmentsData.length,
      active: departmentsData.filter(d => d.hasHOD).length,
      inactive: departmentsData.filter(d => !d.hasHOD).length,
      withHistory: departmentsData.filter(d => d.inactiveHODs && d.inactiveHODs.length > 0).length
    };

    res.status(200).json({
      success: true,
      data: filtered,
      summary,
      userRole
    });
  } catch (error) {
    console.error('Error fetching HODs:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching HOD data',
      error: error.message
    });
  }
});

// @desc    Create a new HOD
// @route   POST /api/hod-management/hods
// @access  Admin or Principal
router.post('/hods', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
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
    const userRole = req.user.role;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: 'Email already exists'
      });
    }

    // Check if department already has an active HOD
    const existingActiveHOD = await DepartmentHODMapping.findOne({
      departmentId: department,
      status: 'active'
    });
    
    if (existingActiveHOD) {
      return res.status(400).json({
        success: false,
        msg: `Department ${department} already has an active HOD. Please replace or deactivate the existing HOD first.`
      });
    }

    // Generate password if not provided
    const finalPassword = password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';

    // Create HOD user
    const newHOD = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: finalPassword,
      role: 'hod',
      department: department,
      mobile: mobile ? mobile.trim() : undefined,
      status: 'active',
      accessLevel: 'full',
      createdBy: req.user._id
    });

    await newHOD.save();

    // Verify the user was created correctly
    const verifiedHOD = await User.findById(newHOD._id);
    if (!verifiedHOD || verifiedHOD.role !== 'hod' || verifiedHOD.status !== 'active') {
      return res.status(500).json({
        success: false,
        msg: 'Failed to create HOD user. Verification failed.'
      });
    }

    // Verify password
    const passwordCheck = await verifiedHOD.comparePassword(finalPassword);
    if (!passwordCheck) {
      return res.status(500).json({
        success: false,
        msg: 'Password verification failed after creation.'
      });
    }

    // Update or create department settings
    let deptSettings = await DepartmentSettings.findOne({ department: department });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({ department: department });
    }
    deptSettings.hodId = newHOD._id;
    await deptSettings.save();

    // Create HOD mapping
    const mapping = new DepartmentHODMapping({
      departmentId: department,
      hodId: newHOD._id,
      assignedBy: req.user._id,
      createdByRole: userRole,
      status: 'active',
      notes: `HOD created by ${userRole}`
    });
    await mapping.save();

    // Create notification
    const notification = new Notification({
      type: 'system',
      title: 'HOD Assigned',
      message: `You have been assigned as HOD for ${department} department.`,
      userId: newHOD._id,
      sentBy: req.user._id,
      department: department,
      priority: 'high'
    });
    await notification.save();

    res.status(201).json({
      success: true,
      msg: 'HOD created successfully',
      data: {
        id: newHOD._id,
        name: newHOD.name,
        email: newHOD.email,
        department: newHOD.department,
        password: !password ? finalPassword : undefined,
        createdByRole: userRole
      }
    });
  } catch (error) {
    console.error('Error creating HOD:', error);
    res.status(500).json({
      success: false,
      msg: 'Error creating HOD',
      error: error.message
    });
  }
});

// @desc    Replace an HOD for a department
// @route   PUT /api/hod-management/hods/:departmentId/replace
// @access  Admin or Principal
router.put('/hods/:departmentId/replace', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

    const { departmentId } = req.params;
    const { name, email, password, mobile } = req.body;
    const userRole = req.user.role;

    // Find current active HOD
    const currentMapping = await DepartmentHODMapping.findOne({
      departmentId: departmentId,
      status: 'active'
    }).populate('hodId');

    if (!currentMapping) {
      return res.status(404).json({
        success: false,
        msg: `No active HOD found for department ${departmentId}`
      });
    }

    // Check if email already exists (excluding the old HOD being replaced)
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: currentMapping.hodId._id }
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: 'Email already exists'
      });
    }

    // Generate password if not provided
    const finalPassword = password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123';

    // Create new HOD user
    const newHOD = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: finalPassword,
      role: 'hod',
      department: departmentId,
      mobile: mobile ? mobile.trim() : undefined,
      status: 'active',
      accessLevel: 'full',
      createdBy: req.user._id
    });

    await newHOD.save();

    // Verify the user was created correctly
    const verifiedHOD = await User.findById(newHOD._id);
    if (!verifiedHOD || verifiedHOD.role !== 'hod' || verifiedHOD.status !== 'active') {
      return res.status(500).json({
        success: false,
        msg: 'Failed to create HOD user. Verification failed.'
      });
    }

    // Verify password
    const passwordCheck = await verifiedHOD.comparePassword(finalPassword);
    if (!passwordCheck) {
      return res.status(500).json({
        success: false,
        msg: 'Password verification failed after creation.'
      });
    }

    // Deactivate old HOD
    const oldHOD = await User.findById(currentMapping.hodId._id);
    if (oldHOD) {
      oldHOD.status = 'inactive';
      oldHOD.accessLevel = 'restricted';
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      oldHOD.expiryDate = expiryDate;
      await oldHOD.save();
    }

    await currentMapping.deactivate(req.user._id, `Replaced by ${userRole}`);

    // Update department settings
    let deptSettings = await DepartmentSettings.findOne({ department: departmentId });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({ department: departmentId });
    }
    deptSettings.hodId = newHOD._id;
    await deptSettings.save();

    // Create new mapping
    const newMapping = new DepartmentHODMapping({
      departmentId: departmentId,
      hodId: newHOD._id,
      assignedBy: req.user._id,
      createdByRole: userRole,
      status: 'active',
      notes: `HOD replaced by ${userRole}`
    });
    await newMapping.save();

    // Create notifications
    const oldNotification = new Notification({
      type: 'system',
      title: 'HOD Access Revoked',
      message: `Your HOD access for ${departmentId} department has been revoked. You can still view your previous records in read-only mode.`,
      userId: oldHOD._id,
      sentBy: req.user._id,
      department: departmentId,
      priority: 'high'
    });
    await oldNotification.save();

    const newNotification = new Notification({
      type: 'system',
      title: 'HOD Assigned',
      message: `You have been assigned as HOD for ${departmentId} department.`,
      userId: newHOD._id,
      sentBy: req.user._id,
      department: departmentId,
      priority: 'high'
    });
    await newNotification.save();

    res.status(200).json({
      success: true,
      msg: 'HOD replaced successfully',
      data: {
        newHOD: {
          id: newHOD._id,
          name: newHOD.name,
          email: newHOD.email,
          password: !password ? finalPassword : undefined
        },
        oldHOD: {
          id: oldHOD._id,
          name: oldHOD.name,
          email: oldHOD.email
        }
      }
    });
  } catch (error) {
    console.error('Error replacing HOD:', error);
    res.status(500).json({
      success: false,
      msg: 'Error replacing HOD',
      error: error.message
    });
  }
});

// @desc    Update HOD details
// @route   PUT /api/hod-management/hods/:hodId
// @access  Admin or Principal
router.put('/hods/:hodId', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
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

    const { hodId } = req.params;
    const { name, email, mobile } = req.body;

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== 'hod') {
      return res.status(404).json({
        success: false,
        msg: 'HOD not found'
      });
    }

    if (name) hod.name = name.trim();
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: hodId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          msg: 'Email already exists'
        });
      }
      hod.email = email.toLowerCase().trim();
    }
    if (mobile !== undefined) {
      hod.mobile = mobile ? mobile.trim() : undefined;
    }

    await hod.save();

    res.status(200).json({
      success: true,
      msg: 'HOD updated successfully',
      data: {
        id: hod._id,
        name: hod.name,
        email: hod.email,
        mobile: hod.mobile
      }
    });
  } catch (error) {
    console.error('Error updating HOD:', error);
    res.status(500).json({
      success: false,
      msg: 'Error updating HOD',
      error: error.message
    });
  }
});

// @desc    Deactivate HOD
// @route   PUT /api/hod-management/hods/:departmentId/deactivate
// @access  Admin or Principal
router.put('/hods/:departmentId/deactivate', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const userRole = req.user.role;

    const activeMapping = await DepartmentHODMapping.findOne({
      departmentId: departmentId,
      status: 'active'
    }).populate('hodId');

    if (!activeMapping) {
      return res.status(404).json({
        success: false,
        msg: `No active HOD found for department ${departmentId}`
      });
    }

    const hod = await User.findById(activeMapping.hodId._id);
    if (hod) {
      hod.status = 'inactive';
      hod.accessLevel = 'restricted';
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      hod.expiryDate = expiryDate;
      await hod.save();
    }

    await activeMapping.deactivate(req.user._id, `Deactivated by ${userRole}`);

    // Update department settings
    const deptSettings = await DepartmentSettings.findOne({ department: departmentId });
    if (deptSettings) {
      deptSettings.hodId = null;
      await deptSettings.save();
    }

    // Create notification
    const notification = new Notification({
      type: 'system',
      title: 'HOD Access Revoked',
      message: `Your HOD access for ${departmentId} department has been revoked. You can still view your previous records in read-only mode.`,
      userId: hod._id,
      sentBy: req.user._id,
      department: departmentId,
      priority: 'high'
    });
    await notification.save();

    res.status(200).json({
      success: true,
      msg: 'HOD deactivated successfully'
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
// @route   PUT /api/hod-management/hods/:hodId/reactivate
// @access  Admin or Principal
router.put('/hods/:hodId/reactivate', async (req, res) => {
  try {
    const { hodId } = req.params;
    const userRole = req.user.role;

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== 'hod') {
      return res.status(404).json({
        success: false,
        msg: 'HOD not found'
      });
    }

    // Check if department already has an active HOD
    const existingActiveMapping = await DepartmentHODMapping.findOne({
      departmentId: hod.department,
      status: 'active',
      hodId: { $ne: hodId }
    });

    if (existingActiveMapping) {
      return res.status(400).json({
        success: false,
        msg: `Department ${hod.department} already has an active HOD. Please replace or deactivate the existing HOD first.`
      });
    }

    // Reactivate user
    hod.status = 'active';
    hod.accessLevel = 'full';
    hod.expiryDate = null;
    await hod.save();

    // Find or create active mapping
    let mapping = await DepartmentHODMapping.findOne({
      departmentId: hod.department,
      hodId: hodId
    }).sort({ assignedOn: -1 });

    if (mapping) {
      mapping.status = 'active';
      mapping.assignedBy = req.user._id;
      mapping.assignedOn = new Date();
      mapping.deactivatedBy = null;
      mapping.deactivatedOn = null;
      mapping.notes = `Reactivated by ${userRole}`;
      await mapping.save();
    } else {
      mapping = new DepartmentHODMapping({
        departmentId: hod.department,
        hodId: hodId,
        assignedBy: req.user._id,
        createdByRole: userRole,
        status: 'active',
        notes: `Reactivated by ${userRole}`
      });
      await mapping.save();
    }

    // Update department settings
    let deptSettings = await DepartmentSettings.findOne({ department: hod.department });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({ department: hod.department });
    }
    deptSettings.hodId = hodId;
    await deptSettings.save();

    // Create notification
    const notification = new Notification({
      type: 'system',
      title: 'HOD Access Restored',
      message: `Your HOD access for ${hod.department} department has been restored.`,
      userId: hodId,
      sentBy: req.user._id,
      department: hod.department,
      priority: 'high'
    });
    await notification.save();

    res.status(200).json({
      success: true,
      msg: 'HOD reactivated successfully'
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

// @desc    Get department HOD history
// @route   GET /api/hod-management/hods/:departmentId/history
// @access  Admin or Principal
router.get('/hods/:departmentId/history', async (req, res) => {
  try {
    const { departmentId } = req.params;

    const mappings = await DepartmentHODMapping.find({ departmentId: departmentId })
      .populate('hodId', 'name email department role status mobile createdAt lastLogin accessLevel expiryDate')
      .populate('assignedBy', 'name email role')
      .populate('deactivatedBy', 'name email role')
      .sort({ assignedOn: -1 });

    const history = mappings.map((mapping, index) => {
      const assignedDate = new Date(mapping.assignedOn);
      const deactivatedDate = mapping.deactivatedOn ? new Date(mapping.deactivatedOn) : new Date();
      const tenureDays = Math.floor((deactivatedDate - assignedDate) / (1000 * 60 * 60 * 24));

      return {
        id: mapping._id,
        hodId: {
          _id: mapping.hodId?._id,
          name: mapping.hodId?.name,
          email: mapping.hodId?.email,
          status: mapping.hodId?.status,
          lastLogin: mapping.hodId?.lastLogin,
          accessLevel: mapping.hodId?.accessLevel,
          expiryDate: mapping.hodId?.expiryDate
        },
        assignedOn: mapping.assignedOn,
        deactivatedOn: mapping.deactivatedOn,
        assignedBy: mapping.assignedBy?.name || 'Unknown',
        deactivatedBy: mapping.deactivatedBy?.name || 'Unknown',
        createdByRole: mapping.createdByRole || 'principal',
        status: mapping.status,
        notes: mapping.notes || '',
        tenureDays: tenureDays
      };
    });

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching department history:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching department history',
      error: error.message
    });
  }
});

// @desc    Export HODs to Excel
// @route   GET /api/hod-management/hods/export
// @access  Admin or Principal
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
        .populate('assignedBy', 'name email role')
        .populate('deactivatedBy', 'name email role')
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
          'Created By': activeMapping.createdByRole || 'principal',
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
              'Created By': mapping.createdByRole || 'principal',
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

export default router;

