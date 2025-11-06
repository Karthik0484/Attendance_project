# Environment Variables Setup

## MongoDB Atlas Configuration

Your MongoDB Atlas connection string has been configured. To use environment variables (recommended), create a `.env` file in the `backend` directory with the following content:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://karthik:8056963761@attendnace.fjxdkhx.mongodb.net/Attendance-Track?retryWrites=true&w=majority

# Server Port
PORT=5000

# JWT Secret (Change this to a secure random string in production)
JWT_SECRET=fallback_secret_key_change_in_production

# Environment
NODE_ENV=development

# Frontend URL for CORS (Vercel deployment)
FRONTEND_URL=https://attendance-project-qn03ugnuu-karthik-ks-projects-4c2799af.vercel.app
```

## Steps to Create .env File:

1. Navigate to the `backend` directory
2. Create a new file named `.env` (with the dot at the beginning)
3. Copy the content above into the file
4. Save the file

## Important Notes:

- The `.env` file is already configured in `.gitignore` to prevent committing sensitive data
- The connection string is currently set as a fallback in `config.js`, but using `.env` is recommended
- Make sure your MongoDB Atlas cluster allows connections from your IP address
- The database name is set to `Attendance-Track`

## MongoDB Atlas IP Whitelist:

Make sure to add your current IP address (or `0.0.0.0/0` for all IPs during development) in MongoDB Atlas:
1. Go to MongoDB Atlas Dashboard
2. Click on "Network Access"
3. Add your IP address or `0.0.0.0/0` for all IPs

## Testing Connection:

After setting up, restart your backend server. You should see:
```
✅ MongoDB Atlas Connected: [cluster-name]
📊 Database: Attendance-Track
```

