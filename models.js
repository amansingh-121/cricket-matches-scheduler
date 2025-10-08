const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'captain' },
  created_at: { type: Date, default: Date.now }
});

// Team Schema
const teamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  captain_id: { type: String, required: true },
  team_name: { type: String, required: true },
  ground: { type: String, required: true },
  members: [String],
  created_at: { type: Date, default: Date.now }
});

// Availability Post Schema
const availabilityPostSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team_id: { type: String, required: true },
  captain_id: { type: String, required: true },
  day: { type: String, required: true },
  date: { type: String },
  bet_amount: { type: String, required: true },
  time_slot: { type: String },
  ground: { type: String, required: true },
  ground_type: { type: String, default: 'free' },
  status: { type: String, default: 'open' },
  created_at: { type: Date, default: Date.now }
});

// Match Schema
const matchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  team1_id: { type: String, required: true },
  team2_id: { type: String, required: true },
  captain1_id: { type: String, required: true },
  captain2_id: { type: String, required: true },
  day: { type: String, required: true },
  date: { type: String },
  bet_amount: { type: String, required: true },
  ground: { type: String },
  ground_type: { type: String, default: 'free' },
  status: { type: String, default: 'proposed' },
  captain1_confirmed: { type: Boolean, default: false },
  captain2_confirmed: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

// Chat Message Schema
const chatMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  match_id: { type: String, required: true },
  sender_id: { type: String, required: true },
  sender_name: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Team = mongoose.model('Team', teamSchema);
const AvailabilityPost = mongoose.model('AvailabilityPost', availabilityPostSchema);
const Match = mongoose.model('Match', matchSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = {
  User,
  Team,
  AvailabilityPost,
  Match,
  ChatMessage
};
