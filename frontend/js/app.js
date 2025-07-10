class RPSGame {
    constructor() {
        this.user = null;
        this.websocket = null;
        this.currentGame = null;
        this.apiUrl = 'YOUR_API_GATEWAY_URL'; // Will be replaced with actual URL
        this.wsUrl = 'YOUR_WEBSOCKET_URL'; // Will be replaced with actual URL
        
        this.initializeEventListeners();
        this.showScreen('login-screen');
    }

    initializeEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Main menu buttons
        document.getElementById('find-game-btn').addEventListener('click', () => this.findGame());
        document.getElementById('stats-btn').addEventListener('click', () => this.showStats());
        document.getElementById('leaderboard-btn').addEventListener('click', () => this.showLeaderboard());

        // Game buttons
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.makeMove(e.target.dataset.move));
        });

        // Navigation buttons
        document.getElementById('play-again-btn').addEventListener('click', () => this.findGame());
        document.getElementById('main-menu-btn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => this.showMainMenu());
        document.getElementById('back-to-menu-btn-2').addEventListener('click', () => this.showMainMenu());
        document.getElementById('cancel-search-btn').addEventListener('click', () => this.cancelSearch());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    async login() {
        const username = document.getElementById('username-input').value.trim();
        if (!username) return;

        try {
            // Simplified login - in production, use proper authentication
            this.user = {
                userId: 'user_' + Date.now(),
                username: username
            };

            document.getElementById('username').textContent = username;
            document.getElementById('user-info').classList.remove('hidden');
            
            this.showMainMenu();
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please try again.');
        }
    }

    logout() {
        this.user = null;
        this.disconnectWebSocket();
        document.getElementById('user-info').classList.add('hidden');
        document.getElementById('username-input').value = '';
        this.showScreen('login-screen');
    }

    showMainMenu() {
        this.disconnectWebSocket();
        this.showScreen('main-menu');
    }

    async findGame() {
        this.showScreen('waiting-screen');
        this.connectWebSocket();
    }

    cancelSearch() {
        this.disconnectWebSocket();
        this.showMainMenu();
    }

    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        // For demo purposes, simulate WebSocket connection
        // In production, use actual WebSocket URL
        this.simulateWebSocketConnection();
    }

    simulateWebSocketConnection() {
        // Simulate finding a game after 2-3 seconds
        setTimeout(() => {
            this.onGameFound({
                gameId: 'game_' + Date.now(),
                opponent: 'Player_' + Math.floor(Math.random() * 1000)
            });
        }, 2000 + Math.random() * 1000);
    }

    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }

    onGameFound(data) {
        this.currentGame = data;
        document.getElementById('opponent-name').textContent = data.opponent;
        this.showScreen('game-screen');
    }

    makeMove(move) {
        if (!this.currentGame) return;

        // Simulate opponent move and game result
        const moves = ['rock', 'paper', 'scissors'];
        const opponentMove = moves[Math.floor(Math.random() * 3)];
        
        const result = this.determineWinner(move, opponentMove);
        
        this.showResult({
            yourMove: move,
            opponentMove: opponentMove,
            result: result
        });
    }

    determineWinner(playerMove, opponentMove) {
        if (playerMove === opponentMove) return 'draw';
        
        const winConditions = {
            rock: 'scissors',
            paper: 'rock',
            scissors: 'paper'
        };
        
        return winConditions[playerMove] === opponentMove ? 'win' : 'lose';
    }

    showResult(gameResult) {
        const { yourMove, opponentMove, result } = gameResult;
        
        document.getElementById('your-move').textContent = this.getMoveEmoji(yourMove);
        document.getElementById('opponent-move').textContent = this.getMoveEmoji(opponentMove);
        
        const resultTitle = document.getElementById('result-title');
        if (result === 'win') {
            resultTitle.textContent = '🎉 You Win!';
            resultTitle.style.color = '#28a745';
        } else if (result === 'lose') {
            resultTitle.textContent = '😔 You Lose!';
            resultTitle.style.color = '#dc3545';
        } else {
            resultTitle.textContent = '🤝 It\'s a Draw!';
            resultTitle.style.color = '#ffc107';
        }
        
        this.showScreen('result-screen');
    }

    getMoveEmoji(move) {
        const emojis = {
            rock: '🪨 Rock',
            paper: '📄 Paper',
            scissors: '✂️ Scissors'
        };
        return emojis[move] || move;
    }

    async showStats() {
        // Simulate stats data
        const stats = {
            totalGames: Math.floor(Math.random() * 50),
            wins: Math.floor(Math.random() * 30),
            losses: Math.floor(Math.random() * 15),
            draws: Math.floor(Math.random() * 5)
        };

        document.getElementById('total-games').textContent = stats.totalGames;
        document.getElementById('wins').textContent = stats.wins;
        document.getElementById('losses').textContent = stats.losses;
        document.getElementById('draws').textContent = stats.draws;

        this.showScreen('stats-screen');
    }

    async showLeaderboard() {
        // Simulate leaderboard data
        const leaderboard = [
            { username: 'RockMaster', wins: 45 },
            { username: 'PaperChamp', wins: 38 },
            { username: 'ScissorsPro', wins: 32 },
            { username: 'GameWinner', wins: 28 },
            { username: 'RPSKing', wins: 25 }
        ];

        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';

        leaderboard.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span>${player.username}</span>
                <span>${player.wins} wins</span>
            `;
            leaderboardList.appendChild(item);
        });

        this.showScreen('leaderboard-screen');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RPSGame();
});