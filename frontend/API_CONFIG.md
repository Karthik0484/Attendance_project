# API Configuration Guide

## Backend URL Configuration

The frontend is configured to use your deployed backend URL: **https://attendance-project-74sp.onrender.com**

## How It Works

### Development Mode
- Uses Vite proxy to forward `/api/*` requests to `http://localhost:5000`
- Or uses `VITE_API_URL` from `.env.development` if set

### Production Mode
- Uses the deployed backend URL: `https://attendance-project-74sp.onrender.com`
- Or uses `VITE_API_URL` from `.env.production` if set

## Configuration Files

1. **`frontend/src/config/apiConfig.js`** - Main API configuration
   - Automatically detects development vs production
   - Uses environment variables when available

2. **`frontend/.env.production`** - Production environment variables
   - Set `VITE_API_URL` for production builds

3. **`frontend/.env.development`** - Development environment variables
   - Optional: Set `VITE_API_URL` to override Vite proxy

## Usage

The API base URL is automatically configured in:
- `AuthContext.jsx` - Sets axios default baseURL
- `apiFetch.js` - Uses the configured base URL

All API calls will automatically use the correct backend URL based on the environment.

## Testing

### Development
```bash
npm run dev
# API calls will go through Vite proxy to localhost:5000
```

### Production Build
```bash
npm run build
# API calls will go directly to https://attendance-project-74sp.onrender.com
```

## Important Notes

- The deployed backend URL is set as the default in production
- Make sure your backend CORS settings allow requests from your frontend domain
- The backend URL should not have a trailing slash

