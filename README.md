## Introduction

This is the README file for **RPS Battle Arena**, a multiplayer Rock, Paper, Scissors web application built as part of the "Disney Hack the Code Challenge", a mini hack-a-thon for building applications using Amazon Q Developer IDE experience. The project, including the files below, will be implemented by the Amazon Q Developer, through interactive discussion with the user.

## 🎯 Use Case

RPS Battle Arena transforms the classic Rock, Paper, Scissors game into a competitive online experience. Players can:

- **Find Opponents Instantly**: Automatic matchmaking connects you with online players
- **Track Performance**: Detailed statistics and leaderboard rankings
- **Challenge Friends**: Rematch system for continuous play
- **Play Anytime**: Computer opponents available when no players online
- **Compete Globally**: Real-time multiplayer with players worldwide

Perfect for quick gaming sessions, competitive tournaments, or casual fun with friends.

## 💎 Value Proposition

### For Players
- **Instant Fun**: No downloads, play immediately in browser
- **Fair Competition**: Server-side validation prevents cheating
- **Progress Tracking**: Watch your skills improve over time
- **Social Gaming**: Connect with players worldwide
- **Always Available**: Computer opponents when humans aren't online

### For Developers
- **Serverless Architecture**: Scales automatically, pay only for usage
- **Modern Stack**: Latest AWS services and best practices
- **Real-time Features**: WebSocket-like experience with polling
- **Production Ready**: Error handling, timeouts, and edge cases covered
- **Cost Efficient**: Minimal infrastructure costs for maximum functionality

## 🔄 Recent Updates

### Latest Features (v3.0)
- ✅ **Cognito Authentication**: AWS Cognito integration with email/password
- ✅ **Email Verification**: Secure account verification workflow
- ✅ **Guest Mode**: Play without registration for casual users
- ✅ **Rematch System**: Instant rematches between same players
- ✅ **Game Timeouts**: 1-minute timeout with automatic cleanup
- ✅ **Enhanced Leaderboard**: Shows user rank even outside top 10
- ✅ **Improved UI**: Separate Cancel/Play Computer buttons
- ✅ **Safari Compatibility**: Fixed cross-browser issues
- ✅ **Smart Matchmaking**: Join existing rematch games

### Bug Fixes
- 🐛 Fixed Safari null reference errors
- 🐛 Resolved game screen state persistence
- 🐛 Improved DynamoDB query performance
- 🐛 Enhanced error handling and user feedback

### Performance Improvements
- ⚡ Optimized matchmaking polling
- ⚡ Reduced API calls with smart caching
- ⚡ Faster game state transitions
- ⚡ Improved timeout handling

## 🚀 Live Application

**🎮 Play Now**: http://rps-battle-arena-web-1752251316.s3-website-us-east-1.amazonaws.com/
**API URL**: https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/

## ✨ Features

### 🎮 Game Modes
- **Multiplayer**: Real-time matches against online players
- **Computer**: Play against AI opponents
- **Rematch**: Challenge previous opponents instantly

### 🏆 Competitive Features
- **Leaderboard**: Top 10 players + your rank if outside top 10
- **Personal Stats**: Track wins, losses, draws, and total games
- **Game History**: Review your recent matches
- **Win Rate Tracking**: Percentage-based performance metrics

### ⚡ Real-time Gameplay
- **1-minute game timeout** for active multiplayer games
- **Instant matchmaking** with waiting queue system
- **Live game status** updates and notifications
- **Automatic timeout handling** with page refresh

### 🔧 User Experience
- **Cognito Authentication**: AWS Cognito email/password authentication
- **Email Verification**: Secure account verification process
- **Guest Mode**: Play without registration (stats not saved)
- **Persistent Sessions**: Stay logged in across visits
- **Responsive Design**: Works on desktop and mobile
- **Cross-browser Support**: Chrome, Safari, Firefox compatible

### API Endpoints
- `POST /auth` - Cognito user creation and management
- `GET /leaderboard?userId={id}` - Leaderboard with user rank
- `GET /stats/{userId}` - User statistics
- `POST /game` - Game actions (play, find_match, request_rematch)
- `GET /games/{userId}` - User game history

### Test the API
```bash
# Get leaderboard
curl "https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/leaderboard"

# Play against computer
curl -X POST "https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/game" \
  -H "Content-Type: application/json" \
  -d '{"action":"play","move":"rock","gameMode":"computer"}'
```

## 📁 Project Structure

```
rps-battle-arena/
├── README.md                 # Project documentation
├── requirements.md           # Project requirements
├── design.md                # Architecture design
├── tasks.md                 # Implementation tasks
├── frontend/                # Web application
│   ├── index.html          # Main application file
│   ├── css/style.css       # Styling
│   └── js/app.js           # JavaScript logic
├── src/                     # Lambda functions
│   ├── index.js            # Main handler
│   ├── handlers/           # Route handlers
│   ├── utils/              # Utility functions
│   └── shared/             # Shared modules
└── infrastructure/          # AWS CDK project
    ├── src/main/java/      # CDK stack definition
    └── cdk.json            # CDK configuration
```

## 🚀 Deployment

### Prerequisites
- AWS CLI configured
- Node.js 18+ installed
- Java 11+ for CDK
- Maven for CDK build

### Deploy Backend
```bash
cd infrastructure
npx cdk deploy --require-approval never
```

### Deploy Frontend
```bash
aws s3 sync frontend/ s3://your-bucket-name/ --delete
```

### Local Development
```bash
# Install dependencies
cd src && npm install

# Test locally
open frontend/index.html
```

## 🏗️ Architecture

### Frontend
- **Hosting**: Amazon S3 Static Website
- **Technology**: Vanilla HTML/CSS/JavaScript
- **Features**: Real-time UI updates, responsive design

### Backend
- **Compute**: AWS Lambda (Node.js 18.x)
- **API**: Amazon API Gateway REST API
- **Authentication**: Amazon Cognito User Pools
- **Game Logic**: Server-side move validation

### Database
- **Primary**: Amazon DynamoDB
- **Authentication**: Amazon Cognito User Pools
- **Tables**: Users, Games
- **Features**: Pay-per-request billing, automatic scaling

### Infrastructure
- **IaC**: AWS CDK (Java)
- **Deployment**: Automated via CDK
- **Monitoring**: CloudWatch logs and metrics

## 🎯 Game Rules

### Multiplayer Games
- **Matchmaking**: Automatic pairing with waiting players
- **Timeout**: Games expire after 1 minute of inactivity
- **Rematch**: Instant rematches with same opponent
- **Stats**: All multiplayer results tracked

### Computer Games
- **AI Opponent**: Random move generation
- **Instant Results**: No waiting for opponent
- **Stats Tracking**: Wins/losses recorded

### Scoring
- **Win**: Your move beats opponent's move
- **Loss**: Opponent's move beats your move  
- **Draw**: Both players choose same move
- **Classic Rules**: Rock beats Scissors, Scissors beats Paper, Paper beats Rock

