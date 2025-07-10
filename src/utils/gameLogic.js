const MOVES = {
    ROCK: 'rock',
    PAPER: 'paper',
    SCISSORS: 'scissors'
};

const determineWinner = (move1, move2) => {
    if (move1 === move2) {
        return 'draw';
    }
    
    const winConditions = {
        [MOVES.ROCK]: MOVES.SCISSORS,
        [MOVES.PAPER]: MOVES.ROCK,
        [MOVES.SCISSORS]: MOVES.PAPER
    };
    
    return winConditions[move1] === move2 ? 'player1' : 'player2';
};

const isValidMove = (move) => {
    return Object.values(MOVES).includes(move);
};

const matchPlayers = (waitingPlayers) => {
    if (waitingPlayers.length < 2) {
        return null;
    }
    
    // Simple FIFO matching - take first two players
    return [waitingPlayers[0], waitingPlayers[1]];
};

module.exports = {
    MOVES,
    determineWinner,
    isValidMove,
    matchPlayers
};