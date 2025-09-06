# Cricket Match Scheduler

A web application for scheduling local cricket matches between teams with automatic matching based on day and bet amount.

## Features

- **User Registration/Login**: Captains and players can sign up
- **Team Management**: Captains can create teams
- **Availability Posting**: Post availability with day, bet amount, time slot, and ground
- **Automatic Matching**: System automatically matches teams with same day and bet amount
- **Match Confirmation**: Both captains must confirm matches
- **Admin Panel**: View all matches and manage users

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open Browser**
   Navigate to `http://localhost:3000`

## How It Works

1. **Sign Up** as a Captain
2. **Create a Team** with team name and optional ground
3. **Post Availability** by selecting:
   - Team
   - Day (Monday-Sunday)
   - Bet Amount
   - Optional: Time slot and ground
4. **Automatic Matching**: If another captain posts the same day and bet amount, a match is automatically created
5. **Confirm Match**: Both captains receive the match proposal and must confirm
6. **Match Scheduled**: Once both confirm, the match is scheduled

## API Endpoints

- `POST /api/signup` - User registration
- `POST /api/login` - User login
- `POST /api/teams/create` - Create team
- `POST /api/availability/create` - Post availability
- `GET /api/matches` - Get user's matches
- `POST /api/match/confirm` - Confirm/decline match
- `GET /api/availability/open` - View open requests
- `GET /api/admin/matches` - Admin view all matches

## Data Storage

Currently uses simple JSON file storage (`data.json`). For production, upgrade to MongoDB or PostgreSQL.

## Legal Note

If using real money betting, check local laws and implement proper KYC/payment systems.

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Storage**: JSON file (upgradeable to MongoDB)
- **Auth**: JWT tokens

## Development

```bash
# Install nodemon for development
npm install -g nodemon

# Run in development mode
npm run dev
```