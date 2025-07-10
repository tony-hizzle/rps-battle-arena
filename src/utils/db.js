const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = process.env.USERS_TABLE;
const GAMES_TABLE = process.env.GAMES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

// User operations
const createUser = async (userData) => {
    const user = {
        userId: uuidv4(),
        ...userData,
        createdAt: new Date().toISOString(),
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0
    };
    
    await dynamodb.put({
        TableName: USERS_TABLE,
        Item: user
    }).promise();
    
    return user;
};

const getUser = async (userId) => {
    const result = await dynamodb.get({
        TableName: USERS_TABLE,
        Key: { userId }
    }).promise();
    
    return result.Item;
};

const updateUserStats = async (userId, result) => {
    const updateExpression = 'ADD totalGames :one, #result :one';
    const expressionAttributeNames = { '#result': result };
    const expressionAttributeValues = { ':one': 1 };
    
    await dynamodb.update({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
    }).promise();
};

// Game operations
const createGame = async (player1Id, player2Id) => {
    const game = {
        gameId: uuidv4(),
        player1Id,
        player2Id,
        status: 'active',
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
    };
    
    await dynamodb.put({
        TableName: GAMES_TABLE,
        Item: game
    }).promise();
    
    return game;
};

const updateGame = async (gameId, updates) => {
    const updateExpression = Object.keys(updates).map(key => `#${key} = :${key}`).join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
    }, {});
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
        acc[`:${key}`] = updates[key];
        return acc;
    }, {});
    
    await dynamodb.update({
        TableName: GAMES_TABLE,
        Key: { gameId, timestamp: updates.timestamp || new Date().toISOString() },
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
    }).promise();
};

// Connection operations
const saveConnection = async (connectionId, userId) => {
    await dynamodb.put({
        TableName: CONNECTIONS_TABLE,
        Item: {
            connectionId,
            userId,
            status: 'waiting',
            connectedAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 3600 // 1 hour TTL
        }
    }).promise();
};

const removeConnection = async (connectionId) => {
    await dynamodb.delete({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
    }).promise();
};

const getWaitingPlayers = async () => {
    const result = await dynamodb.scan({
        TableName: CONNECTIONS_TABLE,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'waiting' }
    }).promise();
    
    return result.Items;
};

module.exports = {
    createUser,
    getUser,
    updateUserStats,
    createGame,
    updateGame,
    saveConnection,
    removeConnection,
    getWaitingPlayers
};