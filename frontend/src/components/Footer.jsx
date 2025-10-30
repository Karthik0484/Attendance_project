import { useState } from 'react';
import TeamInfoModal from './TeamInfoModal';
import projectInfo from '../config/projectInfo';

const Footer = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <footer className="mt-auto bg-gradient-to-r from-gray-800 to-gray-900 text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          {/* Copyright and System Name */}
          <div className="text-center md:text-left">
            <p className="text-sm">
              © {projectInfo.year} <span className="font-semibold">{projectInfo.projectName}</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{projectInfo.institutionSubtitle}</p>
          </div>

          {/* Team Credit - Clickable */}
          <div className="text-center md:text-right">
            <p className="text-sm flex items-center justify-center md:justify-end gap-2">
              <span>Developed with</span>
              <span className="text-red-500 animate-pulse">❤️</span>
              <span>by</span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="font-bold text-blue-400 hover:text-blue-300 underline decoration-blue-400 hover:decoration-blue-300 transition-all duration-200 hover:scale-105 inline-flex items-center gap-1"
              >
                Team Akvora
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {projectInfo.version} | {projectInfo.department}
            </p>
          </div>
        </div>
      </footer>

      {/* Team Info Modal */}
      <TeamInfoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default Footer;

