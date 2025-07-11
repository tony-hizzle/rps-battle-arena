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
                
                // Check if user already exists
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                const existingUser = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    FilterExpression: 'username = :username',
                    ExpressionAttributeValues: { ':username': username }
                }).promise();
                
                if (existingUser.Items.length > 0) {
                    return error('Username already exists');
                }
                
                const user = await createUser({ username, email });
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'login') {
                if (!username) {
                    return error('Username is required');
                }
                
                // Find existing user
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                const result = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    FilterExpression: 'username = :username',
                    ExpressionAttributeValues: { ':username': username }
                }).promise();
                
                if (result.Items.length === 0) {
                    return error('User not found. Please register first.');
                }
                
                const user = result.Items[0];
                return success({ user: { userId: user.userId, username: user.username } });
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
            try {
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                const result = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    ProjectionExpression: 'username, wins, totalGames'
                }).promise();
                
                const leaderboard = result.Items
                    .filter(user => user.totalGames > 0)
                    .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                    .slice(0, 10)
                    .map((user, index) => ({
                        rank: index + 1,
                        username: user.username,
                        wins: user.wins || 0,
                        totalGames: user.totalGames || 0,
                        winRate: user.totalGames > 0 ? Math.round((user.wins || 0) / user.totalGames * 100) : 0
                    }));
                
                // Add some sample data if no real users exist
                if (leaderboard.length === 0) {
                    return success([
                        { rank: 1, username: 'RockMaster', wins: 45, totalGames: 60, winRate: 75 },
                        { rank: 2, username: 'PaperChamp', wins: 38, totalGames: 50, winRate: 76 },
                        { rank: 3, username: 'ScissorsPro', wins: 32, totalGames: 45, winRate: 71 }
                    ]);
                }
                
                return success(leaderboard);
            } catch (err) {
                console.error('Leaderboard error:', err);
                return error('Failed to load leaderboard');
            }
        }
        
        // Game endpoint
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
                
                const gameId = 'game_' + Date.now();
                const opponent = 'Computer_' + Math.floor(Math.random() * 1000);
                
                // Save game record
                if (userId) {
                    try {
                        const AWS = require('aws-sdk');
                        const dynamodb = new AWS.DynamoDB.DocumentClient();
                        
                        // Save game
                        await dynamodb.put({
                            TableName: process.env.GAMES_TABLE,
                            Item: {
                                gameId,
                                player1Id: userId,
                                player2Id: opponent,
                                player1Move: move,
                                player2Move: opponentMove,
                                winner: gameResult === 'win' ? userId : gameResult === 'lose' ? opponent : 'draw',
                                status: 'completed',
                                createdAt: new Date().toISOString(),
                                timestamp: new Date().toISOString()
                            }
                        }).promise();
                        
                        // Update user stats
                        await updateUserStats(userId, gameResult === 'win' ? 'wins' : gameResult === 'lose' ? 'losses' : 'draws');
                    } catch (err) {
                        console.log('Game save failed:', err);
                    }
                }
                
                return success({
                    gameId,
                    yourMove: move,
                    opponentMove: opponentMove,
                    result: gameResult,
                    opponent
                });
            }
        }
        
        // Game history endpoint
        if (httpMethod === 'GET' && path.startsWith('/games/')) {
            const userId = path.split('/')[2];
            
            try {
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                const result = await dynamodb.scan({
                    TableName: process.env.GAMES_TABLE,
                    FilterExpression: 'player1Id = :userId',
                    ExpressionAttributeValues: { ':userId': userId },
                    Limit: 10
                }).promise();
                
                const games = result.Items.map(game => ({
                    gameId: game.gameId,
                    opponent: game.player2Id,
                    yourMove: game.player1Move,
                    opponentMove: game.player2Move,
                    result: game.winner === userId ? 'win' : game.winner === 'draw' ? 'draw' : 'lose',
                    date: game.createdAt
                }));
                
                return success(games);
            } catch (err) {
                console.error('Game history error:', err);
                return error('Failed to load game history');
            }
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Handler error:', err);
        return error('Internal server error', 500);
    }
};