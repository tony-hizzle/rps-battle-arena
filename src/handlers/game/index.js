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
        
        if (httpMethod === 'GET' && path.startsWith('/leaderboard')) {
            const userId = event.queryStringParameters?.userId;
            
            // Get all players sorted by wins
            const result = await dynamodb.scan({
                TableName: process.env.USERS_TABLE,
                ProjectionExpression: 'userId, username, wins, totalGames'
            }).promise();
            
            const allPlayers = result.Items
                .filter(player => (player.wins || 0) > 0 || (player.totalGames || 0) > 0)
                .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                .map((player, index) => ({
                    ...player,
                    rank: index + 1,
                    winRate: player.totalGames > 0 ? Math.round((player.wins || 0) / player.totalGames * 100) : 0
                }));
            
            const top10 = allPlayers.slice(0, 10);
            let leaderboard = [...top10];
            
            // If userId provided and not in top 10, add user's rank
            if (userId) {
                const userRank = allPlayers.find(player => player.userId === userId);
                if (userRank && userRank.rank > 10) {
                    leaderboard.push(userRank);
                }
            }
            
            return success(leaderboard);
        }
        
        return error('Invalid request', 404);
    } catch (err) {
        console.error('Game handler error:', err);
        return error('Internal server error', 500);
    }
};