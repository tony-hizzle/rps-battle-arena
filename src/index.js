const { success, error } = require('./shared/response');
const { createUser, getUser, updateUserStats } = require('./utils/db');
const { determineWinner, isValidMove } = require('./utils/gameLogic');

function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return phoneNumber;
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;
}

exports.handler = async (event) => {
    try {
        console.log('Event:', JSON.stringify(event, null, 2));
        
        const { httpMethod, path, body } = event;
        const requestBody = body ? JSON.parse(body) : {};
        
        // Authentication endpoints
        if (httpMethod === 'POST' && path === '/auth') {
            const { action, username, email } = requestBody;
            
            if (action === 'login') {
                if (!username || !email) {
                    return error('Username and email are required');
                }
                
                const user = await getUser(username);
                if (!user) {
                    return error('Username not found', 404);
                }
                
                if (user.email !== email) {
                    return error('Email does not match');
                }
                
                return success({ user: { userId: user.userId, username: user.username } });
            }
            
            if (action === 'register') {
                if (!username || !email) {
                    return error('Username and email are required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                const existingUsers = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    FilterExpression: 'username = :username OR email = :email',
                    ExpressionAttributeValues: { 
                        ':username': username,
                        ':email': email
                    }
                }).promise();
                
                if (existingUsers.Items.length > 0) {
                    const existingUser = existingUsers.Items[0];
                    if (existingUser.username === username) {
                        return error('Username already exists');
                    }
                    if (existingUser.email === email) {
                        return error('Email already exists');
                    }
                }
                
                const user = await createUser({ username, email });
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
            const { action, userId, move, gameMode, timestamp, browser } = requestBody;
            
            if (action === 'find_match') {
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                try {
                    // First check if this user already has an active game
                    const userResult = await dynamodb.get({
                        TableName: process.env.USERS_TABLE,
                        Key: { userId }
                    }).promise();
                    
                    if (userResult.Item && userResult.Item.currentGameId) {
                        // User already has a game, get game details
                        const gameResult = await dynamodb.get({
                            TableName: process.env.GAMES_TABLE,
                            Key: { gameId: userResult.Item.currentGameId }
                        }).promise();
                        
                        if (gameResult.Item && gameResult.Item.status === 'active') {
                            const game = gameResult.Item;
                            const isPlayer1 = userId === game.player1Id;
                            const opponentName = isPlayer1 ? game.player2Name : game.player1Name;
                            
                            console.log(`Found active game for user ${userId}: ${game.gameId} at ${timestamp || 'no-timestamp'}`);
                            
                            return success({
                                matchFound: true,
                                opponent: opponentName,
                                gameId: game.gameId
                            });
                        } else {
                            // Game is completed or doesn't exist, clear all game-related states
                            console.log(`Clearing stale game reference for user ${userId} at ${timestamp || 'no-timestamp'}`);
                            await dynamodb.update({
                                TableName: process.env.USERS_TABLE,
                                Key: { userId },
                                UpdateExpression: 'REMOVE currentGameId, waitingForMatch, waitingSince, matchedAt'
                            }).promise();
                        }
                    }
                    
                    // Simple matchmaking: check for any waiting players
                    const waitingPlayers = await dynamodb.scan({
                        TableName: process.env.USERS_TABLE,
                        FilterExpression: 'attribute_exists(waitingForMatch) AND waitingForMatch = :waiting AND userId <> :currentUser',
                        ExpressionAttributeValues: { 
                            ':waiting': true,
                            ':currentUser': userId
                        }
                    }).promise();
                    
                    console.log(`Found ${waitingPlayers.Items.length} waiting players for user ${userId}`);
                    
                    if (waitingPlayers.Items.length > 0) {
                        // Match found - create game
                        const opponent = waitingPlayers.Items[0];
                        const gameId = 'match_' + Date.now();
                        
                        console.log(`Creating match: ${gameId} between ${opponent.userId} and ${userId}`);
                        
                        // Create game
                        await dynamodb.put({
                            TableName: process.env.GAMES_TABLE,
                            Item: {
                                gameId,
                                player1Id: opponent.userId,
                                player2Id: userId,
                                player1Name: opponent.username,
                                player2Name: requestBody.username || 'Player2',
                                status: 'active',
                                createdAt: new Date().toISOString(),
                                timestamp: new Date().toISOString()
                            }
                        }).promise();
                        
                        // Update both players
                        await Promise.all([
                            dynamodb.update({
                                TableName: process.env.USERS_TABLE,
                                Key: { userId: opponent.userId },
                                UpdateExpression: 'REMOVE waitingForMatch, waitingSince SET currentGameId = :gameId',
                                ExpressionAttributeValues: { ':gameId': gameId }
                            }).promise(),
                            dynamodb.update({
                                TableName: process.env.USERS_TABLE,
                                Key: { userId },
                                UpdateExpression: 'SET currentGameId = :gameId',
                                ExpressionAttributeValues: { ':gameId': gameId }
                            }).promise()
                        ]);
                        
                        console.log(`Match created: ${gameId}`);
                        return success({
                            matchFound: true,
                            opponent: opponent.username,
                            gameId: gameId
                        });
                    } else {
                        // Add to waiting queue
                        await dynamodb.update({
                            TableName: process.env.USERS_TABLE,
                            Key: { userId },
                            UpdateExpression: 'SET waitingForMatch = :waiting, waitingSince = :time',
                            ExpressionAttributeValues: {
                                ':waiting': true,
                                ':time': new Date().toISOString()
                            }
                        }).promise();
                        
                        console.log(`User ${userId} added to waiting queue (${browser || 'unknown'} browser)`);
                        return success({
                            matchFound: false,
                            message: 'Added to matchmaking queue'
                        });
                    }
                } catch (err) {
                    console.error('Matchmaking error:', err);
                    return success({
                        matchFound: false,
                        message: 'Matchmaking unavailable, play vs computer'
                    });
                }
            }
            
            if (action === 'check_game') {
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                try {
                    const game = await dynamodb.get({
                        TableName: process.env.GAMES_TABLE,
                        Key: { gameId: requestBody.gameId }
                    }).promise();
                    
                    if (!game.Item) {
                        return error('Game not found');
                    }
                    
                    const gameItem = game.Item;
                    const isPlayer1 = userId === gameItem.player1Id;
                    
                    if (gameItem.status === 'completed') {
                        // Game completed, return results
                        const result = gameItem.winner === userId ? 'win' : 
                                     gameItem.winner === 'draw' ? 'draw' : 'lose';
                        
                        return success({
                            gameComplete: true,
                            yourMove: isPlayer1 ? gameItem.player1Move : gameItem.player2Move,
                            opponentMove: isPlayer1 ? gameItem.player2Move : gameItem.player1Move,
                            result: result,
                            opponent: isPlayer1 ? gameItem.player2Name : gameItem.player1Name
                        });
                    } else {
                        return success({
                            gameComplete: false,
                            waitingForOpponent: !gameItem.player1Move || !gameItem.player2Move
                        });
                    }
                } catch (err) {
                    console.error('Check game error:', err);
                    return error('Failed to check game status');
                }
            }
            
            if (action === 'play') {
                if (!isValidMove(move)) {
                    return error('Invalid move');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                if (gameMode === 'multiplayer' && requestBody.gameId) {
                    // Real multiplayer game
                    const gameId = requestBody.gameId;
                    
                    try {
                        // Get current game
                        const game = await dynamodb.get({
                            TableName: process.env.GAMES_TABLE,
                            Key: { gameId }
                        }).promise();
                        
                        if (!game.Item) {
                            return error('Game not found');
                        }
                        
                        const gameItem = game.Item;
                        const isPlayer1 = userId === gameItem.player1Id;
                        
                        // Update game with player's move
                        const updateExpression = isPlayer1 ? 
                            'SET player1Move = :move' : 
                            'SET player2Move = :move';
                        
                        await dynamodb.update({
                            TableName: process.env.GAMES_TABLE,
                            Key: { gameId },
                            UpdateExpression: updateExpression,
                            ExpressionAttributeValues: { ':move': move }
                        }).promise();
                        
                        // Get updated game to check if both moves are made
                        const updatedGame = await dynamodb.get({
                            TableName: process.env.GAMES_TABLE,
                            Key: { gameId }
                        }).promise();
                        
                        const updatedGameItem = updatedGame.Item;
                        
                        if (updatedGameItem.player1Move && updatedGameItem.player2Move) {
                            // Both moves made, determine winner
                            const result = determineWinner(updatedGameItem.player1Move, updatedGameItem.player2Move);
                            let winner = 'draw';
                            
                            if (result === 'player1') {
                                winner = updatedGameItem.player1Id;
                            } else if (result === 'player2') {
                                winner = updatedGameItem.player2Id;
                            }
                            
                            // Update game as completed
                            await dynamodb.update({
                                TableName: process.env.GAMES_TABLE,
                                Key: { gameId },
                                UpdateExpression: 'SET winner = :winner, #status = :status, completedAt = :completedAt',
                                ExpressionAttributeNames: { '#status': 'status' },
                                ExpressionAttributeValues: {
                                    ':winner': winner,
                                    ':status': 'completed',
                                    ':completedAt': new Date().toISOString()
                                }
                            }).promise();
                            
                            // Update player stats
                            const playerResult = winner === userId ? 'win' : winner === 'draw' ? 'draw' : 'lose';
                            if (playerResult === 'win') {
                                await updateUserStats(userId, 'wins');
                            } else if (playerResult === 'lose') {
                                await updateUserStats(userId, 'losses');
                            } else {
                                await updateUserStats(userId, 'draws');
                            }
                            
                            const opponentId = isPlayer1 ? updatedGameItem.player2Id : updatedGameItem.player1Id;
                            const opponentResult = winner === opponentId ? 'win' : winner === 'draw' ? 'draw' : 'lose';
                            if (opponentResult === 'win') {
                                await updateUserStats(opponentId, 'wins');
                            } else if (opponentResult === 'lose') {
                                await updateUserStats(opponentId, 'losses');
                            } else {
                                await updateUserStats(opponentId, 'draws');
                            }
                            
                            // Clear current game and any waiting states from users
                            await Promise.all([
                                dynamodb.update({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId },
                                    UpdateExpression: 'REMOVE currentGameId, waitingForMatch, waitingSince, matchedAt'
                                }).promise(),
                                dynamodb.update({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId: opponentId },
                                    UpdateExpression: 'REMOVE currentGameId, waitingForMatch, waitingSince, matchedAt'
                                }).promise()
                            ]);
                            
                            return success({
                                gameId,
                                yourMove: isPlayer1 ? updatedGameItem.player1Move : updatedGameItem.player2Move,
                                opponentMove: isPlayer1 ? updatedGameItem.player2Move : updatedGameItem.player1Move,
                                result: playerResult,
                                opponent: isPlayer1 ? updatedGameItem.player2Name : updatedGameItem.player1Name,
                                gameComplete: true
                            });
                        } else {
                            // Waiting for opponent's move
                            return success({
                                gameId,
                                yourMove: move,
                                waitingForOpponent: true,
                                gameComplete: false
                            });
                        }
                    } catch (err) {
                        console.error('Multiplayer game error:', err);
                        return error('Game error occurred');
                    }
                } else {
                    // Computer opponent
                    const opponent = 'Computer_' + Math.floor(Math.random() * 1000);
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
                                gameMode: 'computer',
                                createdAt: new Date().toISOString(),
                                timestamp: new Date().toISOString()
                            }
                        }).promise();
                        
                        // Update user stats
                        if (gameResult === 'win') {
                            await updateUserStats(userId, 'wins');
                        } else if (gameResult === 'lose') {
                            await updateUserStats(userId, 'losses');
                        } else {
                            await updateUserStats(userId, 'draws');
                        }
                    } catch (err) {
                        console.log('Game save failed:', err);
                    }
                }
                
                    return success({
                        gameId,
                        yourMove: move,
                        opponentMove: opponentMove,
                        result: gameResult,
                        opponent,
                        gameComplete: true
                    });
                }
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
                    FilterExpression: 'player1Id = :userId OR player2Id = :userId',
                    ExpressionAttributeValues: { ':userId': userId }
                }).promise();
                
                const games = result.Items
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10)
                    .map(game => {
                        const isPlayer1 = game.player1Id === userId;
                        return {
                            gameId: game.gameId,
                            opponent: isPlayer1 ? game.player2Name || game.player2Id : game.player1Name || game.player1Id,
                            yourMove: isPlayer1 ? game.player1Move : game.player2Move,
                            opponentMove: isPlayer1 ? game.player2Move : game.player1Move,
                            result: game.winner === userId ? 'win' : game.winner === 'draw' ? 'draw' : 'lose',
                            date: game.createdAt
                        };
                    });
                
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

