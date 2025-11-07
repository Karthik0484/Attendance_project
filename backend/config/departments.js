/**
 * Centralized list of departments
 * 
 * This file contains the master list of all departments in the institution.
 * Adding or removing departments from this list will automatically update:
 * - Backend models (DepartmentSettings, DepartmentHODMapping, User)
 * - Backend routes (hodManagement, principal)
 * - Frontend components (HODManagement, DepartmentReports)
 * 
 * To add more departments:
 * 1. Add the department name to the DEPARTMENTS array below
 * 2. Restart the backend server
 * 3. The new department will be available in all HOD creation forms
 * 
 * Note: Department names are case-sensitive and should match exactly
 * across all systems (e.g., 'CSE' not 'cse' or 'Computer Science')
 */

export const DEPARTMENTS = [
  'CSE',
  'IT',
  'ECE',
  'EEE',
  'Civil',
  'Mechanical',
  'CSBS',
  'AIDS',
  'AERO',
  'MCO',
  'Chemical Engineering',
  'AIML',
  // Add more departments here as needed
  // Example: 'AIML', 'Data Science', 'Biotechnology', 'Aerospace', etc.
];

export default DEPARTMENTS;
