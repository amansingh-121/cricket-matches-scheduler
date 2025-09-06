const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3003;
const JWT_SECRET = 'cricket_secret_key';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  users: [],
  teams: [],
  availabilityPosts: [],
  matches: []
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
  } catch (error) {
    console.log('Error saving data:', error);
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

app.post('/api/signup', async (req, res) => {
  const { name, phone, email, password, team_name, role } = req.body;
  
  const existingUser = data.users.find(u => u.email === email || u.phone === phone);
  
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists! Please login instead.' });
  }
  
  const user = {
    id: uuidv4(),
    name,
    phone,
    email,
    password,
    role: role || 'captain',
    created_at: new Date().toISOString()
  };
  
  data.users.push(user);
  
  if (role === 'captain' || !role) {
    const team = {
      id: uuidv4(),
      captain_id: user.id,
      team_name,
      ground: 'Dussehra Ground',
      members: [user.id],
      created_at: new Date().toISOString()
    };
    data.teams.push(team);
  }
  
  saveData();
  
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name, role: user.role } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = data.users.find(u => u.email === email);
  
  if (!user) {
    return res.status(400).json({ error: 'User not found! Please signup first.' });
  }
  
  if (user.password !== password) {
    return res.status(400).json({ error: 'Invalid password!' });
  }
  
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

app.get('/api/teams', authenticateToken, (req, res) => {
  const teams = data.teams.filter(t => t.captain_id === req.user.id);
  res.json(teams);
});

app.get('/api/user/team', authenticateToken, (req, res) => {
  const team = data.teams.find(t => t.captain_id === req.user.id);
  const user = data.users.find(u => u.id === req.user.id);
  
  res.json({ 
    hasTeam: true, 
    team: {
      id: team.id,
      name: team.team_name,
      ground: team.ground
    },
    user: { name: user?.name }
  });
});

app.post('/api/availability/create', authenticateToken, (req, res) => {
  cleanupExpiredPosts();
  
  const { day, date, bet_amount, time_slot, ground, ground_type } = req.body;
  
  const team = data.teams.find(t => t.captain_id === req.user.id);
  if (!team) {
    return res.status(404).json({ error: 'You need to create a team first' });
  }
  
  const post = {
    id: uuidv4(),
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
  saveData();
  
  const matchResult = tryMatch(post);
  
  if (matchResult) {
    res.json({ 
      post, 
      matched: true, 
      match: matchResult,
      message: 'Match found! Check your matches to confirm.' 
    });
  } else {
    const message = newPost.ground_type === 'paid' 
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
  let candidates;
  
  if (newPost.ground_type === 'paid') {
    // For paid grounds, match on day, ground, and bet range
    candidates = data.availabilityPosts.filter(p => 
      p.id !== newPost.id &&
      p.status === 'open' &&
      p.day === newPost.day &&
      p.ground === newPost.ground &&
      p.ground_type === 'paid' &&
      p.team_id !== newPost.team_id &&
      p.captain_id !== newPost.captain_id &&
      (p.bet_amount === newPost.bet_amount || 
       p.bet_amount === 'contact the opposite captain' || 
       newPost.bet_amount === 'contact the opposite captain')
    );
  } else {
    // For free grounds, match on day and bet amount
    candidates = data.availabilityPosts.filter(p => 
      p.id !== newPost.id &&
      p.status === 'open' &&
      p.day === newPost.day &&
      p.bet_amount === newPost.bet_amount &&
      p.ground_type === newPost.ground_type &&
      p.team_id !== newPost.team_id &&
      p.captain_id !== newPost.captain_id
    );
  }
  
  if (candidates.length > 0) {
    const matchedPost = candidates[0];
    
    const match = {
      id: uuidv4(),
      team1_id: newPost.team_id,
      team2_id: matchedPost.team_id,
      captain1_id: newPost.captain_id,
      captain2_id: matchedPost.captain_id,
      day: newPost.day,
      date: newPost.date || matchedPost.date,
      bet_amount: newPost.bet_amount,
      ground: newPost.ground || matchedPost.ground,
      ground_type: newPost.ground_type,
      status: 'proposed',
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
    
    // Determine opponent contact based on current user
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
    }
  } else {
    match.status = 'cancelled';
    
    const post1 = data.availabilityPosts.find(p => p.team_id === match.team1_id && p.status === 'matched');
    const post2 = data.availabilityPosts.find(p => p.team_id === match.team2_id && p.status === 'matched');
    if (post1) post1.status = 'open';
    if (post2) post2.status = 'open';
  }
  
  saveData();
  res.json({ success: true });
});

app.get('/api/availability/open', (req, res) => {
  cleanupExpiredPosts();
  saveData();
  
  const ground_type = req.query.ground_type || 'free';
  const openPosts = data.availabilityPosts.filter(p => 
    p.status === 'open' && 
    (p.ground_type || 'free') === ground_type
  );
  
  const enrichedPosts = openPosts.map(post => {
    const team = data.teams.find(t => t.id === post.team_id);
    const captain = data.users.find(u => u.id === post.captain_id);
    
    return {
      ...post,
      team_name: team?.team_name,
      captain_name: captain?.name,
      captain_phone: captain?.phone
    };
  });
  
  res.json(enrichedPosts);
});

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
  
  const match = data.matches.find(m => m.id === match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const user = data.users.find(u => u.id === req.user.id);
  
  if (!data.chatMessages) {
    data.chatMessages = [];
  }
  
  const chatMessage = {
    id: uuidv4(),
    match_id,
    sender_id: req.user.id,
    sender_name: user?.name,
    message: message.trim(),
    timestamp: new Date().toISOString()
  };
  
  data.chatMessages.push(chatMessage);
  saveData();
  
  res.json({ success: true });
});

loadData();

app.listen(PORT, () => {
  console.log(`Cricket Match Scheduler running on http://localhost:${PORT}`);
});