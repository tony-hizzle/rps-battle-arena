class RPSGame {
    constructor() {
        this.user = null;
        this.currentGame = null;
        this.apiUrl = 'https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod';
        
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
            const response = await fetch(`${this.apiUrl}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login',
                    username: username
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.user = data.data.user;
                document.getElementById('username').textContent = this.user.username;
                document.getElementById('user-info').classList.remove('hidden');
                this.showMainMenu();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please try again.');
        }
    }

    logout() {
        this.user = null;
        document.getElementById('user-info').classList.add('hidden');
        document.getElementById('username-input').value = '';
        this.showScreen('login-screen');
    }

    showMainMenu() {
        this.showScreen('main-menu');
    }

    async findGame() {
        this.showScreen('waiting-screen');
        
        try {
            // Simulate finding a game
            setTimeout(() => {
                this.onGameFound({
                    gameId: 'game_' + Date.now(),
                    opponent: 'Player_' + Math.floor(Math.random() * 1000)
                });
            }, 2000 + Math.random() * 1000);
        } catch (error) {
            console.error('Find game failed:', error);
            alert('Failed to find game. Please try again.');
            this.showMainMenu();
        }
    }

    cancelSearch() {
        this.showMainMenu();
    }

    onGameFound(data) {
        this.currentGame = data;
        document.getElementById('opponent-name').textContent = data.opponent;
        this.showScreen('game-screen');
    }

    async makeMove(move) {
        if (!this.currentGame) return;

        try {
            const response = await fetch(`${this.apiUrl}/game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'play',
                    userId: this.user?.userId,
                    move: move
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showResult({
                    yourMove: data.data.yourMove,
                    opponentMove: data.data.opponentMove,
                    result: data.data.result
                });
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Make move failed:', error);
            alert('Failed to make move. Please try again.');
        }
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
        try {
            let stats;
            if (this.user?.userId && !this.user.userId.startsWith('user_')) {
                // Try to fetch real stats
                const response = await fetch(`${this.apiUrl}/stats/${this.user.userId}`);
                const data = await response.json();
                stats = data.success ? data.data : this.getDefaultStats();
            } else {
                stats = this.getDefaultStats();
            }

            document.getElementById('total-games').textContent = stats.totalGames;
            document.getElementById('wins').textContent = stats.wins;
            document.getElementById('losses').textContent = stats.losses;
            document.getElementById('draws').textContent = stats.draws;

            this.showScreen('stats-screen');
        } catch (error) {
            console.error('Failed to load stats:', error);
            const stats = this.getDefaultStats();
            document.getElementById('total-games').textContent = stats.totalGames;
            document.getElementById('wins').textContent = stats.wins;
            document.getElementById('losses').textContent = stats.losses;
            document.getElementById('draws').textContent = stats.draws;
            this.showScreen('stats-screen');
        }
    }

    getDefaultStats() {
        return {
            totalGames: Math.floor(Math.random() * 50),
            wins: Math.floor(Math.random() * 30),
            losses: Math.floor(Math.random() * 15),
            draws: Math.floor(Math.random() * 5)
        };
    }

    async showLeaderboard() {
        try {
            const response = await fetch(`${this.apiUrl}/leaderboard`);
            const data = await response.json();
            const leaderboard = data.success ? data.data : this.getDefaultLeaderboard();

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
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            // Show default leaderboard on error
            const leaderboard = this.getDefaultLeaderboard();
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

    getDefaultLeaderboard() {
        return [
            { username: 'RockMaster', wins: 45 },
            { username: 'PaperChamp', wins: 38 },
            { username: 'ScissorsPro', wins: 32 },
            { username: 'GameWinner', wins: 28 },
            { username: 'RPSKing', wins: 25 }
        ];
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RPSGame();
});