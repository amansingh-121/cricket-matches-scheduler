const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'cricket_secret_key';

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

function removeDuplicatePosts() {
  const seen = new Set();
  data.availabilityPosts = data.availabilityPosts.filter(post => {
    const key = `${post.team_id}-${post.day}-${post.bet_amount}-${post.ground}-${post.ground_type || 'free'}-${post.status}`;
    if (seen.has(key) && post.status === 'open') {
      return false; // Remove duplicate
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
    // For paid grounds, match on day, ground, and bet compatibility
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
      
      console.log(`Checking paid candidate ${p.id}: matches=${matches}`, {
        sameDay: p.day === newPost.day,
        sameGround: p.ground === newPost.ground,
        isPaid: (p.ground_type || 'free') === 'paid',
        differentTeam: p.team_id !== newPost.team_id,
        betCompatible: (p.bet_amount === newPost.bet_amount || 
                       p.bet_amount === 'contact the opposite captain' || 
                       newPost.bet_amount === 'contact the opposite captain')
      });
      
      return matches;
    });
  } else {
    // For free grounds, match on day, bet amount, and ground
    candidates = data.availabilityPosts.filter(p => {
      const matches = p.id !== newPost.id &&
        p.status === 'open' &&
        p.day === newPost.day &&
        p.bet_amount === newPost.bet_amount &&
        p.ground === newPost.ground &&
        (p.ground_type || 'free') === (newPost.ground_type || 'free') &&
        p.team_id !== newPost.team_id &&
        p.captain_id !== newPost.captain_id;
      
      console.log(`Checking free candidate ${p.id}: matches=${matches}`, {
        sameDay: p.day === newPost.day,
        sameBet: p.bet_amount === newPost.bet_amount,
        sameGround: p.ground === newPost.ground,
        sameGroundType: (p.ground_type || 'free') === (newPost.ground_type || 'free'),
        differentTeam: p.team_id !== newPost.team_id
      });
      
      return matches;
    });
  }
  
  console.log('Found candidates:', candidates.length);
  candidates.forEach(c => console.log('Candidate:', c));
  
  if (candidates.length > 0) {
    const matchedPost = candidates[0];
    console.log('Matched with:', matchedPost);
    
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
    
    console.log('Creating match:', match);
    data.matches.push(match);
    
    // Mark both posts as matched
    newPost.status = 'matched';
    matchedPost.status = 'matched';
    
    saveData();
    console.log('Match created and saved');
    
    return match;
  }
  
  console.log('No match found');
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
  
  console.log('=== MATCH CONFIRMATION ===');
  console.log('Match ID:', match_id);
  console.log('Decision:', decision);
  console.log('User ID:', req.user.id);
  
  const match = data.matches.find(m => m.id === match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  console.log('Found match:', match);
  
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (decision === 'confirm') {
    if (match.captain1_id === req.user.id) {
      match.captain1_confirmed = true;
      console.log('Captain 1 confirmed');
    } else {
      match.captain2_confirmed = true;
      console.log('Captain 2 confirmed');
    }
    
    // Check if both captains have confirmed
    if (match.captain1_confirmed && match.captain2_confirmed) {
      match.status = 'confirmed';
      console.log('Match fully confirmed by both captains');
    } else {
      match.status = 'proposed'; // Keep as proposed until both confirm
      console.log('Match partially confirmed, waiting for other captain');
    }
  } else if (decision === 'decline') {
    match.status = 'cancelled';
    console.log('Match cancelled');
    
    // Find and reopen the availability posts
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
      console.log('Reopened post 1:', post1.id);
    }
    if (post2) {
      post2.status = 'open';
      console.log('Reopened post 2:', post2.id);
    }
  }
  
  saveData();
  console.log('Match updated and saved');
  res.json({ success: true, match });
});

app.get('/api/availability/open', (req, res) => {
  try {
    console.log('=== OPEN REQUESTS API CALLED ===');
    console.log('Query params:', req.query);
    
    // Ensure data is loaded
    if (!data || !data.availabilityPosts) {
      loadData();
    }
    
    cleanupExpiredPosts();
    removeDuplicatePosts();
    saveData();
    
    const ground_type = req.query.ground_type || 'free';
    console.log('Filtering for ground_type:', ground_type);
    console.log('Total availability posts:', data.availabilityPosts.length);
    
    // Debug: Show all posts with their status and ground_type
    data.availabilityPosts.forEach((post, index) => {
      console.log(`Post ${index + 1}:`, {
        id: post.id,
        status: post.status,
        ground_type: post.ground_type || 'free',
        day: post.day,
        bet_amount: post.bet_amount
      });
    });
    
    const openPosts = data.availabilityPosts.filter(p => {
      const matches = p.status === 'open' && (p.ground_type || 'free') === ground_type;
      console.log(`Post ${p.id}: status=${p.status}, ground_type=${p.ground_type || 'free'}, matches=${matches}`);
      return matches;
    });
    
    console.log('Open posts found:', openPosts.length);
    console.log('Open posts details:', openPosts);
    
    const enrichedPosts = openPosts.map(post => {
      const team = data.teams.find(t => t.id === post.team_id);
      const captain = data.users.find(u => u.id === post.captain_id);
      
      const enriched = {
        ...post,
        team_name: team?.team_name || 'Unknown Team',
        captain_name: captain?.name || 'Unknown Captain',
        captain_phone: captain?.phone || 'N/A'
      };
      
      console.log('Enriched post:', enriched);
      return enriched;
    });
    
    console.log('Sending enriched posts:', enrichedPosts.length);
    res.json(enrichedPosts);
  } catch (error) {
    console.error('Error in /api/availability/open:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
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
  
  console.log('=== CHAT MESSAGES REQUEST ===');
  console.log('Match ID:', matchId);
  console.log('User ID:', req.user.id);
  
  const match = data.matches.find(m => m.id === matchId);
  if (!match) {
    console.log('Match not found for ID:', matchId);
    return res.status(404).json({ error: 'Match not found' });
  }
  
  console.log('Match found:', match.team1_name, 'vs', match.team2_name);
  
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    console.log('User not authorized for this match');
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (!data.chatMessages) {
    data.chatMessages = [];
  }
  
  const messages = data.chatMessages.filter(msg => msg.match_id === matchId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  console.log('Found', messages.length, 'messages for match');
  res.json(messages);
});

app.post('/api/chat/send', authenticateToken, (req, res) => {
  const { match_id, message } = req.body;
  
  console.log('=== SEND MESSAGE REQUEST ===');
  console.log('Match ID:', match_id);
  console.log('User ID:', req.user.id);
  console.log('Message:', message);
  
  if (!message || !message.trim()) {
    console.log('Empty message received');
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  const match = data.matches.find(m => m.id === match_id);
  if (!match) {
    console.log('Match not found for ID:', match_id);
    return res.status(404).json({ error: 'Match not found' });
  }
  
  console.log('Match found:', match.team1_name, 'vs', match.team2_name);
  
  if (match.captain1_id !== req.user.id && match.captain2_id !== req.user.id) {
    console.log('User not authorized for this match');
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) {
    console.log('User not found for ID:', req.user.id);
    return res.status(404).json({ error: 'User not found' });
  }
  
  console.log('Sender:', user.name);
  
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
  
  console.log('Creating chat message:', chatMessage);
  
  data.chatMessages.push(chatMessage);
  saveData();
  
  console.log('Message saved successfully');
  res.json({ success: true });
});

// Initialize data on startup
try {
  loadData();
  removeDuplicatePosts();
  saveData();
  console.log('Data loaded successfully on startup');
} catch (error) {
  console.error('Error loading data on startup:', error);
}

app.listen(PORT, () => {
  console.log(`Cricket Match Scheduler running on http://localhost:${PORT}`);
});

