const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const apigateway = new AWS.ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT
});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const GAMES_TABLE = process.env.GAMES_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
    const { connectionId, routeKey } = event.requestContext;
    
    try {
        switch (routeKey) {
            case '$connect':
                return await handleConnect(connectionId);
            case '$disconnect':
                return await handleDisconnect(connectionId);
            case 'join_queue':
                return await handleJoinQueue(connectionId, JSON.parse(event.body));
            case 'make_move':
                return await handleMakeMove(connectionId, JSON.parse(event.body));
            default:
                return { statusCode: 400, body: 'Unknown route' };
        }
    } catch (error) {
        console.error('WebSocket error:', error);
        return { statusCode: 500, body: 'Internal server error' };
    }
};

async function handleConnect(connectionId) {
    const ttl = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
    
    await dynamodb.put({
        TableName: CONNECTIONS_TABLE,
        Item: {
            connectionId,
            connectedAt: new Date().toISOString(),
            ttl
        }
    }).promise();
    
    return { statusCode: 200, body: 'Connected' };
}

async function handleDisconnect(connectionId) {
    // Remove from connections
    await dynamodb.delete({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
    }).promise();
    
    return { statusCode: 200, body: 'Disconnected' };
}

async function handleJoinQueue(connectionId, data) {
    const { userId, username } = data;
    
    // Update connection with user info
    await dynamodb.update({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'SET userId = :userId, username = :username, #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':userId': userId,
            ':username': username,
            ':status': 'waiting'
        }
    }).promise();
    
    // Look for another waiting player
    const waitingPlayers = await dynamodb.scan({
        TableName: CONNECTIONS_TABLE,
        FilterExpression: '#status = :waiting AND userId <> :currentUser',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':waiting': 'waiting',
            ':currentUser': userId
        }
    }).promise();
    
    if (waitingPlayers.Items.length > 0) {
        // Match found!
        const opponent = waitingPlayers.Items[0];
        const gameId = 'game_' + Date.now();
        
        // Update both players to playing status
        await Promise.all([
            dynamodb.update({
                TableName: CONNECTIONS_TABLE,
                Key: { connectionId },
                UpdateExpression: 'SET #status = :status, gameId = :gameId',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': 'playing',
                    ':gameId': gameId
                }
            }).promise(),
            dynamodb.update({
                TableName: CONNECTIONS_TABLE,
                Key: { connectionId: opponent.connectionId },
                UpdateExpression: 'SET #status = :status, gameId = :gameId',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': 'playing',
                    ':gameId': gameId
                }
            }).promise()
        ]);
        
        // Create game record
        await dynamodb.put({
            TableName: GAMES_TABLE,
            Item: {
                gameId,
                player1Id: userId,
                player2Id: opponent.userId,
                player1Name: username,
                player2Name: opponent.username,
                status: 'waiting_for_moves',
                createdAt: new Date().toISOString()
            }
        }).promise();
        
        // Notify both players
        await Promise.all([
            sendMessage(connectionId, {
                type: 'match_found',
                gameId,
                opponent: opponent.username
            }),
            sendMessage(opponent.connectionId, {
                type: 'match_found',
                gameId,
                opponent: username
            })
        ]);
    }
    
    return { statusCode: 200, body: 'Joined queue' };
}

async function handleMakeMove(connectionId, data) {
    const { gameId, move } = data;
    
    // Get game
    const game = await dynamodb.get({
        TableName: GAMES_TABLE,
        Key: { gameId }
    }).promise();
    
    if (!game.Item) {
        return { statusCode: 404, body: 'Game not found' };
    }
    
    const gameItem = game.Item;
    const connection = await dynamodb.get({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
    }).promise();
    
    const userId = connection.Item.userId;
    const isPlayer1 = userId === gameItem.player1Id;
    
    // Update game with move
    const updateExpression = isPlayer1 ? 
        'SET player1Move = :move' : 
        'SET player2Move = :move';
    
    await dynamodb.update({
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
            ':move': move
        }
    }).promise();
    
    // Check if both moves are made
    const updatedGame = await dynamodb.get({
        TableName: GAMES_TABLE,
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
        
        // Update game status
        await dynamodb.update({
            TableName: GAMES_TABLE,
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
        await Promise.all([
            updatePlayerStats(updatedGameItem.player1Id, result === 'player1' ? 'win' : result === 'draw' ? 'draw' : 'lose'),
            updatePlayerStats(updatedGameItem.player2Id, result === 'player2' ? 'win' : result === 'draw' ? 'draw' : 'lose')
        ]);
        
        // Get both connections
        const connections = await dynamodb.scan({
            TableName: CONNECTIONS_TABLE,
            FilterExpression: 'gameId = :gameId',
            ExpressionAttributeValues: { ':gameId': gameId }
        }).promise();
        
        // Send results to both players
        for (const conn of connections.Items) {
            const isConnPlayer1 = conn.userId === updatedGameItem.player1Id;
            const playerResult = isConnPlayer1 ? 
                (result === 'player1' ? 'win' : result === 'draw' ? 'draw' : 'lose') :
                (result === 'player2' ? 'win' : result === 'draw' ? 'draw' : 'lose');
            
            await sendMessage(conn.connectionId, {
                type: 'game_result',
                gameId,
                yourMove: isConnPlayer1 ? updatedGameItem.player1Move : updatedGameItem.player2Move,
                opponentMove: isConnPlayer1 ? updatedGameItem.player2Move : updatedGameItem.player1Move,
                result: playerResult,
                opponent: isConnPlayer1 ? updatedGameItem.player2Name : updatedGameItem.player1Name
            });
            
            // Reset connection status
            await dynamodb.update({
                TableName: CONNECTIONS_TABLE,
                Key: { connectionId: conn.connectionId },
                UpdateExpression: 'SET #status = :status REMOVE gameId',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': 'connected' }
            }).promise();
        }
    }
    
    return { statusCode: 200, body: 'Move recorded' };
}

async function sendMessage(connectionId, message) {
    try {
        await apigateway.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(message)
        }).promise();
    } catch (error) {
        if (error.statusCode === 410) {
            // Connection is gone, remove it
            await dynamodb.delete({
                TableName: CONNECTIONS_TABLE,
                Key: { connectionId }
            }).promise();
        }
        console.error('Send message error:', error);
    }
}

function determineWinner(move1, move2) {
    if (move1 === move2) return 'draw';
    
    const winConditions = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
    };
    
    return winConditions[move1] === move2 ? 'player1' : 'player2';
}

async function updatePlayerStats(userId, result) {
    const updateExpression = result === 'win' ? 
        'ADD wins :one, totalGames :one' :
        result === 'lose' ?
        'ADD losses :one, totalGames :one' :
        'ADD draws :one, totalGames :one';
    
    await dynamodb.update({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: { ':one': 1 }
    }).promise();
}