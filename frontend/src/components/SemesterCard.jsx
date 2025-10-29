import { useNavigate } from 'react-router-dom';

const SemesterCard = ({ semester }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/student/semester/${semester._id}`, { 
      state: { semester } 
    });
  };

  // Determine status color and badge
  const getStatusInfo = () => {
    if (semester.status === 'completed') {
      return {
        badge: 'Completed',
        badgeColor: 'bg-gray-100 text-gray-700',
        cardBorder: 'border-gray-300'
      };
    }
    return {
      badge: 'Active',
      badgeColor: 'bg-green-100 text-green-700',
      cardBorder: 'border-blue-300'
    };
  };

  // Get attendance percentage color
  const getPercentageColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get semester icon
  const getSemesterIcon = (semesterName) => {
    const semNumber = parseInt(semesterName.replace('Sem ', ''));
    const icons = ['📘', '📗', '📙', '📕', '📓', '📔', '📖', '📚'];
    return icons[semNumber - 1] || '📖';
  };

  const statusInfo = getStatusInfo();
  const attendance = semester.stats?.attendancePercentage || 0;

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 ${statusInfo.cardBorder} transform hover:scale-105 hover:-translate-y-1 duration-300`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{getSemesterIcon(semester.semesterName)}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{semester.semesterName}</h3>
              <p className="text-sm text-gray-600">
                {semester.year} - Section {semester.section}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.badgeColor}`}>
            {statusInfo.badge}
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          {/* Attendance Percentage */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium text-gray-700">Attendance</span>
            </div>
            <span className={`text-2xl font-bold ${getPercentageColor(attendance)}`}>
              {attendance}%
            </span>
          </div>

          {/* Class Details */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-blue-50 rounded text-center">
              <p className="text-xs text-gray-600">Total Classes</p>
              <p className="text-lg font-bold text-blue-600">{semester.stats?.totalClasses || 0}</p>
            </div>
            <div className="p-2 bg-green-50 rounded text-center">
              <p className="text-xs text-gray-600">Present</p>
              <p className="text-lg font-bold text-green-600">{semester.stats?.presentDays || 0}</p>
            </div>
          </div>

          {/* Faculty Info */}
          {semester.faculty && (
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Class Advisor</p>
              <p className="text-sm font-medium text-gray-700">{semester.faculty.name}</p>
            </div>
          )}

          {/* Action Hint */}
          <div className="flex items-center justify-center pt-2 text-blue-600 text-sm font-medium">
            <span>View Details</span>
            <span className="ml-1">→</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemesterCard;


