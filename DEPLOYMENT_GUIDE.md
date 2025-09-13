# Deployment Guide

## Quick Deploy (JSON File Storage)

### Option 1: Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-cricket-app

# Deploy
git add .
git commit -m "Deploy cricket app"
git push heroku main
```

### Option 2: Railway
```bash
# Connect GitHub repo to Railway
# Auto-deploy on push
```

### Option 3: Vercel
```bash
npm install -g vercel
vercel --prod
```

## Important Notes:

### Current System:
- ✅ Multiple users can access website
- ✅ All data saves in same JSON file
- ✅ Real-time updates for all users
- ⚠️ Data resets if server restarts (Heroku)

### For Production:
- Add MongoDB/PostgreSQL database
- User authentication with sessions
- Data persistence guaranteed
- Better performance

## Environment Setup:
```bash
# Add to package.json
"scripts": {
  "start": "node server.js"
}

# Create Procfile for Heroku
echo "web: node server.js" > Procfile
```

## Access:
- Deploy URL: `https://your-app-name.herokuapp.com`
- Share this URL with anyone
- Works on all phones/devices
- Data syncs across all users