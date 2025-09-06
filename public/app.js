class CricketScheduler {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.init();
    }

    init() {
        this.bindEvents();
        if (this.token) {
            this.showDashboard();
            this.loadDashboardData();
        } else {
            this.showAuth();
        }
    }

    bindEvents() {
        // Auth events
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form').addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Dashboard events
        document.getElementById('availability-form').addEventListener('submit', (e) => this.handlePostAvailability(e));
        document.getElementById('paid-availability-form').addEventListener('submit', (e) => this.handlePostPaidAvailability(e));
        
        // Custom bet amount toggle
        document.getElementById('bet-amount').addEventListener('change', (e) => this.toggleCustomBet(e));
        
        // Chat events
        document.getElementById('close-chat').addEventListener('click', () => this.closeChatModal());
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                document.getElementById('login-form').reset();
                this.showDashboard();
                this.loadDashboardData();
            } else {
                alert(data.error || 'Invalid credentials');
            }
        } catch (error) {
            alert('Login failed. Please try again.');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const team_name = document.getElementById('signup-team-name').value.trim();
        const role = document.getElementById('signup-role').value;

        if (!name || !phone || !email || !password || !team_name) {
            alert('Please fill all required fields including team name');
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, email, password, team_name, role })
            });

            const data = await response.json();
            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                // Clear signup form
                document.getElementById('signup-form').reset();
                
                alert(`Welcome ${data.user.name}! Your account and team '${team_name}' have been created successfully.`);
                this.showDashboard();
                this.loadDashboardData();
            } else {
                alert(data.error || 'Signup failed');
            }
        } catch (error) {
            alert('Signup failed. Please try again.');
        }
    }

    handleLogout() {
        this.token = null;
        this.user = {};
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Clear all form data
        document.getElementById('login-form').reset();
        document.getElementById('signup-form').reset();
        if (document.getElementById('availability-form')) {
            document.getElementById('availability-form').reset();
        }
        
        // Clear dashboard content
        document.getElementById('teams-list').innerHTML = '';
        document.getElementById('matches-list').innerHTML = '';
        document.getElementById('open-requests').innerHTML = '';
        
        this.showAuth();
        console.log('User logged out successfully');
    }



    toggleCustomBet(e) {
        const customGroup = document.getElementById('custom-bet-group');
        if (e.target.value === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
    }

    async handlePostAvailability(e) {
        e.preventDefault();
        const day = document.getElementById('day-select').value;
        const date = document.getElementById('match-date').value;
        let bet_amount = document.getElementById('bet-amount').value;
        const time_slot = document.getElementById('time-slot').value;
        const ground = document.getElementById('ground').value;
        
        // Handle custom bet amount
        if (bet_amount === 'custom') {
            const customAmount = document.getElementById('custom-bet-amount').value.trim();
            if (!customAmount) {
                alert('Please enter custom bet amount');
                return;
            }
            bet_amount = customAmount;
        }

        try {
            const response = await fetch('/api/availability/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ day, date, bet_amount, time_slot, ground, ground_type: 'free' })
            });

            const result = await response.json();
            if (response.ok) {
                document.getElementById('availability-form').reset();
                this.loadMatches();
                this.loadOpenRequests();
                this.loadPaidOpenRequests();
                
                if (result.matched) {
                    alert(`🎉 ${result.message}\n\nMatch Details:\n📅 Day: ${result.match.day}\n💰 Bet: ₹${result.match.bet_amount}\n📍 Ground: ${result.match.ground || 'TBD'}\n\n⏰ Please confirm the match in 'My Matches' section!\n💬 You can now chat with the opponent captain!`);
                } else {
                    alert(result.message);
                }
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to post availability');
            }
        } catch (error) {
            alert('Failed to post availability');
        }
    }

    async handlePostPaidAvailability(e) {
        e.preventDefault();
        const day = document.getElementById('paid-day-select').value;
        const date = document.getElementById('paid-match-date').value;
        const bet_amount = 'contact the opposite captain';
        const time_slot = document.getElementById('paid-time-slot').value;
        const ground = document.getElementById('paid-ground').value;

        try {
            const response = await fetch('/api/availability/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ day, date, bet_amount, time_slot, ground, ground_type: 'paid' })
            });

            const result = await response.json();
            if (response.ok) {
                document.getElementById('paid-availability-form').reset();
                this.loadMatches();
                this.loadOpenRequests();
                this.loadPaidOpenRequests();
                
                if (result.matched) {
                    alert(`🎉 ${result.message}\n\nMatch Details:\n📅 Day: ${result.match.day}\n💰 Bet: ₹${result.match.bet_amount}\n📍 Ground: ${result.match.ground}\n\n⏰ Please confirm the match in 'My Matches' section!\n💬 You can now chat with the opponent captain!`);
                } else {
                    alert(result.message);
                }
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to post paid availability');
            }
        } catch (error) {
            alert('Failed to post paid availability');
        }
    }

    async handleMatchAction(matchId, action) {
        try {
            const response = await fetch('/api/match/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ match_id: matchId, decision: action })
            });

            if (response.ok) {
                this.loadMatches();
            } else {
                alert('Failed to update match');
            }
        } catch (error) {
            alert('Failed to update match');
        }
    }

    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        
        // Clear any existing user data display
        document.getElementById('user-name').textContent = '';
    }

    showDashboard() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-name').textContent = `${this.user.name} (${this.user.role})`;
    }



    async loadDashboardData() {
        await Promise.all([
            this.loadUserTeam(),
            this.loadMatches(),
            this.loadOpenRequests(),
            this.loadPaidOpenRequests()
        ]);
    }

    async loadUserTeam() {
        try {
            const response = await fetch('/api/user/team', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();
            
            this.renderUserTeam(data);
        } catch (error) {
            console.error('Failed to load user team');
        }
    }



    async loadMatches() {
        try {
            const response = await fetch('/api/matches', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const matches = await response.json();
            this.renderMatches(matches);
        } catch (error) {
            console.error('Failed to load matches');
        }
    }



    async loadOpenRequests() {
        try {
            const response = await fetch('/api/availability/open?ground_type=free');
            const requests = await response.json();
            this.renderOpenRequests(requests);
        } catch (error) {
            console.error('Failed to load open requests');
        }
    }

    async loadPaidOpenRequests() {
        try {
            const response = await fetch('/api/availability/open?ground_type=paid');
            const requests = await response.json();
            this.renderPaidOpenRequests(requests);
        } catch (error) {
            console.error('Failed to load paid open requests');
        }
    }

    renderUserTeam(data) {
        const container = document.getElementById('teams-list');
        const availabilityCardsContainer = document.getElementById('availability-cards-container');
        
        container.innerHTML = `Team: ${data.team.name} | Ground: ${data.team.ground || 'Not set'}`;
        
        // Show the availability cards container with smooth transition
        availabilityCardsContainer.style.display = 'flex';
        
        // Trigger animation after display change
        setTimeout(() => {
            availabilityCardsContainer.style.opacity = '1';
            availabilityCardsContainer.style.transform = 'translateY(0)';
        }, 50);
        
        // Pre-fill ground if team has default ground
        if (data.team.ground) {
            document.getElementById('ground').placeholder = `Default: ${data.team.ground}`;
        }
    }



    renderMatches(matches) {
        const container = document.getElementById('matches-list');
        const matchesCard = document.querySelector('.matches-card');
        const dynamicLayout = document.querySelector('.dynamic-layout');
        const availabilityContainer = document.getElementById('availability-cards-container');
        
        if (matches.length === 0) {
            container.innerHTML = '';
            matchesCard.classList.add('empty-matches');
            dynamicLayout.classList.remove('has-matches');
            dynamicLayout.classList.add('no-matches');
            availabilityContainer.classList.remove('slide-up');
            return;
        }
        
        // Add dynamic classes for layout optimization
        matchesCard.classList.remove('empty-matches');
        dynamicLayout.classList.add('has-matches');
        dynamicLayout.classList.remove('no-matches');
        availabilityContainer.classList.add('slide-up');

        // Sort matches by date (earliest first), then by creation time
        matches.sort((a, b) => {
            // If both have dates, sort by date
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            // If only one has date, prioritize the one with date
            if (a.date && !b.date) return -1;
            if (!a.date && b.date) return 1;
            // If neither has date, sort by creation time (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        });

        container.innerHTML = matches.map(match => {
            const isMyMatch = match.captain1_id === this.user.id || match.captain2_id === this.user.id;
            const needsConfirmation = match.status === 'proposed' && isMyMatch;
            const myConfirmation = match.captain1_id === this.user.id ? match.captain1_confirmed : match.captain2_confirmed;
            
            // Contact details and chat for matched teams (proposed or confirmed)
            let contactInfo = '';
            let chatButton = '';
            if ((match.status === 'proposed' || match.status === 'confirmed') && isMyMatch) {
                // Show chat button for all matched teams
                chatButton = `
                    <button class="chat-btn" onclick="app.openChat('${match.id}', '${match.team1_name} vs ${match.team2_name}')">💬 Chat with Opponent</button>
                `;
                
                // Show contact info for proposed and confirmed matches
                if (match.opponent_contact) {
                    contactInfo = `
                        <div class="contact-info">
                            <strong>🏏 Opponent Captain Contact:</strong>
                            <br>📞 ${match.opponent_contact.name}: ${match.opponent_contact.phone}
                            <br><small>💬 Use chat below or contact directly!</small>
                        </div>
                    `;
                }
            }
            
            return `
                <div class="match-item ${match.status}">
                    <strong>${match.team1_name} vs ${match.team2_name}</strong>
                    <br>Day: ${match.day}${match.date ? ` (${this.formatDate(match.date)})` : ''} | Bet: ₹${match.bet_amount}
                    ${match.ground ? `<br>Ground: ${match.ground}` : ''}
                    <br>Status: ${match.status.toUpperCase()}
                    ${contactInfo}
                    ${needsConfirmation && !myConfirmation ? `
                        <div class="match-buttons">
                            <button class="confirm-btn" onclick="app.handleMatchAction('${match.id}', 'confirm')">Confirm</button>
                            <button class="decline-btn" onclick="app.handleMatchAction('${match.id}', 'decline')">Decline</button>
                        </div>
                    ` : ''}
                    ${chatButton}
                </div>
            `;
        }).join('');
        
        // Add smooth animation to new match items
        setTimeout(() => {
            const matchItems = container.querySelectorAll('.match-item');
            matchItems.forEach((item, index) => {
                item.style.animationDelay = `${index * 0.1}s`;
            });
        }, 50);
    }



    renderOpenRequests(requests) {
        const container = document.getElementById('open-requests');
        const dynamicLayout = document.querySelector('.dynamic-layout');
        
        if (requests.length === 0) {
            container.innerHTML = '<p>No open requests available.</p>';
            return;
        }
        
        // Add compact layout class if minimal content
        if (requests.length <= 2) {
            dynamicLayout.classList.add('compact-layout');
        } else {
            dynamicLayout.classList.remove('compact-layout');
        }

        container.innerHTML = requests.map(request => `
            <div class="request-item">
                <strong>${request.team_name}</strong> by ${request.captain_name}
                <br>Day: ${request.day}${request.date ? ` (${this.formatDate(request.date)})` : ''} | Bet: ₹${request.bet_amount}
                ${request.time_slot ? `<br>Time: ${request.time_slot}` : ''}
                ${request.ground ? `<br>Ground: ${request.ground}` : ''}
                ${request.captain_phone ? `<br>📞 Contact: ${request.captain_phone}` : ''}
                <br><small>Posted: ${new Date(request.created_at).toLocaleDateString()}</small>
            </div>
        `).join('');
    }

    renderPaidOpenRequests(requests) {
        const container = document.getElementById('paid-open-requests');
        
        if (requests.length === 0) {
            container.innerHTML = '<p>No paid ground requests available.</p>';
            return;
        }

        container.innerHTML = requests.map(request => `
            <div class="request-item paid-request">
                <strong>${request.team_name}</strong> by ${request.captain_name}
                <br>Day: ${request.day}${request.date ? ` (${this.formatDate(request.date)})` : ''} | Bet: ₹${request.bet_amount}
                ${request.time_slot ? `<br>Time: ${request.time_slot}` : ''}
                <br>Ground: ${request.ground}
                ${request.captain_phone ? `<br>📞 Contact: ${request.captain_phone}` : ''}
                <br><small>Posted: ${new Date(request.created_at).toLocaleDateString()}</small>
            </div>
        `).join('');
    }



    // Chat functionality
    openChat(matchId, matchTitle) {
        this.currentMatchId = matchId;
        document.getElementById('chat-title').textContent = `Chat: ${matchTitle}`;
        document.getElementById('chat-modal').classList.remove('hidden');
        this.loadChatMessages();
        
        // Auto-refresh messages every 3 seconds while chat is open
        this.chatInterval = setInterval(() => {
            if (this.currentMatchId === matchId) {
                this.loadChatMessages();
            }
        }, 3000);
    }

    closeChatModal() {
        document.getElementById('chat-modal').classList.add('hidden');
        this.currentMatchId = null;
        
        // Clear auto-refresh interval
        if (this.chatInterval) {
            clearInterval(this.chatInterval);
            this.chatInterval = null;
        }
    }

    async loadChatMessages() {
        if (!this.currentMatchId) return;
        
        try {
            const response = await fetch(`/api/chat/${this.currentMatchId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const messages = await response.json();
            this.renderChatMessages(messages);
        } catch (error) {
            console.error('Failed to load chat messages');
        }
    }

    renderChatMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (messages.length === 0) {
            container.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!<br><small>Discuss match details, timing, ground preferences, etc.</small></p>';
            return;
        }

        const currentScrollTop = container.scrollTop;
        const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 1;

        container.innerHTML = messages.map(msg => {
            const isMyMessage = msg.sender_id === this.user.id;
            const timeStr = new Date(msg.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `
                <div class="message ${isMyMessage ? 'my-message' : 'other-message'}">
                    <div class="message-header">
                        <strong>${isMyMessage ? 'You' : msg.sender_name}</strong>
                        <span class="timestamp">${timeStr}</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(msg.message)}</div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom only if user was already at bottom or it's a new message
        if (isScrolledToBottom || messages.length === 1) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || !this.currentMatchId) return;
        
        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ 
                    match_id: this.currentMatchId, 
                    message 
                })
            });
            
            if (response.ok) {
                input.value = '';
                this.loadChatMessages();
            } else {
                alert('Failed to send message');
            }
        } catch (error) {
            alert('Failed to send message');
        }
    }



    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
}

// Initialize app
const app = new CricketScheduler();