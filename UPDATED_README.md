# Cricket Scheduler - Database Update

## Changes Made

### 1. Added MongoDB Support
- Created `models.js` - Database schemas
- Created `db.js` - Database wrapper (works with both MongoDB and File System)
- Updated `package.json` - Added mongoose dependency

### 2. How It Works Now

**LOCAL DEVELOPMENT (Your Computer)**
- Uses `data.json` file (same as before)
- No changes needed

**PRODUCTION (Render)**
- Uses MongoDB Atlas (permanent storage)
- Data never gets deleted
- Users' data is saved forever

### 3. Setup Steps

#### For Local Development (No Changes Needed)
```bash
npm install
npm start
```
Everything works as before!

#### For Production (Render)
1. Follow `MONGODB_SETUP.md` to create MongoDB Atlas account (FREE)
2. Add `MONGODB_URI` environment variable to Render
3. Deploy - Done!

### 4. Benefits
✅ Data is permanently saved on Render
✅ Works locally without MongoDB
✅ No code changes needed for local development
✅ Automatic switching between file system and MongoDB

### 5. Next Steps
1. Run `npm install` to install new dependencies
2. Test locally (will use file system)
3. Setup MongoDB Atlas (follow MONGODB_SETUP.md)
4. Push to GitHub
5. Add MONGODB_URI to Render environment variables

## Important Files
- `models.js` - Database models
- `db.js` - Database operations wrapper
- `MONGODB_SETUP.md` - Step-by-step MongoDB setup guide
- `server.js` - Will be updated to use new database system
