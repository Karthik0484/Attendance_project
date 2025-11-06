export default {
  PORT: process.env.PORT || 5000,
  // MongoDB Atlas connection string - set in .env file
  // Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://karthik:8056963761@attendnace.fjxdkhx.mongodb.net/Attendance-Track?retryWrites=true&w=majority',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Frontend URL for CORS (set in .env file or use default Vercel URL)
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://attendance-project-qn03ugnuu-karthik-ks-projects-4c2799af.vercel.app'
};
