# RPS Battle Arena - Design & Architecture

## System Architecture Overview

### High-Level Architecture
```
[Frontend (S3/CloudFront)] 
    ↓ (HTTPS/WSS)
[API Gateway + WebSocket API]
    ↓
[Lambda Functions]
    ↓
[DynamoDB] + [Cognito]
```

### Architecture Components

#### Frontend Layer
- **Technology**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Hosting**: Amazon S3 static website + CloudFront CDN
- **Features**: Single-page application with real-time WebSocket communication

#### API Layer
- **REST API**: Amazon API Gateway for user management and statistics
- **WebSocket API**: AWS WebSocket API for real-time game communication
- **Authentication**: Amazon Cognito integration

#### Backend Layer
- **Compute**: AWS Lambda functions (Node.js)
- **Database**: Amazon DynamoDB
- **Authentication**: Amazon Cognito User Pools

## Database Design

### DynamoDB Tables

#### Users Table
```
Table: rps-users
Partition Key: userId (String)
Attributes:
- userId: String (UUID)
- username: String
- email: String
- createdAt: String (ISO timestamp)
- totalGames: Number
- wins: Number
- losses: Number
- draws: Number
```

#### Games Table
```
Table: rps-games
Partition Key: gameId (String)
Sort Key: timestamp (String)
Attributes:
- gameId: String (UUID)
- player1Id: String
- player2Id: String
- player1Move: String (rock/paper/scissors)
- player2Move: String (rock/paper/scissors)
- winner: String (player1Id/player2Id/draw)
- status: String (waiting/active/completed)
- createdAt: String (ISO timestamp)
- completedAt: String (ISO timestamp)
```

#### Active Connections Table
```
Table: rps-connections
Partition Key: connectionId (String)
Attributes:
- connectionId: String
- userId: String
- status: String (waiting/playing)
- gameId: String (optional)
- connectedAt: String (ISO timestamp)
```

## API Design

### REST API Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile

#### Game Management
- `GET /stats/{userId}` - Get user statistics
- `GET /leaderboard` - Get top players
- `GET /games/{userId}` - Get user's game history

### WebSocket API Events

#### Client → Server
```json
{
  "action": "join_queue",
  "userId": "string"
}

{
  "action": "make_move",
  "gameId": "string",
  "move": "rock|paper|scissors"
}

{
  "action": "disconnect",
  "userId": "string"
}
```

#### Server → Client
```json
{
  "type": "game_found",
  "gameId": "string",
  "opponent": "username"
}

{
  "type": "game_result",
  "gameId": "string",
  "yourMove": "rock|paper|scissors",
  "opponentMove": "rock|paper|scissors",
  "result": "win|lose|draw"
}

{
  "type": "opponent_disconnected",
  "gameId": "string"
}
```

## Lambda Functions

### Function Architecture
```
src/
├── handlers/
│   ├── auth/
│   │   ├── register.js
│   │   ├── login.js
│   │   └── profile.js
│   ├── game/
│   │   ├── stats.js
│   │   ├── leaderboard.js
│   │   └── history.js
│   └── websocket/
│       ├── connect.js
│       ├── disconnect.js
│       ├── joinQueue.js
│       └── makeMove.js
├── utils/
│   ├── db.js
│   ├── auth.js
│   └── gameLogic.js
└── shared/
    └── response.js
```

### Core Functions

#### WebSocket Handler (`websocket/handler.js`)
- Manages WebSocket connections
- Handles player matching
- Processes game moves
- Manages game state

#### Game Logic (`utils/gameLogic.js`)
```javascript
function determineWinner(move1, move2) {
  // Rock beats Scissors
  // Scissors beats Paper  
  // Paper beats Rock
}

function matchPlayers(waitingPlayers) {
  // Simple FIFO matching
}
```

## Frontend Design

### User Interface Components

#### Main Menu
- Login/Register forms
- User stats display
- "Find Game" button
- Leaderboard view

#### Game Screen
- Move selection (Rock/Paper/Scissors buttons)
- Game status display
- Opponent information
- Result display

#### Statistics Dashboard
- Win/Loss/Draw counts
- Game history
- Personal leaderboard position

### State Management
```javascript
const gameState = {
  user: null,
  currentGame: null,
  gameHistory: [],
  leaderboard: [],
  websocket: null
};
```

## Security Considerations

### Authentication & Authorization
- Amazon Cognito for secure user authentication
- JWT tokens for API authorization
- WebSocket connection validation

### Input Validation
- Client-side and server-side move validation
- Rate limiting on API calls
- WebSocket message validation

### Anti-Cheat Measures
- Server-side game logic validation
- Move timing validation
- Connection integrity checks

## Deployment Strategy

### Infrastructure as Code
- AWS CDK for infrastructure deployment
- Environment-specific configurations
- Automated resource provisioning

### CI/CD Pipeline
1. Code commit triggers build
2. Run tests and linting
3. Deploy to staging environment
4. Run integration tests
5. Deploy to production

### Monitoring & Logging
- CloudWatch for Lambda function monitoring
- API Gateway access logs
- DynamoDB performance metrics
- WebSocket connection monitoring

## Performance Optimization

### Caching Strategy
- CloudFront for static asset caching
- DynamoDB DAX for database caching (if needed)
- API Gateway response caching

### Scalability Considerations
- Lambda auto-scaling
- DynamoDB on-demand pricing
- WebSocket API connection limits
- Connection pooling strategies

## Error Handling

### Client-Side Error Handling
- Network connectivity issues
- WebSocket disconnection recovery
- Invalid move handling

### Server-Side Error Handling
- Lambda function error handling
- DynamoDB operation failures
- WebSocket connection failures
- Graceful degradation strategies