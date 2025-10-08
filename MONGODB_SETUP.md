# MongoDB Atlas Setup Guide for Cricket Scheduler

## Problem
Render's free tier has **ephemeral storage** - data gets deleted when server restarts. We need permanent database storage.

## Solution: MongoDB Atlas (FREE Forever)

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with Google/Email (100% FREE)
3. Choose **FREE M0 Tier** (512MB storage - enough for cricket app)

### Step 2: Create Database
1. Click "**Build a Database**"
2. Select "**M0 FREE**" tier
3. Choose cloud provider: **AWS** (default)
4. Choose region: **Mumbai (ap-south-1)** or closest to India
5. Click "**Create**"

### Step 3: Setup Database Access
1. **Username**: cricket-admin
2. **Password**: Generate a secure password (SAVE THIS!)
3. Click "**Create User**"

### Step 4: Setup Network Access
1. Click "**Network Access**" (left sidebar)
2. Click "**Add IP Address**"
3. Select "**Allow Access from Anywhere**" (0.0.0.0/0)
4. Click "**Confirm**"

### Step 5: Get Connection String
1. Click "**Database**" (left sidebar)
2. Click "**Connect**" button
3. Choose "**Connect your application**"
4. Copy the connection string (looks like):
   ```
   mongodb+srv://cricket-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Replace `<password>`** with your actual password

### Step 6: Add to Render
1. Go to your Render dashboard
2. Select your cricket-matches-scheduler service
3. Click "**Environment**" tab
4. Add new environment variable:
   - **Key**: `MONGODB_URI`
   - **Value**: Your connection string (with password)
5. Click "**Save Changes**"

### Step 7: Deploy
After adding MONGODB_URI, Render will automatically redeploy.

## ✅ Done!
Your data will now be **permanently stored** in MongoDB Atlas!

## Benefits
- ✅ Data never gets deleted
- ✅ Works perfectly on Render
- ✅ 100% FREE forever
- ✅ 512MB storage (enough for thousands of matches)
- ✅ Automatic backups
- ✅ Fast and reliable

## Important Notes
- Keep your MongoDB password safe
- Don't share your connection string publicly
- The free tier is perfect for this app
