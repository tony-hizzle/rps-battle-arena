# RPS Battle Arena - Design & Architecture

## System Architecture Overview

### High-Level Architecture
```
[Frontend (S3 Static Website)] 
    ↓ (HTTPS REST API + Polling)
[API Gateway REST API]
    ↓
[Lambda Functions]
    ↓
[DynamoDB Tables]
```

### Architecture Components

#### Frontend Layer
- **Technology**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Hosting**: Amazon S3 static website hosting
- **Features**: Single-page application with polling-based real-time communication
- **Session Management**: localStorage for persistent login

#### API Layer
- **REST API**: Amazon API Gateway for all communication
- **Real-time Communication**: Polling-based updates every 2 seconds
- **Authentication**: Custom username/email registration system

#### Backend Layer
- **Compute**: AWS Lambda functions (Node.js)
- **Database**: Amazon DynamoDB (Users, Games tables)
- **Authentication**: Custom user management in DynamoDB

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
- waitingForMatch: Boolean (optional)
- waitingSince: String (optional)
- currentGameId: String (optional)
```

#### Games Table
```
Table: rps-games
Partition Key: gameId (String)
Attributes:
- gameId: String (UUID)
- player1Id: String
- player2Id: String
- player1Name: String
- player2Name: String
- player1Move: String (rock/paper/scissors)
- player2Move: String (rock/paper/scissors)
- winner: String (player1Id/player2Id/draw)
- status: String (active/completed)
- gameMode: String (computer/multiplayer)
- createdAt: String (ISO timestamp)
- completedAt: String (ISO timestamp)
- timestamp: String (ISO timestamp)
```

#### Phone Verification Table
```
Table: rps-phone-verification
Partition Key: phoneNumber (String)
Attributes:
- phoneNumber: String (E.164 format)
- verificationCode: String (6-digit code)
- userId: String (UUID)
- username: String
- createdAt: String (ISO timestamp)
- expiresAt: Number (TTL timestamp)
- verified: Boolean
```

## API Design

### REST API Endpoints

#### Authentication
- `POST /auth` - User registration and login
  - Actions: `register`, `login`, `verify_phone`, `verify_login`, `resend_code`

#### Game Management
- `POST /game` - All game operations
  - Actions: `find_match`, `play`, `check_game`
- `GET /stats/{userId}` - Get user statistics
- `GET /leaderboard` - Get top players
- `GET /games/{userId}` - Get user's game history

### Real-time Communication (Polling)

#### Matchmaking Flow
```json
// Find Match Request
{
  "action": "find_match",
  "userId": "string",
  "username": "string"
}

// Match Found Response
{
  "success": true,
  "data": {
    "matchFound": true,
    "opponent": "username",
    "gameId": "string"
  }
}
```

#### Game Status Polling
```json
// Check Game Request
{
  "action": "check_game",
  "gameId": "string",
  "userId": "string"
}

// Game Complete Response
{
  "success": true,
  "data": {
    "gameComplete": true,
    "yourMove": "rock|paper|scissors",
    "opponentMove": "rock|paper|scissors",
    "result": "win|lose|draw",
    "opponent": "username"
  }
}
```

## Lambda Functions

### Function Architecture
```
src/
├── index.js (Main Lambda handler)
├── websocket.js (Unused WebSocket handler)
└── Unified handler with actions:
    ├── Authentication (register/login)
    ├── Game operations (find_match/play/check_game)
    ├── Statistics (user stats/leaderboard)
    ├── Game history
    └── Utility functions
```

### Core Functions

#### Main Game Handler (`index.js`)
- Unified REST API handler
- Manages user authentication
- Handles matchmaking queue
- Processes real-time multiplayer games
- Manages game state with polling

#### Game Logic (`utils/gameLogic.js`)
```javascript
function determineWinner(move1, move2) {
  // Rock beats Scissors
  // Scissors beats Paper  
  // Paper beats Rock
}

function matchPlayers(waitingPlayers) {
  // Queue-based matching with DynamoDB
  // Players added to waitingForMatch flag
  // First available player matched
}

function pollGameStatus(gameId) {
  // Check game completion every 2 seconds
  // Return results when both moves made
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
  currentUser: null,
  gameStats: { totalGames: 0, wins: 0, losses: 0, draws: 0 },
  gameMode: 'computer', // 'computer' or 'multiplayer'
  currentGameId: null,
  gameCheckInterval: null // For polling
};
```

## Security Considerations

### Authentication & Authorization
- Custom user registration and login system
- localStorage session persistence
- Server-side user validation

### Input Validation
- Client-side and server-side move validation
- API request validation
- Game state consistency checks

### Anti-Cheat Measures
- Server-side game logic validation
- Game state synchronization
- Matchmaking queue integrity

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
- S3 static website hosting
- Browser localStorage for session persistence
- DynamoDB native performance

### Scalability Considerations
- Lambda auto-scaling
- DynamoDB on-demand pricing
- Polling frequency optimization
- Queue management for matchmaking

## Error Handling

### Client-Side Error Handling
- Network connectivity issues
- Polling timeout handling
- Matchmaking fallback to computer mode
- Invalid move handling

### Server-Side Error Handling
- Lambda function error handling
- DynamoDB operation failures
- Game state consistency management
- Matchmaking queue cleanup

## Repeat Matchmaking Solution

### Problem Identified
After the first online game, one of the matched players would intermittently not receive match notifications due to:
- Browser caching of API responses
- Stale polling state persisting across games
- Different browser handling of fetch requests after initial game
- Chrome and Safari having different caching behaviors

### Solution Implemented
**Page Reload Approach**: Force page reload for repeat matchmaking to ensure completely clean state

```javascript
function playAgain() {
    // Force page reload for repeat matchmaking
    if (gameStats.totalGames > 0) {
        console.log('Reloading page for clean repeat matchmaking state');
        window.location.reload();
    } else {
        showScreen('mode-screen');
    }
}
```

### Technical Implementation Details
- **Ultra-Fast Polling**: 250ms intervals for rapid match detection
- **Cache Busting**: URL parameters with timestamp and random values
- **Universal Fallback**: 200ms fallback mechanism for all browsers
- **Login Persistence**: User session maintained through localStorage
- **Clean State**: Page reload eliminates all stale polling and caching issues

### Benefits
- **100% Reliability**: Guaranteed fresh state for repeat games
- **Cross-Browser**: Works consistently in Chrome, Safari, Firefox, Edge
- **User Experience**: Brief reload vs broken functionality
- **Maintainable**: Simple solution that's easy to understand and debug

## Known Issues & Limitations

### Browser Compatibility
- WebSocket connections may have different timeout behaviors across browsers
- Some browsers may require user interaction before playing audio
- Chrome and Safari have different caching behaviors for API requests

### Performance Considerations
- DynamoDB read/write capacity should be monitored under high load
- Ultra-fast polling (250ms) increases API call frequency during matchmaking
- Page reload approach adds brief UX interruption for repeat games

### Security Notes
- Input validation is implemented but should be regularly reviewed
- Rate limiting may be needed for production deployment

## Future Enhancements

### Planned Features
- Tournament mode with bracket system
- Player profiles with avatars
- Chat system for players
- Mobile app development
- Advanced statistics and analytics

### Technical Improvements
- Replace polling-based matchmaking with WebSocket real-time notifications
- Implement proper authentication with JWT tokens
- Add comprehensive error handling and retry logic
- Optimize database queries and indexing
- Implement caching layer for frequently accessed data
- Add monitoring and alerting for system health
- Implement server-side session management for better state handling