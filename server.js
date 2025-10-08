const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { initDatabase, db, USE_MONGODB } = require('./db');

const app = express();
// Use environment PORT for production deployment, fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cricket_secret_key';

// Add CORS middleware for cross-origin requests
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://cricket-matches-scheduler.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(__dirname));

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
  teams: [],
  availabilityPosts: [],
  matches: [],
  chats: [],
  chatMessages: []
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Error loading data:', error);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    // If MongoDB is available, sync data to it
    if (USE_MONGODB) {
      syncToMongoDB().catch(err => console.error('MongoDB sync error:', err));
    }
  } catch (error) {
    console.log('Error saving data:', error);
  }
}

// Sync data to MongoDB (runs in background)
async function syncToMongoDB() {
  if (!USE_MONGODB) return;
  
  try {
    // Sync all users
    for (const user of data.users) {
      await db.createUser(user).catch(() => {
        // User might already exist, update instead
      });
    }
    
    // Sync all teams
    for (const team of data.teams) {
      await db.createTeam(team).catch(() => {});
    }
    
    // Sync all availability posts
    for (const post of data.availabilityPosts) {
      await db.createAvailabilityPost(post).catch(() => {});
    }
    
    // Sync all matches
    for (const match of data.matches) {
      await db.createMatch(match).catch(() => {});
    }
    
    // Sync all chat messages
    for (const msg of data.chatMessages) {
      await db.createChatMessage(msg).catch(() => {});
    }
  } catch (error) {
    // Silent fail for sync errors
  }
}

function cleanupExpiredPosts() {
  const today = new Date();
  const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  data.availabilityPosts = data.availabilityPosts.filter(post => {
    if (post.status !== 'open') return true;
    
    const postDate = new Date(post.created_at);
    const daysDiff = Math.floor((today - postDate) / (1000 * 60 * 60 * 24));
    
    // Remove if post is older than 7 days or if the day has passed this week
    if (daysDiff >= 7) return false;
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = days.indexOf(todayDay);
    const postDayIndex = days.indexOf(post.day);
    
    // If post day has passed this week, remove it
    if (postDayIndex < todayIndex && daysDiff > 0) return false;
    
    return true;
  });
}

function removeDuplicatePosts() {
  const seen = new Set();
  data.availabilityPosts = data.availabilityPosts.filter(post => {
    const key = `${post.team_id}-${post.day}-${post.bet_amount}-${post.ground}-${post.ground_type || 'free'}-${post.status}`;
    if (seen.has(key) && post.status === 'open') {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Cricket Scheduler API is running', timestamp: new Date().toISOString() });
});

// Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Cricket Match Scheduler API', 
    version: '1.0.0',
    endpoints: {
      auth: ['/api/login', '/api/signup'],
      matches: ['/api/matches', '/api/match/confirm'],
      availability: ['/api/availability/create', '/api/availability/open'],
      chat: ['/api/chat/:matchId', '/api/chat/send'],
      admin: ['/api/admin/matches']
    }
  });
});

app.post('/api/signup', async (req, res) => {
  const { name, phone, password, role } = req.body;
  
  const existingUser = data.users.find(u => u.phone === phone);
  
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists! Please login instead.' });
  }
  
  const user = {
    id: generateId(),
    name,
    phone,
    password,
    role: role || 'captain',
    created_at: new Date().toISOString()
  };
  
  data.users.push(user);
  saveData();
  
  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name, role: user.role } });
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  const user = data.users.find(u => u.phone === phone);
  
  if (!user) {
    return res.status(400).json({ error: 'User not found! Please signup first.' });
  }
  
  if (user.password !== password) {
    return res.status(400).json({ error: 'Invalid password!' });
  }
  
  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

app.get('/api/teams', authenticateToken, (req, res) => {
  const teams = data.teams.filter(t => t.captain_id === req.user.id);
  res.json(teams);
});

app.get('/api/user/team', authenticateToken, (req, res) => {
  const team = data.teams.find(t => t.captain_id === req.user.id);
  const user = data.users.find(u => u.id === req.user.id);
  
  if (team) {
    res.json({ 
      hasTeam: true, 
      team: {
        id: team.id,
        name: team.team_name,
        ground: team.ground
      },
      user: { name: user?.name }
    });
  } else {
    res.json({ 
      hasTeam: false, 
      team: null,
      user: { name: user?.name }
    });
  }
});

app.post('/api/availability/create', authenticateToken, (req, res) => {
  console.log('=== AVAILABILITY CREATE REQUEST ===');
  console.log('Request body:', req.body);
  console.log('User ID:', req.user.id);
  
  cleanupExpiredPosts();
  
  const { day, date, bet_amount, time_slot, ground, ground_type, team_name } = req.body;
  
  let team = data.teams.find(t => t.captain_id === req.user.id);
  if (!team) {
    console.log('No team found, creating new team for user:', req.user.id);
    const user = data.users.find(u => u.id === req.user.id);
    const defaultTeamName = team_name || `${user.name}'s Team`;
    
    team = {
      id: generateId(),
      captain_id: req.user.id,
      team_name: defaultTeamName,
      ground: 'Dussehra Ground',
      members: [req.user.id],
      created_at: new Date().toISOString()
    };
    data.teams.push(team);
    saveData();
    console.log('Team created:', team.team_name);
  } else {
    console.log('Team found:', team.team_name);
  }
  
  // Check for duplicate posts
  const existingPost = data.availabilityPosts.find(p => 
    p.team_id === team.id &&
    p.status === 'open' &&
    p.day === day &&
    p.bet_amount === bet_amount &&
    p.ground === (ground || team.ground) &&
    (p.ground_type || 'free') === (ground_type || 'free')
  );
  
  if (existingPost) {
    return res.status(400).json({ error: 'You already have an open request for this day, bet amount, and ground combination' });
  }
  
  const post = {
    id: generateId(),
    team_id: team.id,
    captain_id: req.user.id,
    day,
    date: date || null,
    bet_amount,
    time_slot: time_slot || '',
    ground: ground || team.ground,
    ground_type: ground_type || 'free',
    status: 'open',
    created_at: new Date().toISOString()
  };
  
  data.availabilityPosts.push(post);
  console.log('Post added to data:', post);
  console.log('Total posts now:', data.availabilityPosts.length);
  saveData();
  console.log('Data saved to file');
  
  const matchResult = tryMatch(post);
  
  if (matchResult) {
    res.json({ 
      post, 
      matched: true, 
      match: matchResult,
      message: 'Match found! Check your matches to confirm.' 
    });
  } else {
    const message = post.ground_type === 'paid' 
      ? 'Paid ground availability posted! Waiting for another captain with same day, ground, and compatible bet range.' 
      : 'Availability posted! Waiting for another captain with same day and bet amount.';
    
    res.json({ 
      post, 
      matched: false, 
      message 
    });
  }
});

function tryMatch(newPost) {
  console.log('=== TRYING TO MATCH ===');
  console.log('New post:', newPost);
  
  let candidates;
  
  if (newPost.ground_type === 'paid') {
    candidates = data.availabilityPosts.filter(p => {
      const matches = p.id !== newPost.id &&
        p.status === 'open' &&
        p.day === newPost.day &&
        p.ground === newPost.ground &&
        (p.ground_type || 'free') === 'paid' &&
        p.team_id !== newPost.team_id &&
        p.captain_id !== newPost.captain_id &&
        (p.bet_amount === newPost.bet_amount || 
         p.bet_amount === 'contact the opposite captain' || 
         newPost.bet_amount === 'contact the opposite captain');
      return matches;
    });
  } else {
    candidates = data.availabilityPosts.filter(p => {
      const matches = p.id !== newPost.id &&
        p.status === 'open' &&
        p.day === newPost.day &&
        p.bet_amount === newPost.bet_amount &&
        p.ground === newPost.ground &&
        (p.ground_type || 'free') === (newPost.ground_type || 'free') &&
        p.team_id !== newPost.team_id &&
        p.captain_id !== newPost.captain_id;
      return matches;
    });
  }
  
  if (candidates.length > 0) {
    const matchedPost = candidates[0];
    const match = {
      id: generateId(),
      team1_id: newPost.team_id,
      team2_id: matchedPost.team_id,
      captain1_id: newPost.captain_id,
      captain2_id: matchedPost.captain_id,
      day: newPost.day,
      date: newPost.date || matchedPost.date,
      bet_amount: newPost.bet_amount,
      ground: newPost.ground || matchedPost.ground,
      ground_type: newPost.ground_type || 'free',
      status: 'proposed',
      captain1_confirmed: false,
      captain2_confirmed: false,
      created_at: new Date().toISOString()
    };
    data.matches.push(match);

    newPost.status = 'matched';
    matchedPost.status = 'matched';

    saveData();
    return match;
  }
  
  return null;
}

app.get('/api/matches', authenticateToken, (req, res) => {
  const userTeams = data.teams.filter(t => t.captain_id === req.user.id);
  const userTeamIds = userTeams.map(t => t.id);
  
  if (userTeamIds.length === 0) {
    return res.json([]);
  }
  
  const matches = data.matches.filter(m => 
    userTeamIds.includes(m.team1_id) || userTeamIds.includes(m.team2_id)
  );
  
  const enrichedMatches = matches.map(match => {
    const team1 = data.teams.find(t => t.id === match.team1_id);
    const team2 = data.teams.find(t => t.id === match.team2_id);
    const captain1 = data.users.find(u => u.id === match.captain1_id);
    const captain2 = data.users.find(u => u.id === match.captain2_id);
    
    let opponent_contact = null;
    if (match.captain1_id === req.user.id) {
      opponent_contact = { name: captain2?.name, phone: captain2?.phone };
    } else if (match.captain2_id === req.user.id) {
      opponent_contact = { name: captain1?.name, phone: captain1?.phone };
    }
    
    return {
      ...match,
      team1_name: team1?.team_name,
      team2_name: team2?.team_name,
      opponent_contact
    };
  });
  
  res.json(enrichedMatches);
});

app.post('/api/match/confirm', authenticateToken, (req, res) => {
  const { match_id, decision } = req.body;
  
  const match = data.matches.find(m => m.id === match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (decision === 'confirm') {
    if (match.captain1_id === req.user.id) {
      match.captain1_confirmed = true;
    } else {
      match.captain2_confirmed = true;
    }
    if (match.captain1_confirmed && match.captain2_confirmed) {
      match.status = 'confirmed';
    } else {
      match.status = 'proposed';
    }
  } else if (decision === 'decline') {
    match.status = 'cancelled';
    const post1 = data.availabilityPosts.find(p => 
      p.team_id === match.team1_id && 
      p.status === 'matched' &&
      p.day === match.day &&
      p.bet_amount === match.bet_amount
    );
    const post2 = data.availabilityPosts.find(p => 
      p.team_id === match.team2_id && 
      p.status === 'matched' &&
      p.day === match.day &&
      p.bet_amount === match.bet_amount
    );
    if (post1) {
      post1.status = 'open';
    }
    if (post2) {
      post2.status = 'open';
    }
  }
  
  saveData();
  res.json({ success: true, match });
});

app.get('/api/availability/open', (req, res) => {
  try {
    if (!data || !data.availabilityPosts) {
      loadData();
    }
    cleanupExpiredPosts();
    removeDuplicatePosts();
    saveData();

    const ground_type = req.query.ground_type || 'free';

    const openPosts = data.availabilityPosts.filter(p => {
      return p.status === 'open' && (p.ground_type || 'free') === ground_type;
    });
    
    const enrichedPosts = openPosts.map(post => {
      const team = data.teams.find(t => t.id === post.team_id);
      const captain = data.users.find(u => u.id === post.captain_id);
      return {
        ...post,
        team_name: team?.team_name || 'Unknown Team',
        captain_name: captain?.name || 'Unknown Captain',
        captain_phone: captain?.phone || 'N/A'
      };
    });
    
    res.json(enrichedPosts);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Admin endpoints
app.get('/api/admin/matches', (req, res) => {
  const enrichedMatches = data.matches.map(match => {
    const team1 = data.teams.find(t => t.id === match.team1_id);
    const team2 = data.teams.find(t => t.id === match.team2_id);
    const captain1 = data.users.find(u => u.id === match.captain1_id);
    const captain2 = data.users.find(u => u.id === match.captain2_id);
    return {
      ...match,
      team1_name: team1?.team_name,
      team2_name: team2?.team_name,
      captain1_name: captain1?.name,
      captain2_name: captain2?.name
    };
  });
  res.json(enrichedMatches);
});

app.get('/api/admin/users', (req, res) => {
  res.json(data.users);
});

app.get('/api/admin/teams', (req, res) => {
  const enrichedTeams = data.teams.map(team => {
    const captain = data.users.find(u => u.id === team.captain_id);
    return {
      ...team,
      captain_name: captain?.name,
      captain_phone: captain?.phone
    };
  });
  res.json(enrichedTeams);
});

app.get('/api/admin/availability', (req, res) => {
  const enrichedPosts = data.availabilityPosts.map(post => {
    const team = data.teams.find(t => t.id === post.team_id);
    const captain = data.users.find(u => u.id === post.captain_id);
    return {
      ...post,
      team_name: team?.team_name,
      captain_name: captain?.name
    };
  });
  res.json(enrichedPosts);
});

// Admin Delete endpoints
app.delete('/api/admin/match/:id', (req, res) => {
  const { id } = req.params;
  const index = data.matches.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Match not found' });
  }
  data.matches.splice(index, 1);
  saveData();
  res.json({ success: true, message: 'Match deleted' });
});

app.delete('/api/admin/user/:id', (req, res) => {
  const { id } = req.params;
  const index = data.users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  data.users.splice(index, 1);
  saveData();
  res.json({ success: true, message: 'User deleted' });
});

app.delete('/api/admin/team/:id', (req, res) => {
  const { id } = req.params;
  const index = data.teams.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  data.teams.splice(index, 1);
  saveData();
  res.json({ success: true, message: 'Team deleted' });
});

app.delete('/api/admin/availability/:id', (req, res) => {
  const { id } = req.params;
  const index = data.availabilityPosts.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }
  data.availabilityPosts.splice(index, 1);
  saveData();
  res.json({ success: true, message: 'Availability post deleted' });
});

// Chat endpoints
app.get('/api/chat/:matchId', authenticateToken, (req, res) => {
  const { matchId } = req.params;
  const match = data.matches.find(m => m.id === matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!data.chatMessages) {
    data.chatMessages = [];
  }
  const messages = data.chatMessages.filter(msg => msg.match_id === matchId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(messages);
});

app.post('/api/chat/send', authenticateToken, (req, res) => {
  const { match_id, message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  const match = data.matches.find(m => m.id === match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (!data.chatMessages) {
    data.chatMessages = [];
  }
  const chatMessage = {
    id: generateId(),
    match_id,
    sender_id: req.user.id,
    sender_name: user.name,
    message: message.trim(),
    timestamp: new Date().toISOString()
  };
  
  data.chatMessages.push(chatMessage);
  saveData();
  res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404 for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Load data from MongoDB on startup
async function loadFromMongoDB() {
  if (!USE_MONGODB) return;
  
  try {
    console.log('📥 Loading data from MongoDB...');
    
    // Load all data from MongoDB
    const users = await db.getAllUsers();
    const teams = await db.getAllTeams();
    const availabilityPosts = await db.getAllAvailabilityPosts();
    const matches = await db.getAllMatches();
    
    // Convert MongoDB documents to plain objects
    data.users = users.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      password: u.password,
      role: u.role,
      created_at: u.created_at
    }));
    
    data.teams = teams.map(t => ({
      id: t.id,
      captain_id: t.captain_id,
      team_name: t.team_name,
      ground: t.ground,
      members: t.members,
      created_at: t.created_at
    }));
    
    data.availabilityPosts = availabilityPosts.map(p => ({
      id: p.id,
      team_id: p.team_id,
      captain_id: p.captain_id,
      day: p.day,
      date: p.date,
      bet_amount: p.bet_amount,
      time_slot: p.time_slot,
      ground: p.ground,
      ground_type: p.ground_type,
      status: p.status,
      created_at: p.created_at
    }));
    
    data.matches = matches.map(m => ({
      id: m.id,
      team1_id: m.team1_id,
      team2_id: m.team2_id,
      captain1_id: m.captain1_id,
      captain2_id: m.captain2_id,
      day: m.day,
      date: m.date,
      bet_amount: m.bet_amount,
      ground: m.ground,
      ground_type: m.ground_type,
      status: m.status,
      captain1_confirmed: m.captain1_confirmed,
      captain2_confirmed: m.captain2_confirmed,
      created_at: m.created_at
    }));
    
    data.chatMessages = [];
    
    console.log(`✅ Loaded ${users.length} users, ${teams.length} teams, ${availabilityPosts.length} posts, ${matches.length} matches from MongoDB`);
  } catch (error) {
    console.error('Error loading from MongoDB:', error);
  }
}

// Initialize data on startup
async function startServer() {
  try {
    // Initialize database (MongoDB or File System)
    await initDatabase();

    // Load existing data
    if (USE_MONGODB) {
      try {
        await loadFromMongoDB();
        console.log('✅ MongoDB data loaded successfully');
      } catch (error) {
        console.error('❌ Error loading from MongoDB:', error);
        // If MongoDB fails, fall back to file system
        if (fs.existsSync(DATA_FILE)) {
          console.log('🔄 Falling back to file system data');
          loadData();
          removeDuplicatePosts();
          saveData();
        }
      }
    } else {
      // File system fallback
      if (fs.existsSync(DATA_FILE)) {
        loadData();
        removeDuplicatePosts();
        saveData();
        console.log('✅ File system data loaded successfully');
      } else {
        console.log('ℹ️ No data file found, starting with empty data');
        // Create empty data file if it doesn't exist
        saveData();
      }
    }
    
    // Start the server only after database is initialized
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Mode: ${USE_MONGODB ? 'MongoDB' : 'File System'}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err);
      // Close server & exit process
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startServer();
