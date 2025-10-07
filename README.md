# Cricket Match Scheduler

A web application for scheduling and managing cricket matches between teams.

## Features

- User authentication (signup/login)
- Team management
- Post availability for matches
- Automatic match matching based on day, bet amount, and ground
- Match confirmation system
- Chat between team captains
- Admin dashboard

## Deployment on Render

### Prerequisites
- A GitHub account
- A Render account (sign up at https://render.com)

### Deployment Steps

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to https://render.com and sign in
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: cricket-matches-scheduler (or your preferred name)
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free
   
3. **Environment Variables (Optional):**
   - `NODE_ENV`: production
   - `JWT_SECRET`: (will be auto-generated if using render.yaml)

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for the deployment to complete
   - Your app will be available at: `https://YOUR-APP-NAME.onrender.com`

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## API Endpoints

- `GET /health` - Health check
- `POST /api/signup` - User registration
- `POST /api/login` - User login
- `GET /api/matches` - Get user's matches
- `POST /api/availability/create` - Post availability
- `GET /api/availability/open` - Get open availability posts
- `POST /api/match/confirm` - Confirm or decline a match
- `GET /api/chat/:matchId` - Get chat messages
- `POST /api/chat/send` - Send chat message

## Technology Stack

- **Backend**: Node.js, Express.js
- **Authentication**: JWT
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Storage**: JSON file-based storage

## License

MIT
