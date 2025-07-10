const { success, error } = require('../../shared/response');
const { getUser } = require('../../utils/db');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const { httpMethod, path } = event;
        
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
        
        if (httpMethod === 'GET' && path === '/leaderboard') {
            // Get top 10 players by wins
            const result = await dynamodb.scan({
                TableName: process.env.USERS_TABLE,
                ProjectionExpression: 'userId, username, wins, totalGames'
            }).promise();
            
            const leaderboard = result.Items
                .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                .slice(0, 10);
            
            return success(leaderboard);
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Game handler error:', err);
        return error('Internal server error', 500);
    }
};