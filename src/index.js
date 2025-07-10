const { success, error } = require('./shared/response');
const { createUser, getUser, updateUserStats } = require('./utils/db');
const { determineWinner, isValidMove } = require('./utils/gameLogic');

exports.handler = async (event) => {
    try {
        console.log('Event:', JSON.stringify(event, null, 2));
        
        const { httpMethod, path, body } = event;
        const requestBody = body ? JSON.parse(body) : {};
        
        // Authentication endpoints
        if (httpMethod === 'POST' && path === '/auth') {
            const { action, username, email } = requestBody;
            
            if (action === 'register') {
                if (!username || !email) {
                    return error('Username and email are required');
                }
                
                const user = await createUser({ username, email });
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'login') {
                if (!username) {
                    return error('Username is required');
                }
                
                return success({ user: { userId: 'user_' + Date.now(), username } });
            }
        }
        
        // Stats endpoint
        if (httpMethod === 'GET' && path.startsWith('/stats/')) {
            const userId = path.split('/')[2];
            const user = await getUser(userId);
            
            if (!user) {
                return error('User not found', 404);
            }
            
            return success({
                userId: user.userId,
                username: user.username,
                totalGames: user.totalGames || 0,
                wins: user.wins || 0,
                losses: user.losses || 0,
                draws: user.draws || 0
            });
        }
        
        // Leaderboard endpoint
        if (httpMethod === 'GET' && path === '/leaderboard') {
            // Simulate leaderboard data
            const leaderboard = [
                { username: 'RockMaster', wins: 45, totalGames: 60 },
                { username: 'PaperChamp', wins: 38, totalGames: 50 },
                { username: 'ScissorsPro', wins: 32, totalGames: 45 },
                { username: 'GameWinner', wins: 28, totalGames: 40 },
                { username: 'RPSKing', wins: 25, totalGames: 35 }
            ];
            
            return success(leaderboard);
        }
        
        // Game endpoint (simplified multiplayer)
        if (httpMethod === 'POST' && path === '/game') {
            const { action, userId, move } = requestBody;
            
            if (action === 'play') {
                if (!isValidMove(move)) {
                    return error('Invalid move');
                }
                
                // Simulate opponent move
                const moves = ['rock', 'paper', 'scissors'];
                const opponentMove = moves[Math.floor(Math.random() * 3)];
                
                const result = determineWinner(move, opponentMove);
                let gameResult;
                
                if (result === 'draw') {
                    gameResult = 'draw';
                } else if (result === 'player1') {
                    gameResult = 'win';
                } else {
                    gameResult = 'lose';
                }
                
                // Update user stats if userId provided
                if (userId) {
                    try {
                        await updateUserStats(userId, gameResult === 'win' ? 'wins' : gameResult === 'lose' ? 'losses' : 'draws');
                    } catch (err) {
                        console.log('Stats update failed:', err);
                    }
                }
                
                return success({
                    gameId: 'game_' + Date.now(),
                    yourMove: move,
                    opponentMove: opponentMove,
                    result: gameResult,
                    opponent: 'Player_' + Math.floor(Math.random() * 1000)
                });
            }
            
            if (action === 'find_game') {
                // Simulate finding a game
                return success({
                    gameId: 'game_' + Date.now(),
                    opponent: 'Player_' + Math.floor(Math.random() * 1000),
                    status: 'found'
                });
            }
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Handler error:', err);
        return error('Internal server error', 500);
    }
};