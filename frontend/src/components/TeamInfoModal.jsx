import { useEffect } from 'react';
import projectInfo from '../config/projectInfo';
import usePreventBodyScroll from '../hooks/usePreventBodyScroll';

const TeamInfoModal = ({ isOpen, onClose }) => {
  // Prevent background scrolling when modal is open
  usePreventBodyScroll(isOpen);

  // Close modal on ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto transform transition-all animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">{projectInfo.projectName}</h2>
              <p className="text-blue-100 text-lg">Developed by Team Akvora</p>
              <p className="text-blue-200 text-sm mt-1">{projectInfo.institution}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
              aria-label="Close modal"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Project Information */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Project Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-xl">
              <div>
                <p className="text-sm text-gray-600 font-medium">Version</p>
                <p className="text-lg font-semibold text-gray-900">{projectInfo.version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Department</p>
                <p className="text-lg font-semibold text-gray-900">{projectInfo.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Duration</p>
                <p className="text-lg font-semibold text-gray-900">{projectInfo.duration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Institution</p>
                <p className="text-lg font-semibold text-gray-900">{projectInfo.institution}</p>
              </div>
            </div>
          </section>

          {/* Mentor Section */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-3xl">👨‍🏫</span>
              Project Mentor
            </h3>
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-xl border-2 border-amber-200 shadow-lg">
                <div className="flex items-center gap-6">
                  <div className="bg-white rounded-full w-24 h-24 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
                    {projectInfo.mentor.avatar?.includes('/') || projectInfo.mentor.avatar?.includes('http') ? (
                      <img 
                        src={projectInfo.mentor.avatar} 
                        alt={projectInfo.mentor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-6xl">{projectInfo.mentor.avatar}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-2xl font-bold text-gray-900 mb-1">{projectInfo.mentor.name}</h4>
                    <p className="text-base text-amber-700 font-semibold mb-1">{projectInfo.mentor.designation}</p>
                    <p className="text-sm text-gray-600 mb-2">{projectInfo.mentor.department}</p>
                    <p className="text-sm text-amber-600 font-medium italic">{projectInfo.mentor.role}</p>
                    {projectInfo.mentor.email && (
                      <p className="text-sm text-gray-600 mt-3 flex items-center gap-2">
                        <span>📧</span> {projectInfo.mentor.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Team Members */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-3xl">👥</span>
              Team Akvora
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectInfo.team.map((member) => (
                <div
                  key={member.id}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 hover:shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                      {member.avatar?.includes('/') || member.avatar?.includes('http') ? (
                        <img 
                          src={member.avatar} 
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">{member.avatar}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{member.name}</h4>
                      <p className="text-sm text-blue-600 font-medium">{member.role}</p>
                    </div>
                  </div>
                  {member.email && (
                    <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                      <span>📧</span> {member.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Tech Stack */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-3xl">🛠️</span>
              Technology Stack
            </h3>
            <div className="flex flex-wrap gap-3">
              {projectInfo.techStack.map((tech, index) => (
                <div
                  key={index}
                  className={`${tech.color} px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 hover:scale-110 transition-transform duration-200 shadow-sm`}
                >
                  <span className="text-lg">{tech.icon}</span>
                  {tech.name}
                </div>
              ))}
            </div>
          </section>

          {/* Key Features */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-3xl">✨</span>
              Key Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectInfo.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-green-50 p-4 rounded-lg border border-green-100"
                >
                  <span className="text-green-600 text-xl">✓</span>
                  <span className="text-gray-800 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Acknowledgment */}
          <section>
            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-3xl">🙏</span>
              Acknowledgment
            </h3>
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-xl border-l-4 border-amber-400">
              <p className="text-gray-700 leading-relaxed italic">
                {projectInfo.acknowledgment}
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <p className="font-semibold">{projectInfo.version} © {projectInfo.year} Team Akvora</p>
            <p className="text-xs">All rights reserved</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default TeamInfoModal;

