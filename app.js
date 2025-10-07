class CricketScheduler {
    constructor() {
        // Automatically use the correct API base URL for both local and production
        this.apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://cricket-matches-scheduler.onrender.com';
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
        
        // Custom ground toggle for paid ground
        document.getElementById('paid-ground').addEventListener('change', (e) => this.toggleCustomGround(e));

        // Chat events
        document.getElementById('close-chat').addEventListener('click', () => this.closeChatModal());
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    bindDynamicEvents() {
        document.querySelectorAll('.chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const matchId = e.target.getAttribute('data-match-id');
                const matchTitle = e.target.getAttribute('data-match-title');
                if (matchId && matchTitle) {
                    this.openChat(matchId, matchTitle);
                }
            });
        });

        document.querySelectorAll('.confirm-btn, .decline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const matchId = e.target.getAttribute('data-match-id');
                const action = e.target.getAttribute('data-action');
                if (matchId && action) {
                    this.handleMatchAction(matchId, action);
                }
            });
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!phone) {
            alert('Please enter your mobile number');
            document.getElementById('login-phone').focus();
            return;
        }
        if (!password) {
            alert('Please enter your password');
            document.getElementById('login-password').focus();
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBase}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
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
                if (data.error && data.error.includes('not found')) {
                    alert('📱 Mobile number not found.\n\nPlease use the Sign Up form to create a new account.');
                } else if (data.error && data.error.includes('password')) {
                    alert('🔒 Incorrect password.\n\nPlease check your password and try again.');
                } else {
                    alert(data.error || 'Login failed. Please try again.');
                }
            }
        } catch (error) {
            alert('⚠️ Network error. Please check your connection and try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const role = document.getElementById('signup-role').value;

        if (!name) {
            alert('Please enter your name');
            document.getElementById('signup-name').focus();
            return;
        }
        if (!phone) {
            alert('Please enter your mobile number');
            document.getElementById('signup-phone').focus();
            return;
        }
        if (!password) {
            alert('Please enter a password');
            document.getElementById('signup-password').focus();
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${this.apiBase}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, password, role })
            });

            const data = await response.json();
            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                document.getElementById('signup-form').reset();
                alert(`🎉 Welcome ${data.user.name}!\n\nYour account has been created successfully.\n\nYou can now start posting availability and finding matches!`);
                this.showDashboard();
                this.loadDashboardData();
            } else {
                if (data.error && data.error.includes('already exists')) {
                    alert('📱 This mobile number is already registered.\n\nPlease use the Login form instead or try a different number.');
                } else {
                    alert(data.error || 'Signup failed. Please try again.');
                }
            }
        } catch (error) {
            alert('⚠️ Network error. Please check your connection and try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    handleLogout() {
        this.token = null;
        this.user = {};
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        document.getElementById('login-form').reset();
        document.getElementById('signup-form').reset();
        if (document.getElementById('availability-form')) {
            document.getElementById('availability-form').reset();
        }
        
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

    toggleCustomGround(e) {
        const customGroup = document.getElementById('custom-ground-group');
        if (e.target.value === 'custom') {
            customGroup.style.display = 'block';
            document.getElementById('custom-ground-name').required = true;
        } else {
            customGroup.style.display = 'none';
            document.getElementById('custom-ground-name').required = false;
        }
    }

    async handlePostAvailability(e) {
        e.preventDefault();
        const team_name = document.getElementById('team-name').value.trim();
        const day = document.getElementById('day-select').value;
        const date = document.getElementById('match-date').value;
        let bet_amount = document.getElementById('bet-amount').value;
        const time_slot = document.getElementById('time-slot').value;
        const ground = document.getElementById('ground').value;
        
        if (!day) {
            alert('Please select a day');
            return;
        }
        if (!bet_amount) {
            alert('Please select bet amount');
            return;
        }
        
        if (bet_amount === 'custom') {
            const customAmount = document.getElementById('custom-bet-amount').value.trim();
            if (!customAmount) {
                alert('Please enter custom bet amount');
                return;
            }
            bet_amount = customAmount;
        }

        console.log('Posting availability:', { team_name, day, date, bet_amount, time_slot, ground, ground_type: 'free' });
        console.log('Token:', this.token ? 'Present' : 'Missing');

        try {
            const response = await fetch(`${this.apiBase}/api/availability/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ team_name, day, date, bet_amount, time_slot, ground, ground_type: 'free' })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            const result = await response.json();
            console.log('Response data:', result);
            
            if (response.ok) {
                document.getElementById('availability-form').reset();
                await this.loadMatches();
                await this.loadOpenRequests();
                await this.loadPaidOpenRequests();
                
                if (result.matched) {
                    alert(`🎉 ${result.message}\n\nMatch Details:\n📅 Day: ${result.match.day}\n💰 Bet: ₹${result.match.bet_amount}\n📍 Ground: ${result.match.ground || 'TBD'}\n\n⏰ Please confirm the match in 'My Matches' section!\n💬 You can now chat with the opponent captain!`);
                } else {
                    alert(result.message);
                }
                
                setTimeout(() => {
                    this.loadOpenRequests();
                }, 500);
            } else {
                console.error('Server error:', result);
                alert(result.error || 'Failed to post availability');
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('Network error: ' + error.message);
        }
    }

    async handlePostPaidAvailability(e) {
        e.preventDefault();
        const team_name = document.getElementById('paid-team-name').value.trim();
        const day = document.getElementById('paid-day-select').value;
        const date = document.getElementById('paid-match-date').value;
        const bet_amount = 'contact the opposite captain';
        const time_slot = document.getElementById('paid-time-slot').value;
        let ground = document.getElementById('paid-ground').value;

        if (!day) {
            alert('Please select a day');
            return;
        }
        if (!ground) {
            alert('Please select a ground');
            return;
        }

        if (ground === 'custom') {
            const customGround = document.getElementById('custom-ground-name').value.trim();
            if (!customGround) {
                alert('Please enter custom ground name');
                return;
            }
            ground = customGround;
        }

        console.log('Posting paid availability:', { team_name, day, date, bet_amount, time_slot, ground, ground_type: 'paid' });

        try {
            const response = await fetch(`${this.apiBase}/api/availability/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ team_name, day, date, bet_amount, time_slot, ground, ground_type: 'paid' })
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response data:', result);
            
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
                console.error('Server error:', result);
                alert(result.error || 'Failed to post paid availability');
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('Network error: ' + error.message);
        }
    }

    async handleMatchAction(matchId, action) {
        try {
            const response = await fetch(`${this.apiBase}/api/match/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ match_id: matchId, decision: action })
            });

            const result = await response.json();
            
            if (response.ok) {
                if (action === 'confirm') {
                    alert('✅ Match accepted! The opponent will be notified.\n\n💬 You can now chat with the opponent captain to finalize details.');
                } else {
                    alert('❌ Match declined. The availability posts have been reopened for new matches.');
                }
                
                await this.loadMatches();
                await this.loadOpenRequests();
                await this.loadPaidOpenRequests();
            } else {
                alert('Failed to update match: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Match action error:', error);
            alert('Failed to update match. Please try again.');
        }
    }

    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
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
            const response = await fetch(`${this.apiBase}/api/user/team`, {
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
            const response = await fetch(`${this.apiBase}/api/matches`, {
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
            console.log('Loading open requests...');
            const response = await fetch(`${this.apiBase}/api/availability/open?ground_type=free`);
            console.log('Open requests response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Server returned non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON. Please check if server is running properly.');
            }
            
            const requests = await response.json();
            console.log('Open requests data received:', requests);
            console.log('Number of requests:', requests.length);
            this.renderOpenRequests(requests);
        } catch (error) {
            console.error('Failed to load open requests:', error);
            const container = document.getElementById('open-requests');
            if (error.message.includes('JSON')) {
                container.innerHTML = '<p style="color: red;">Server error: Received HTML instead of data. Please check if the server is running properly.</p>';
            } else {
                container.innerHTML = '<p style="color: red;">Error loading requests. Please refresh the page.</p>';
            }
        }
    }

    async loadPaidOpenRequests() {
        try {
            const response = await fetch(`${this.apiBase}/api/availability/open?ground_type=paid`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned HTML instead of JSON');
            }
            const requests = await response.json();
            this.renderPaidOpenRequests(requests);
        } catch (error) {
            console.error('Failed to load paid open requests:', error);
            const container = document.getElementById('paid-open-requests');
            container.innerHTML = '<p style="color: red;">Error loading paid requests.</p>';
        }
    }

    renderUserTeam(data) {
        const container = document.getElementById('teams-list');
        const availabilityCardsContainer = document.getElementById('availability-cards-container');
        
        if (data.hasTeam && data.team) {
            container.innerHTML = `Team: ${data.team.name} | Ground: ${data.team.ground || 'Not set'}`;
            if (data.team.ground) {
                document.getElementById('ground').placeholder = `Default: ${data.team.ground}`;
            }
        } else {
            container.innerHTML = 'No team yet - will be created when you post availability';
        }
        
        availabilityCardsContainer.style.display = 'flex';
        setTimeout(() => {
            availabilityCardsContainer.style.opacity = '1';
            availabilityCardsContainer.style.transform = 'translateY(0)';
        }, 50);
    }

    renderMatches(matches) {
        const container = document.getElementById('matches-list');
        const matchesCard = document.querySelector('.matches-card');
        const dynamicLayout = document.querySelector('.dynamic-layout');
        const availabilityContainer = document.getElementById('availability-cards-container');
        
        if (matches.length === 0) {
            container.innerHTML = '<p>No matches yet. Post availability to find opponents!</p>';
            if (matchesCard) matchesCard.classList.add('empty-matches');
            if (dynamicLayout) {
                dynamicLayout.classList.remove('has-matches');
                dynamicLayout.classList.add('no-matches');
            }
            if (availabilityContainer) availabilityContainer.classList.remove('slide-up');
            return;
        }
        
        if (matchesCard) matchesCard.classList.remove('empty-matches');
        if (dynamicLayout) {
            dynamicLayout.classList.add('has-matches');
            dynamicLayout.classList.remove('no-matches');
        }
        if (availabilityContainer) availabilityContainer.classList.add('slide-up');

        matches.sort((a, b) => {
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            if (a.date && !b.date) return -1;
            if (!a.date && b.date) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        container.innerHTML = matches.map(match => {
            const isMyMatch = match.captain1_id === this.user.id || match.captain2_id === this.user.id;
            const needsConfirmation = match.status === 'proposed' && isMyMatch;
            const myConfirmation = match.captain1_id === this.user.id ? match.captain1_confirmed : match.captain2_confirmed;
            const otherConfirmation = match.captain1_id === this.user.id ? match.captain2_confirmed : match.captain1_confirmed;
            
            let statusDisplay = match.status.toUpperCase();
            if (match.status === 'proposed') {
                if (myConfirmation && otherConfirmation) {
                    statusDisplay = 'CONFIRMED';
                } else if (myConfirmation) {
                    statusDisplay = 'WAITING FOR OPPONENT CONFIRMATION';
                } else if (otherConfirmation) {
                    statusDisplay = 'OPPONENT CONFIRMED - YOUR TURN';
                } else {
                    statusDisplay = 'PENDING CONFIRMATION';
                }
            }
            
            let contactInfo = '';
            let chatButton = '';
            if ((match.status === 'proposed' || match.status === 'confirmed') && isMyMatch) {
                chatButton = `
                    <button class="chat-btn" data-match-id="${match.id}" data-match-title="${match.team1_name} vs ${match.team2_name}">💬 Chat with Opponent</button>
                `;
                if (match.opponent_contact) {
                    contactInfo = `
                        <div class="contact-info">
                            <strong>🏏 Opponent Captain:</strong>
                            <br>📞 ${match.opponent_contact.name}: ${match.opponent_contact.phone}
                            <br><small>💬 Use chat below or contact directly!</small>
                        </div>
                    `;
                }
            }
            
            return `
                <div class="match-item ${match.status}">
                    <strong>${match.team1_name} vs ${match.team2_name}</strong>
                    <br>📅 Day: ${match.day}${match.date ? ` (${this.formatDate(match.date)})` : ''} | 💰 Bet: ₹${match.bet_amount}
                    ${match.ground ? `<br>📍 Ground: ${match.ground}` : ''}
                    <br>📊 Status: ${statusDisplay}
                    ${contactInfo}
                    ${needsConfirmation && !myConfirmation ? `
                        <div class="match-buttons">
                            <button class="confirm-btn" data-match-id="${match.id}" data-action="confirm">✅ Accept Match</button>
                            <button class="decline-btn" data-match-id="${match.id}" data-action="decline">❌ Decline Match</button>
                        </div>
                    ` : ''}
                    ${chatButton}
                </div>
            `;
        }).join('');
        
        this.bindDynamicEvents();

        setTimeout(() => {
            const matchItems = container.querySelectorAll('.match-item');
            matchItems.forEach((item, index) => {
                item.style.animationDelay = `${index * 0.1}s`;
            });
        }, 50);
    }

    renderOpenRequests(requests) {
        const container = document.getElementById('open-requests');
        console.log('Rendering open requests:', requests.length, 'requests');
        console.log('Requests data:', requests);
        
        if (!requests || requests.length === 0) {
            container.innerHTML = '<p>No open requests available.</p>';
            console.log('No requests to display');
            return;
        }
        
        try {
            container.innerHTML = requests.map(request => {
                console.log('Rendering request:', request);
                return `
                    <div class="request-item">
                        <strong>${request.team_name || 'Unknown Team'}</strong> by ${request.captain_name || 'Unknown Captain'}
                        <br>Day: ${request.day}${request.date ? ` (${this.formatDate(request.date)})` : ''} | Bet: ₹${request.bet_amount}
                        ${request.time_slot ? `<br>Time: ${request.time_slot}` : ''}
                        ${request.ground ? `<br>Ground: ${request.ground}` : ''}
                        ${request.captain_phone ? `<br>📞 Contact: ${request.captain_phone}` : ''}
                        <br><small>Posted: ${new Date(request.created_at).toLocaleDateString()}</small>
                    </div>
                `;
            }).join('');
            console.log('Successfully rendered', requests.length, 'requests');
        } catch (error) {
            console.error('Error rendering requests:', error);
            container.innerHTML = '<p>Error loading requests. Please refresh the page.</p>';
        }
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

    openChat(matchId, matchTitle) {
        console.log('Opening chat for match:', matchId, 'Title:', matchTitle);
        
        if (!matchId || !matchTitle) {
            console.error('Invalid match ID or title for chat');
            alert('Error opening chat. Please try again.');
            return;
        }
        
        if (this.chatInterval) {
            clearInterval(this.chatInterval);
        }
        
        this.currentMatchId = matchId;
        const chatTitle = document.getElementById('chat-title');
        const chatModal = document.getElementById('chat-modal');
        
        if (!chatTitle || !chatModal) {
            console.error('Chat modal elements not found');
            alert('Chat interface not available. Please refresh the page.');
            return;
        }
        
        chatTitle.textContent = `Chat: ${matchTitle}`;
        chatModal.classList.remove('hidden');
        
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<p style="text-align: center; color: #666;">Loading messages...</p>';
        }
        
        this.loadChatMessages();
        
        setTimeout(() => {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.focus();
            }
        }, 100);

        this.chatInterval = setInterval(() => {
            if (this.currentMatchId === matchId) {
                this.loadChatMessages();
            }
        }, 3000);

        console.log('Chat opened successfully');
    }

    closeChatModal() {
        console.log('Closing chat modal');
        
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            chatModal.classList.add('hidden');
        }
        
        this.currentMatchId = null;
        
        if (this.chatInterval) {
            clearInterval(this.chatInterval);
            this.chatInterval = null;
        }
        
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.value = '';
        }
        
        console.log('Chat modal closed');
    }

    async loadChatMessages() {
        if (!this.currentMatchId) return;
        
        try {
            const response = await fetch(`${this.apiBase}/api/chat/${this.currentMatchId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messages = await response.json();
            this.renderChatMessages(messages);
        } catch (error) {
            console.error('Failed to load chat messages:', error);
            const container = document.getElementById('chat-messages');
            if (container) {
                container.innerHTML = '<p class="error-message" style="color: red; text-align: center;">Failed to load messages. Please try again.</p>';
            }
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
        
        if (isScrolledToBottom || messages.length === 1) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-message');
        const message = input.value.trim();
        
        if (!message || !this.currentMatchId) {
            if (!message) {
                input.focus();
            }
            return;
        }
        
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        
        try {
            const response = await fetch(`${this.apiBase}/api/chat/send`, {
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
                await this.loadChatMessages();
                input.focus();
            } else {
                const errorData = await response.json();
                alert('Failed to send message: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Send message error:', error);
            alert('Failed to send message. Please check your connection.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
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


