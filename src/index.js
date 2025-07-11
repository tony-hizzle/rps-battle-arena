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
            const { action, username, email, verificationCode } = requestBody;
            
            if (action === 'register') {
                if (!username || !email) {
                    return error('Username and email are required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                // Check if user already exists
                const existingUser = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    FilterExpression: 'username = :username OR email = :email',
                    ExpressionAttributeValues: { 
                        ':username': username,
                        ':email': email
                    }
                }).promise();
                
                if (existingUser.Items.length > 0) {
                    return error('Username or email already exists');
                }
                
                // Generate verification code
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                const userId = require('crypto').randomUUID();
                const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes
                
                // Store verification data
                await dynamodb.put({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Item: {
                        email: email,
                        verificationCode: code,
                        userId,
                        username,
                        createdAt: new Date().toISOString(),
                        expiresAt,
                        verified: false
                    }
                }).promise();
                
                // Send verification email
                await sendVerificationEmail(email, code);
                
                return success({ 
                    message: 'Verification code sent to your email',
                    email: email
                });
            }
            
            if (action === 'verify_email') {
                if (!email || !verificationCode) {
                    return error('Email and verification code are required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                // Get verification record
                const verification = await dynamodb.get({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email }
                }).promise();
                
                if (!verification.Item) {
                    return error('Verification record not found');
                }
                
                const verificationItem = verification.Item;
                
                if (verificationItem.verified) {
                    return error('Email already verified');
                }
                
                if (verificationItem.verificationCode !== verificationCode) {
                    return error('Invalid verification code');
                }
                
                if (Date.now() / 1000 > verificationItem.expiresAt) {
                    return error('Verification code expired');
                }
                
                // Create user account
                const user = await createUser({
                    userId: verificationItem.userId,
                    username: verificationItem.username,
                    email: email
                });
                
                // Mark as verified
                await dynamodb.update({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email },
                    UpdateExpression: 'SET verified = :verified',
                    ExpressionAttributeValues: { ':verified': true }
                }).promise();
                
                return success({ 
                    user: { userId: user.userId, username: user.username },
                    message: 'Email verified successfully'
                });
            }
            
            if (action === 'resend_code') {
                if (!email) {
                    return error('Email is required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                // Get existing verification record
                const verification = await dynamodb.get({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email }
                }).promise();
                
                if (!verification.Item) {
                    return error('No pending verification found');
                }
                
                if (verification.Item.verified) {
                    return error('Email already verified');
                }
                
                // Generate new code
                const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                const newExpiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes
                
                // Update verification record
                await dynamodb.update({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email },
                    UpdateExpression: 'SET verificationCode = :code, expiresAt = :expires',
                    ExpressionAttributeValues: {
                        ':code': newCode,
                        ':expires': newExpiresAt
                    }
                }).promise();
                
                // Send new verification email
                await sendVerificationEmail(email, newCode);
                
                return success({ message: 'New verification code sent' });
            }
            
            if (action === 'login') {
                if (!email) {
                    return error('Email is required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                // Find existing user by email
                const result = await dynamodb.scan({
                    TableName: process.env.USERS_TABLE,
                    FilterExpression: 'email = :email',
                    ExpressionAttributeValues: { ':email': email }
                }).promise();
                
                if (result.Items.length === 0) {
                    return error('Email not found. Please register first.');
                }
                
                const user = result.Items[0];
                
                // Generate login verification code
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes for login
                
                // Store login verification data
                await dynamodb.put({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Item: {
                        email: email,
                        verificationCode: code,
                        userId: user.userId,
                        username: user.username,
                        createdAt: new Date().toISOString(),
                        expiresAt,
                        verified: false,
                        loginAttempt: true
                    }
                }).promise();
                
                // Send login verification email
                await sendVerificationEmail(email, code);
                
                return success({ 
                    message: 'Login code sent to your email',
                    email: email
                });
            }
            
            if (action === 'verify_login') {
                if (!email || !verificationCode) {
                    return error('Email and verification code are required');
                }
                
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                // Get verification record
                const verification = await dynamodb.get({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email }
                }).promise();
                
                if (!verification.Item) {
                    return error('Verification record not found');
                }
                
                const verificationItem = verification.Item;
                
                if (verificationItem.verificationCode !== verificationCode) {
                    return error('Invalid verification code');
                }
                
                if (Date.now() / 1000 > verificationItem.expiresAt) {
                    return error('Verification code expired');
                }
                
                // Get user data
                const user = await dynamodb.get({
                    TableName: process.env.USERS_TABLE,
                    Key: { userId: verificationItem.userId }
                }).promise();
                
                if (!user.Item) {
                    return error('User not found');
                }
                
                // Clean up verification record
                await dynamodb.delete({
                    TableName: process.env.PHONE_VERIFICATION_TABLE,
                    Key: { email: email }
                }).promise();
                
                return success({ 
                    user: { userId: user.Item.userId, username: user.Item.username },
                    message: 'Login successful'
                });
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
            const { action, userId, move, gameMode } = requestBody;
            
            if (action === 'find_match') {
                const AWS = require('aws-sdk');
                const dynamodb = new AWS.DynamoDB.DocumentClient();
                
                try {
                    // Check for waiting players
                    const waitingPlayers = await dynamodb.scan({
                        TableName: process.env.USERS_TABLE,
                        FilterExpression: 'attribute_exists(waitingForMatch) AND waitingForMatch = :waiting AND userId <> :currentUser',
                        ExpressionAttributeValues: { 
                            ':waiting': true,
                            ':currentUser': userId
                        }
                    }).promise();
                    
                    if (waitingPlayers.Items.length > 0) {
                        // Match found
                        const opponent = waitingPlayers.Items[0];
                        const gameId = 'match_' + Date.now();
                        
                        // Create active game
                        await dynamodb.put({
                            TableName: process.env.GAMES_TABLE,
                            Item: {
                                gameId,
                                player1Id: userId,
                                player2Id: opponent.userId,
                                player1Name: requestBody.username || 'Player1',
                                player2Name: opponent.username,
                                status: 'active',
                                waitingForMoves: true,
                                createdAt: new Date().toISOString(),
                                timestamp: new Date().toISOString()
                            }
                        }).promise();
                        
                        // Remove both players from waiting
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
                                UpdateExpression: 'REMOVE waitingForMatch, waitingSince SET currentGameId = :gameId',
                                ExpressionAttributeValues: { ':gameId': gameId }
                            }).promise()
                        ]);
                        
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
                            await updateUserStats(userId, playerResult);
                            
                            const opponentId = isPlayer1 ? updatedGameItem.player2Id : updatedGameItem.player1Id;
                            const opponentResult = winner === opponentId ? 'win' : winner === 'draw' ? 'draw' : 'lose';
                            await updateUserStats(opponentId, opponentResult);
                            
                            // Clear current game from users
                            await Promise.all([
                                dynamodb.update({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId },
                                    UpdateExpression: 'REMOVE currentGameId'
                                }).promise(),
                                dynamodb.update({
                                    TableName: process.env.USERS_TABLE,
                                    Key: { userId: opponentId },
                                    UpdateExpression: 'REMOVE currentGameId'
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

async function sendVerificationEmail(email, code) {
    console.log(`VERIFICATION CODE for ${email}: ${code}`);
    
    const AWS = require('aws-sdk');
    const ses = new AWS.SES({ region: 'us-east-1' });
    
    const params = {
        Source: 'noreply@example.com',
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: 'RPS Battle Arena - Verification Code' },
            Body: {
                Text: { Data: `Your RPS Battle Arena verification code is: ${code}\n\nThis code expires in 15 minutes.` }
            }
        }
    };
    
    try {
        await ses.sendEmail(params).promise();
        console.log(`Email sent successfully to ${email}`);
    } catch (error) {
        console.error('Email send error:', error);
        console.log(`EMAIL FAILED - Use verification code: ${code}`);
    }
}