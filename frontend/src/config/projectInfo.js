// Project and Team Information Configuration
// This file contains all static information about the project and team

export const projectInfo = {
  projectName: "Attendance Management System",
  version: "v1.0.0",
  year: new Date().getFullYear(),
  institution: "ER.PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING",
  institutionSubtitle: "(AN AUTONOMOUS INSTITUTION)",
  department: "Department of Information Technology",
  duration: "October 2025 – Present",
  
  // Mentor Information
  mentor: {
    name: "Prof. Ramya.S", // Update with actual mentor name
    role: "Project Mentor & Guide",
    designation: "Assistant Professor",
    department: "Department of Information Technology",
    avatar: "👨‍🏫", // 📸 UPDATE HERE: Use emoji OR image path like "/src/assets/team/mentor.jpg"
    email: "ramya@epmcoe.edu.in"
  },
  
  team: [
    {
      id: 1,
      name: "Karthik.K",
      role: "Full Stack Developer / Team Lead",
      avatar: "/team/karthik.jpg", // 📸 Images moved to public/team folder
      email: "karthikofficial0484@gmail.com", // Optional
      github: "", // Optional
      linkedin: "" // Optional
    },
    {
      id: 2,
      name: "Dushyanth.C",
      role: "Backend Developer / Team Lead",
      avatar: "/team/dushyanth.jpg", // 📸 Images moved to public/team folder
      email: "dushyanthd912@gmail.com",
      github: "",
      linkedin: ""
    },
    {
      id: 3,
      name: "Balaji.S",
      role: "Frontend Developer",
      avatar: "/team/balaji.jpg", // 📸 Images moved to public/team folder
      email: "balajishanmugam2005@gmail.com",
      github: "",
      linkedin: ""
    },
    {
      id: 4,
      name: "Aravind.K",
      role: "Database Engineer",
      avatar: "/team/aravind.jpg", // 📸 Images moved to public/team folder
      email: "aravindaravind19720@gmail.com",
      github: "",
      linkedin: ""
    },
    {
      id: 5,
      name: "Kishore.S",
      role: "UI/UX Designer",
      avatar: "/team/kishore.jpg", // 📸 Images moved to public/team folder
      email: "kishorerack97@gmail.com",
      github: "",
      linkedin: ""
    }
  ],
  
  techStack: [
    { name: "React.js", icon: "⚛️", color: "bg-blue-100 text-blue-800" },
    { name: "Node.js", icon: "🟢", color: "bg-green-100 text-green-800" },
    { name: "Express.js", icon: "🚂", color: "bg-gray-100 text-gray-800" },
    { name: "MongoDB", icon: "🍃", color: "bg-green-100 text-green-800" },
    { name: "TailwindCSS", icon: "🎨", color: "bg-cyan-100 text-cyan-800" },
    { name: "JWT", icon: "🔐", color: "bg-purple-100 text-purple-800" },
    { name: "Mongoose", icon: "📦", color: "bg-red-100 text-red-800" }
  ],
  
  features: [
    "Multi-role authentication system",
    "Real-time attendance tracking",
    "Holiday management",
    "Absence reason submission & review",
    "Comprehensive reporting system",
    "Class advisor assignment",
    "Student profile management",
    "Responsive design for all devices"
  ],
  
  acknowledgment: "We extend our heartfelt gratitude to our mentor and the Department of Information Technology for their continuous guidance, support, and encouragement throughout the development of this project. Their valuable insights and feedback have been instrumental in bringing this system to fruition."
};

export default projectInfo;

