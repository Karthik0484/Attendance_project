# Deployment Configuration Summary

## Frontend URL (Vercel)
**Production URL:** `https://attendance-project-qn03ugnuu-karthik-ks-projects-4c2799af.vercel.app`

## Backend URL (Render)
**Production URL:** `https://attendance-project-74sp.onrender.com`

## Configuration Files Updated

### Backend Configuration

1. **`backend/server.js`**
   - Added Vercel frontend URL to CORS allowed origins
   - Enhanced CORS to support Vercel preview deployments (any `*.vercel.app` domain)
   - Allows requests from your Vercel frontend

2. **`backend/config/config.js`**
   - Added `FRONTEND_URL` with Vercel URL as default
   - Can be overridden via environment variable

3. **`backend/ENV_SETUP.md`**
   - Updated with frontend URL configuration

### Frontend Configuration

1. **`frontend/src/config/apiConfig.js`**
   - Automatically uses deployed backend URL in production
   - Uses localhost in development

2. **`frontend/.env.production`**
   - Contains production backend URL

3. **`frontend/src/context/AuthContext.jsx`**
   - Uses API config for axios baseURL

4. **`frontend/src/utils/apiFetch.js`**
   - Uses API config for all API calls

## Environment Variables

### Backend (Render)
Set these in your Render dashboard:

```env
MONGODB_URI=mongodb+srv://karthik:8056963761@attendnace.fjxdkhx.mongodb.net/Attendance-Track?retryWrites=true&w=majority
PORT=5000
JWT_SECRET=your_secure_random_string_here
NODE_ENV=production
FRONTEND_URL=https://attendance-project-qn03ugnuu-karthik-ks-projects-4c2799af.vercel.app
```

### Frontend (Vercel)
Set these in your Vercel dashboard (optional, already configured in code):

```env
VITE_API_URL=https://attendance-project-74sp.onrender.com
```

## CORS Configuration

The backend is configured to allow requests from:
- ✅ `http://localhost:5173` (development)
- ✅ `http://localhost:5174` (development)
- ✅ `http://localhost:3000` (development)
- ✅ `https://attendance-project-qn03ugnuu-karthik-ks-projects-4c2799af.vercel.app` (production)
- ✅ Any `*.vercel.app` domain (Vercel preview deployments)

## Important Notes

1. **Vercel Preview Deployments**: The CORS configuration automatically allows any Vercel preview deployment URL (any subdomain ending in `.vercel.app`)

2. **Custom Domain**: If you add a custom domain to your Vercel deployment, add it to the `allowedOrigins` array in `backend/server.js`

3. **Security**: In production, make sure to:
   - Use a strong `JWT_SECRET` (not the default)
   - Set `NODE_ENV=production`
   - Consider restricting CORS to only your frontend domain for better security

4. **MongoDB Atlas**: Make sure your MongoDB Atlas Network Access allows connections from Render's IP addresses (or use `0.0.0.0/0` for all IPs)

## Testing

### Test Backend Connection
```bash
curl https://attendance-project-74sp.onrender.com/api/health
```

### Test Frontend → Backend
Open your browser console on the Vercel frontend and check for API calls. They should go to `https://attendance-project-74sp.onrender.com`

## Troubleshooting

### CORS Errors
If you see CORS errors:
1. Check that your frontend URL is in the `allowedOrigins` array
2. Verify `FRONTEND_URL` environment variable is set correctly in Render
3. Check browser console for the exact origin being blocked

### API Connection Errors
1. Verify backend is running on Render
2. Check that `VITE_API_URL` is set correctly (or use the default in `apiConfig.js`)
3. Verify backend CORS allows your frontend origin

