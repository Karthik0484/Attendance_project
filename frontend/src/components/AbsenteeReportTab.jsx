import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import jsPDF from 'jspdf';

// Import autoTable plugin - must be after jsPDF import
// eslint-disable-next-line no-unused-vars
import autoTablePlugin from 'jspdf-autotable';

const AbsenteeReportTab = ({ classData, onToast }) => {
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [reportMode, setReportMode] = useState('single'); // 'single' or 'range'
  const [singleDate, setSingleDate] = useState(getTodayDate());
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setReportData(null);
      setIsEditMode(false);
      setEditedData({});
      setValidationErrors({});

      // Validate class data
      if (!classData) {
        setError('Class data not available. Please try refreshing the page.');
        setLoading(false);
        return;
      }
      
      if (!classData._id && !classData.classId) {
        setError('Class identifier missing. Please try refreshing the page.');
        console.error('Missing class identifier:', classData);
        setLoading(false);
        return;
      }

      // Validate inputs
      if (reportMode === 'single' && !singleDate) {
        setError('Please select a date');
        setLoading(false);
        return;
      }

      if (reportMode === 'range' && (!startDate || !endDate)) {
        setError('Please select both start and end dates');
        setLoading(false);
        return;
      }

      if (reportMode === 'range' && new Date(startDate) > new Date(endDate)) {
        setError('Start date must be before or equal to end date');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      
      // Send class details for backend to find the class
      if (classData.batch) params.append('batch', classData.batch);
      if (classData.year) params.append('year', classData.year);
      if (classData.semester) params.append('semester', classData.semester);
      if (classData.section) params.append('section', classData.section);
      
      // Also send classId as fallback
      if (classData._id) {
        params.append('classId', classData._id);
      } else if (classData.classId) {
        params.append('classId', classData.classId);
      }

      if (reportMode === 'single') {
        params.append('date', singleDate);
      } else {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      console.log('📊 Generating report with params:', params.toString());

      // Fetch report
      const response = await apiFetch({
        url: `/api/reports/absentee?${params.toString()}`,
        method: 'GET'
      });

      if (response.data.success) {
        setReportData(response.data);
      } else {
        setError(response.data.message || 'Failed to generate report');
      }
    } catch (err) {
      console.error('❌ Error generating report:', err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleEditModeToggle = () => {
    if (isEditMode) {
      // Confirm cancel if there are unsaved changes
      if (Object.keys(editedData).length > 0) {
        if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
          return;
        }
      }
      setIsEditMode(false);
      setEditedData({});
      setValidationErrors({});
    } else {
      setIsEditMode(true);
      setSaveSuccess(false);
    }
  };

  const handleCellEdit = (index, field, value) => {
    const key = `${index}_${field}`;
    
    // Update edited data
    setEditedData(prev => ({
      ...prev,
      [key]: value
    }));

    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });

    setSaveSuccess(false);
  };

  const validateEdits = () => {
    const errors = {};
    
    Object.keys(editedData).forEach(key => {
      const [, field] = key.split('_');
      const value = editedData[key];
      
      if (field === 'parentContact' && value && value !== 'N/A') {
        const cleaned = value.replace(/\s/g, '');
        if (!/^[0-9]{10}$/.test(cleaned)) {
          errors[key] = 'Must be exactly 10 digits';
        }
      }
      
      if (field === 'reason' && value && value.length > 500) {
        errors[key] = 'Maximum 500 characters';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveChanges = async () => {
    if (Object.keys(editedData).length === 0) {
      alert('No changes to save');
      return;
    }

    // Validate all edits
    if (!validateEdits()) {
      alert('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Build updates array
      const updates = [];
      const absentees = reportData.absentees;

      Object.keys(editedData).forEach(key => {
        const [indexStr, field] = key.split('_');
        const index = parseInt(indexStr);
        const student = absentees[index];

        // Find existing update for this student or create new one
        let update = updates.find(u => u.regNo === student.regNo && u.date === student.date);
        if (!update) {
          update = {
            regNo: student.regNo,
            date: student.date || reportData.rawDate
          };
          updates.push(update);
        }

        // Add the edited field
        update[field] = editedData[key];
      });

      console.log('📝 Saving updates:', updates);

      // Send to backend
      const response = await apiFetch({
        url: '/api/reports/absentee',
        method: 'PUT',
        data: {
          batch: classData.batch,
          year: classData.year,
          semester: classData.semester,
          section: classData.section,
          updates
        }
      });

      if (response.data.success) {
        console.log('✅ Save successful:', response.data);
        
        // Show success message
        setSaveSuccess(true);
        
        // Update report data with saved changes
        const updatedAbsentees = absentees.map((student, index) => {
          const updatedStudent = { ...student };
          Object.keys(editedData).forEach(key => {
            const [indexStr, field] = key.split('_');
            if (parseInt(indexStr) === index) {
              updatedStudent[field] = editedData[key];
            }
          });
          return updatedStudent;
        });

        setReportData(prev => ({
          ...prev,
          absentees: updatedAbsentees
        }));

        // Clear edited data and exit edit mode
        setEditedData({});
        setIsEditMode(false);

        // Show success for 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);

      } else {
        setError(response.data.message || 'Failed to save changes');
      }
    } catch (err) {
      console.error('❌ Error saving changes:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getCellValue = (student, index, field) => {
    const key = `${index}_${field}`;
    return editedData[key] !== undefined ? editedData[key] : student[field];
  };

  const exportToExcel = async () => {
    if (Object.keys(editedData).length > 0) {
      alert('⚠️ Please save changes before exporting. Unsaved changes will not be included in the export.');
      return;
    }

    if (!reportData || !reportData.absentees || reportData.absentees.length === 0) {
      if (onToast) {
        onToast('No data to export', 'error');
      } else {
        alert('No data to export');
      }
      return;
    }

    try {
      const { exportToExcelWithLogo } = await import('../utils/excelExport');
      const { reportType, absentees, classInfo, date } = reportData;

      // Prepare export data
      const exportData = absentees.map((student, index) => {
        const baseData = {
          'S.No': index + 1,
          'Roll Number': student.regNo || '',
          'Student Name': student.name || '',
          'Email': student.email || '',
          'Parent Contact': student.parentContact || ''
        };

        if (reportType === 'single-day') {
          return {
            ...baseData,
            'Status': 'Absent',
            'Reason': student.reason || '',
            'Marked By': 'Faculty',
            'Time': new Date().toLocaleTimeString('en-IN')
          };
        } else {
          return {
            ...baseData,
            'Days Absent': student.daysAbsent || 0,
            'Absent Dates': student.absentDates || '',
            'Reasons': student.reasons || '',
            'Faculty Actions': student.facultyActions || ''
          };
        }
      });

      // Prepare date range
      let dateRange = '';
      if (reportType === 'single-day') {
        dateRange = reportData.rawDate || date;
      } else {
        dateRange = `${reportData.rawStartDate} to ${reportData.rawEndDate}`;
      }

      // Parse class info for metadata
      const classParts = classInfo.classDisplay ? classInfo.classDisplay.split('|') : [];
      let batch = '', year = '', semester = '', section = '';
      
      if (classParts.length >= 3) {
        year = classParts[0].trim();
        semester = classParts[1].trim();
        section = classParts[2].trim();
      }

      // Calculate summary
      const totalAbsentees = reportData.totalAbsentees || 0;
      const totalStudents = reportData.totalStudents || 0;

      // Export to Excel
      await exportToExcelWithLogo(
        exportData,
        'Absentees_Report',
        'Absentees Report',
        {
          reportTitle: 'Absentees Report',
          department: classData?.department || '',
          batch: batch,
          year: year,
          semester: semester,
          section: section,
          dateRange: dateRange,
          facultyName: 'Faculty',
          summary: {
            totalStudents,
            totalAbsent: totalAbsentees,
            totalPresent: totalStudents - totalAbsentees
          }
        }
      );

      if (onToast) {
        onToast('Excel file downloaded successfully!', 'success');
      } else {
        alert('Excel file downloaded successfully!');
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      if (onToast) {
        onToast('Failed to export Excel file. Please try again.', 'error');
      } else {
        alert('Failed to export Excel file. Please try again.');
      }
    }
  };

  const exportToPDF = () => {
    if (Object.keys(editedData).length > 0) {
      if (onToast) {
        onToast('⚠️ Please save changes before exporting. Unsaved changes will not be included in the export.', 'warning');
      } else {
        alert('⚠️ Please save changes before exporting. Unsaved changes will not be included in the export.');
      }
      return;
    }

    if (!reportData || !reportData.absentees || reportData.absentees.length === 0) {
      if (onToast) {
        onToast('No data to export', 'error');
      } else {
        alert('No data to export');
      }
      return;
    }

    const { reportType, absentees, classInfo, date, generatedBy } = reportData;

    const doc = new jsPDF();
    
    // Check if autoTable is available
    if (typeof doc.autoTable !== 'function') {
      console.error('autoTable is not available on jsPDF instance');
      if (onToast) {
        onToast('PDF library not loaded correctly. Please refresh the page.', 'error');
      } else {
        alert('PDF library not loaded correctly. Please refresh the page.');
      }
      return;
    }

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ER.PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('(AN AUTONOMOUS INSTITUTION)', 105, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ABSENTEE REPORT', 105, 32, { align: 'center' });

    // Class and date info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Class: ${classInfo.classDisplay}`, 14, 42);
    doc.text(`Date: ${date}`, 14, 48);
    doc.text(`Total Students: ${reportData.totalStudents}`, 14, 54);
    doc.text(`Total Absentees: ${reportData.totalAbsentees}`, 14, 60);

    // Table
    const tableStartY = 68;

    if (reportType === 'single-day') {
      const tableData = absentees.map((student, index) => [
        index + 1,
        student.regNo,
        student.name,
        student.parentContact,
        student.reason,
        student.facultyAction
      ]);

      doc.autoTable({
        startY: tableStartY,
        head: [['S.No', 'Reg. No', 'Name', 'Parent Contact', 'Reason', 'Faculty Action']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 28 },
          4: { cellWidth: 40 },
          5: { cellWidth: 40 }
        }
      });
    } else {
      const tableData = absentees.map((student, index) => [
        index + 1,
        student.regNo,
        student.name,
        student.parentContact,
        student.daysAbsent,
        student.absentDates
      ]);

      doc.autoTable({
        startY: tableStartY,
        head: [['S.No', 'Reg. No', 'Name', 'Parent Contact', 'Days Absent', 'Dates']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 28 },
          4: { cellWidth: 20 },
          5: { cellWidth: 60 }
        }
      });
    }

    // Footer
    const finalY = doc.lastAutoTable.finalY || tableStartY + 10;
    doc.setFontSize(8);
    doc.text(`Generated by: ${generatedBy.name}`, 14, finalY + 10);
    doc.text(`Generated on: ${reportData.generatedAt}`, 14, finalY + 15);
    
    doc.setFontSize(10);
    doc.text('Faculty Signature: ___________________', 14, finalY + 30);

    // Save
    const filename = reportType === 'single-day' 
      ? `Absentee_Report_${reportData.rawDate}.pdf`
      : `Absentee_Report_${reportData.rawStartDate}_to_${reportData.rawEndDate}.pdf`;
    
    doc.save(filename);
    
    // Show success toast
    if (onToast) {
      onToast('PDF file downloaded successfully!', 'success');
    }
  };

  // Check if class data is available
  if (!classData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-600 mb-2">⚠️ Loading class data...</div>
        <p className="text-sm text-gray-600">Please wait while we load the class information.</p>
      </div>
    );
  }
  
  // Check if classData has the required _id field
  if (!classData._id && !classData.classId) {
    console.error('❌ ClassData missing _id and classId:', classData);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 mb-2">❌ Class ID not found</div>
        <p className="text-sm text-gray-600 mt-2">Please refresh the page or contact support.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Absentee Report</h2>
        
        {/* Mode Toggle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setReportMode('single');
                setReportData(null);
                setError(null);
                setIsEditMode(false);
                setEditedData({});
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                reportMode === 'single'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Single Day Report
            </button>
            <button
              onClick={() => {
                setReportMode('range');
                setReportData(null);
                setError(null);
                setIsEditMode(false);
                setEditedData({});
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                reportMode === 'range'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📆 Date Range Report
            </button>
          </div>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {reportMode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  min={startDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <span>📊</span>
              Generate Report
            </>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">❌ {error}</p>
          </div>
        )}
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Report Results</h3>
              <p className="text-sm text-gray-600 mt-1">
                {reportData.date} | Total Absentees: {reportData.totalAbsentees} out of {reportData.totalStudents} students
              </p>
            </div>
            
            {reportData.absentees && reportData.absentees.length > 0 && (
              <div className="flex gap-2">
                {!isEditMode ? (
                  <>
                    <button
                      onClick={handleEditModeToggle}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                    >
                      ✏️ Edit Report
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      📊 Export Excel
                    </button>
                    <button
                      onClick={exportToPDF}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      📑 Export PDF
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saving || Object.keys(editedData).length === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          💾 Save Changes ({Object.keys(editedData).length})
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleEditModeToggle}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <span className="text-xl">✅</span>
              <p className="font-medium">Changes saved successfully!</p>
            </div>
          )}

          {/* Edit Mode Info */}
          {isEditMode && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 px-6 py-4 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📝</span>
                <div>
                  <p className="font-semibold text-blue-900 text-lg">Edit Mode Active</p>
                  <p className="text-sm text-blue-700 mt-1">Click on Parent Contact, Reason, or Faculty Action cells to edit. Changes are highlighted in yellow.</p>
                </div>
              </div>
            </div>
          )}

          {reportData.absentees && reportData.absentees.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{width: '80px'}}>S.No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{width: '120px'}}>Reg. No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{width: '180px'}}>Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{minWidth: '180px'}}>
                      <div className="flex items-center gap-2">
                        Parent Contact 
                        {isEditMode && <span className="text-blue-600 text-base">✏️</span>}
                      </div>
                    </th>
                    
                    {reportData.reportType === 'range' && (
                      <>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{width: '130px'}}>Days Absent</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{minWidth: '200px'}}>Dates</th>
                      </>
                    )}
                    
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap" style={{minWidth: '300px'}}>
                      <div className="flex items-center gap-2">
                        Reason 
                        {isEditMode && <span className="text-blue-600 text-base">✏️</span>}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{minWidth: '220px'}}>
                      <div className="flex items-center gap-2">
                        Faculty Action 
                        {isEditMode && <span className="text-blue-600 text-base">✏️</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.absentees.map((student, index) => (
                    <tr key={index} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 border-r border-gray-200" style={{width: '80px'}}>{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-700 border-r border-gray-200 whitespace-nowrap" style={{width: '120px'}}>{student.regNo}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200" style={{width: '180px'}}>
                        <span className="block whitespace-normal break-words">{student.name}</span>
                      </td>
                      
                      {/* Parent Contact - Editable */}
                      <td className={`px-6 py-4 text-sm border-r border-gray-200 ${
                        editedData[`${index}_parentContact`] !== undefined ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                      }`} style={{minWidth: '180px'}}>
                        {isEditMode ? (
                          <div className="w-full">
                            <input
                              type="text"
                              value={getCellValue(student, index, 'parentContact')}
                              onChange={(e) => handleCellEdit(index, 'parentContact', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                              placeholder="Enter 10 digits"
                              style={{minWidth: '160px'}}
                            />
                            {validationErrors[`${index}_parentContact`] && (
                              <p className="text-xs text-red-600 mt-1 font-medium">{validationErrors[`${index}_parentContact`]}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-700 font-medium whitespace-nowrap">{student.parentContact}</span>
                        )}
                      </td>
                      
                      {reportData.reportType === 'range' && (
                        <>
                          <td className="px-6 py-4 text-center text-sm font-bold text-red-600 border-r border-gray-200 bg-red-50" style={{width: '130px'}}>{student.daysAbsent}</td>
                          <td className="px-6 py-4 text-xs text-gray-600 border-r border-gray-200" style={{minWidth: '200px'}}>
                            <span className="block whitespace-normal break-words">{student.absentDates}</span>
                          </td>
                        </>
                      )}
                      
                      {/* Reason - Editable */}
                      <td className={`px-6 py-4 text-sm border-r border-gray-200 ${
                        editedData[`${index}_reason`] !== undefined ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                      }`} style={{minWidth: '300px'}}>
                        {isEditMode ? (
                          <div className="w-full">
                            <textarea
                              value={getCellValue(student, index, 'reason')}
                              onChange={(e) => handleCellEdit(index, 'reason', e.target.value)}
                              rows={2}
                              className="w-full min-w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y transition-all"
                              placeholder="Enter reason for absence..."
                              style={{minWidth: '280px'}}
                            />
                            {validationErrors[`${index}_reason`] && (
                              <p className="text-xs text-red-600 mt-1 font-medium">{validationErrors[`${index}_reason`]}</p>
                            )}
                          </div>
                        ) : (
                          <span className={`whitespace-normal break-words block ${student.reason === 'Not submitted' ? 'text-red-600 italic font-medium' : 'text-gray-700'}`}>
                            {student.reason}
                          </span>
                        )}
                      </td>
                      
                      {/* Faculty Action - Editable */}
                      <td className={`px-6 py-4 text-sm ${
                        editedData[`${index}_facultyAction`] !== undefined ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                      }`} style={{minWidth: '220px'}}>
                        {isEditMode ? (
                          <select
                            value={getCellValue(student, index, 'facultyAction')}
                            onChange={(e) => handleCellEdit(index, 'facultyAction', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm"
                            style={{minWidth: '200px'}}
                          >
                            <option value="Pending review">Pending review</option>
                            <option value="Parents contacted">Parents contacted</option>
                            <option value="Warning issued">Warning issued</option>
                            <option value="Action taken">Action taken</option>
                            <option value="Excused">Excused</option>
                            <option value="Under investigation">Under investigation</option>
                          </select>
                        ) : (
                          <span className={`font-medium whitespace-normal break-words ${
                            (reportData.reportType === 'range' ? student.facultyActions : student.facultyAction) === 'Pending review' || 
                            (reportData.reportType === 'range' ? student.facultyActions : student.facultyAction) === 'Pending' 
                              ? 'text-orange-600 italic' 
                              : 'text-green-600'
                          }`}>
                            {reportData.reportType === 'range' ? student.facultyActions : student.facultyAction}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-medium text-green-600">No absentees recorded for this date!</p>
              <p className="text-sm text-gray-500 mt-2">All students were present.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AbsenteeReportTab;
