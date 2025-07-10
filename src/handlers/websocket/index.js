const AWS = require('aws-sdk');
const { saveConnection, removeConnection, getWaitingPlayers, createGame, updateGame } = require('../../utils/db');
const { matchPlayers, determineWinner, isValidMove } = require('../../utils/gameLogic');

const apiGateway = new AWS.ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
});

const sendMessage = async (connectionId, message) => {
    try {
        await apiGateway.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(message)
        }).promise();
    } catch (error) {
        console.error('Failed to send message:', error);
        if (error.statusCode === 410) {
            await removeConnection(connectionId);
        }
    }
};

exports.handler = async (event) => {
    const { requestContext } = event;
    const { connectionId, routeKey } = requestContext;
    
    try {
        switch (routeKey) {
            case '$connect':
                console.log('Client connected:', connectionId);
                return { statusCode: 200 };
                
            case '$disconnect':
                console.log('Client disconnected:', connectionId);
                await removeConnection(connectionId);
                return { statusCode: 200 };
                
            case 'join_queue':
                const { userId } = JSON.parse(event.body);
                await saveConnection(connectionId, userId);
                
                // Try to match players
                const waitingPlayers = await getWaitingPlayers();
                const match = matchPlayers(waitingPlayers);
                
                if (match) {
                    const [player1, player2] = match;
                    const game = await createGame(player1.userId, player2.userId);
                    
                    await sendMessage(player1.connectionId, {
                        type: 'game_found',
                        gameId: game.gameId,
                        opponent: player2.userId
                    });
                    
                    await sendMessage(player2.connectionId, {
                        type: 'game_found',
                        gameId: game.gameId,
                        opponent: player1.userId
                    });
                }
                
                return { statusCode: 200 };
                
            case 'make_move':
                const { gameId, move } = JSON.parse(event.body);
                
                if (!isValidMove(move)) {
                    await sendMessage(connectionId, {
                        type: 'error',
                        message: 'Invalid move'
                    });
                    return { statusCode: 400 };
                }
                
                // In a real implementation, you'd store the move and check if both players have moved
                // For now, simulate a random opponent move
                const opponentMoves = ['rock', 'paper', 'scissors'];
                const opponentMove = opponentMoves[Math.floor(Math.random() * 3)];
                
                const result = determineWinner(move, opponentMove);
                let gameResult;
                
                if (result === 'draw') {
                    gameResult = 'draw';
                } else if (result === 'player1') {
                    gameResult = 'win';
                } else {
                    gameResult = 'lose';
                }
                
                await sendMessage(connectionId, {
                    type: 'game_result',
                    gameId,
                    yourMove: move,
                    opponentMove,
                    result: gameResult
                });
                
                return { statusCode: 200 };
                
            default:
                return { statusCode: 400 };
        }
    } catch (error) {
        console.error('WebSocket handler error:', error);
        return { statusCode: 500 };
    }
};