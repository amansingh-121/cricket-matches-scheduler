const fs = require('fs');
const path = require('path');

// Check if MongoDB is configured
const MONGODB_URI = process.env.MONGODB_URI;
const USE_MONGODB = !!MONGODB_URI;

console.log(`📊 Database Mode: ${USE_MONGODB ? '☁️  MongoDB (Production - Data Saved Forever)' : '💾 File System (Local Development)'}`);

// MongoDB Models (only load if MongoDB is configured)
let mongoose, User, Team, AvailabilityPost, Match, ChatMessage;

if (USE_MONGODB) {
  mongoose = require('mongoose');
  const models = require('./models');
  User = models.User;
  Team = models.Team;
  AvailabilityPost = models.AvailabilityPost;
  Match = models.Match;
  ChatMessage = models.ChatMessage;
}

// File system fallback
const DATA_FILE = path.join(__dirname, 'data.json');
let fileData = {
  users: [],
  teams: [],
  availabilityPosts: [],
  matches: [],
  chatMessages: []
};

function loadFileData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Error loading file data:', error);
  }
}

function saveFileData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));
  } catch (error) {
    console.log('Error saving file data:', error);
  }
}

// Initialize
async function initDatabase() {
  if (USE_MONGODB) {
    try {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ Connected to MongoDB Atlas');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  } else {
    loadFileData();
    console.log('✅ Using local file system storage');
  }
}

// Database operations wrapper
const db = {
  // Users
  async findUserByPhone(phone) {
    if (USE_MONGODB) {
      return await User.findOne({ phone });
    } else {
      return fileData.users.find(u => u.phone === phone);
    }
  },

  async findUserById(id) {
    if (USE_MONGODB) {
      return await User.findOne({ id });
    } else {
      return fileData.users.find(u => u.id === id);
    }
  },

  async createUser(userData) {
    if (USE_MONGODB) {
      const user = new User(userData);
      await user.save();
      return user;
    } else {
      fileData.users.push(userData);
      saveFileData();
      return userData;
    }
  },

  async getAllUsers() {
    if (USE_MONGODB) {
      return await User.find({});
    } else {
      return fileData.users;
    }
  },

  async deleteUser(id) {
    if (USE_MONGODB) {
      await User.deleteOne({ id });
    } else {
      const index = fileData.users.findIndex(u => u.id === id);
      if (index !== -1) {
        fileData.users.splice(index, 1);
        saveFileData();
      }
    }
  },

  // Teams
  async findTeamsByCaptain(captainId) {
    if (USE_MONGODB) {
      return await Team.find({ captain_id: captainId });
    } else {
      return fileData.teams.filter(t => t.captain_id === captainId);
    }
  },

  async findTeamById(id) {
    if (USE_MONGODB) {
      return await Team.findOne({ id });
    } else {
      return fileData.teams.find(t => t.id === id);
    }
  },

  async createTeam(teamData) {
    if (USE_MONGODB) {
      const team = new Team(teamData);
      await team.save();
      return team;
    } else {
      fileData.teams.push(teamData);
      saveFileData();
      return teamData;
    }
  },

  async getAllTeams() {
    if (USE_MONGODB) {
      return await Team.find({});
    } else {
      return fileData.teams;
    }
  },

  async deleteTeam(id) {
    if (USE_MONGODB) {
      await Team.deleteOne({ id });
    } else {
      const index = fileData.teams.findIndex(t => t.id === id);
      if (index !== -1) {
        fileData.teams.splice(index, 1);
        saveFileData();
      }
    }
  },

  // Availability Posts
  async findAvailabilityPost(query) {
    if (USE_MONGODB) {
      return await AvailabilityPost.findOne(query);
    } else {
      return fileData.availabilityPosts.find(p => {
        for (let key in query) {
          if (p[key] !== query[key]) return false;
        }
        return true;
      });
    }
  },

  async findAvailabilityPosts(query) {
    if (USE_MONGODB) {
      return await AvailabilityPost.find(query);
    } else {
      return fileData.availabilityPosts.filter(p => {
        for (let key in query) {
          if (p[key] !== query[key]) return false;
        }
        return true;
      });
    }
  },

  async createAvailabilityPost(postData) {
    if (USE_MONGODB) {
      const post = new AvailabilityPost(postData);
      await post.save();
      return post;
    } else {
      fileData.availabilityPosts.push(postData);
      saveFileData();
      return postData;
    }
  },

  async updateAvailabilityPost(id, updates) {
    if (USE_MONGODB) {
      await AvailabilityPost.updateOne({ id }, { $set: updates });
    } else {
      const post = fileData.availabilityPosts.find(p => p.id === id);
      if (post) {
        Object.assign(post, updates);
        saveFileData();
      }
    }
  },

  async deleteAvailabilityPost(id) {
    if (USE_MONGODB) {
      await AvailabilityPost.deleteOne({ id });
    } else {
      const index = fileData.availabilityPosts.findIndex(p => p.id === id);
      if (index !== -1) {
        fileData.availabilityPosts.splice(index, 1);
        saveFileData();
      }
    }
  },

  async getAllAvailabilityPosts() {
    if (USE_MONGODB) {
      return await AvailabilityPost.find({});
    } else {
      return fileData.availabilityPosts;
    }
  },

  async setAvailabilityPosts(posts) {
    if (USE_MONGODB) {
      // For MongoDB, we'll just filter out old ones in the cleanup function
      // This is called during cleanup
    } else {
      fileData.availabilityPosts = posts;
      saveFileData();
    }
  },

  // Matches
  async findMatchById(id) {
    if (USE_MONGODB) {
      return await Match.findOne({ id });
    } else {
      return fileData.matches.find(m => m.id === id);
    }
  },

  async findMatchesByTeamIds(teamIds) {
    if (USE_MONGODB) {
      return await Match.find({
        $or: [
          { team1_id: { $in: teamIds } },
          { team2_id: { $in: teamIds } }
        ]
      });
    } else {
      return fileData.matches.filter(m =>
        teamIds.includes(m.team1_id) || teamIds.includes(m.team2_id)
      );
    }
  },

  async createMatch(matchData) {
    if (USE_MONGODB) {
      const match = new Match(matchData);
      await match.save();
      return match;
    } else {
      fileData.matches.push(matchData);
      saveFileData();
      return matchData;
    }
  },

  async updateMatch(id, updates) {
    if (USE_MONGODB) {
      await Match.updateOne({ id }, { $set: updates });
    } else {
      const match = fileData.matches.find(m => m.id === id);
      if (match) {
        Object.assign(match, updates);
        saveFileData();
      }
    }
  },

  async getAllMatches() {
    if (USE_MONGODB) {
      return await Match.find({});
    } else {
      return fileData.matches;
    }
  },

  async deleteMatch(id) {
    if (USE_MONGODB) {
      await Match.deleteOne({ id });
    } else {
      const index = fileData.matches.findIndex(m => m.id === id);
      if (index !== -1) {
        fileData.matches.splice(index, 1);
        saveFileData();
      }
    }
  },

  // Chat Messages
  async findChatMessagesByMatchId(matchId) {
    if (USE_MONGODB) {
      return await ChatMessage.find({ match_id: matchId }).sort({ timestamp: 1 });
    } else {
      return fileData.chatMessages
        .filter(msg => msg.match_id === matchId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
  },

  async createChatMessage(messageData) {
    if (USE_MONGODB) {
      const message = new ChatMessage(messageData);
      await message.save();
      return message;
    } else {
      fileData.chatMessages.push(messageData);
      saveFileData();
      return messageData;
    }
  }
};

module.exports = { initDatabase, db, USE_MONGODB };
