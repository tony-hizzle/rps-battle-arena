# Project Requirements

## Project Overview
**Project Name:** RPS Battle Arena
**Challenge:** Disney Hack the Code Challenge
**Development Tool:** Amazon Q Developer (IDE experience)

## Use Case Definition
Create an engaging multiplayer web application where users can play Rock, Paper, Scissors against other online players in real-time. The application will provide a fun, competitive gaming experience while tracking player statistics and win records.

## Functional Requirements

### Core Features
- [x] AWS Cognito user authentication
- [x] Email verification workflow
- [x] Guest mode for casual play
- [x] Real-time multiplayer game matching
- [x] Rock, Paper, Scissors game logic
- [x] Win/loss tracking and statistics
- [x] Game history and leaderboard
- [x] Real-time game state synchronization
- [x] Rematch system for continuous play
- [x] Game timeouts (1-minute limit)
- [x] Computer opponent mode
- [x] Enhanced leaderboard with user ranking

### User Stories
- As a player, I want to create a secure account with email verification so that my wins are tracked
- As a casual player, I want to play as a guest without registration for quick games
- As a player, I want to be matched with another online player so that I can play Rock, Paper, Scissors
- As a player, I want to see my win/loss record so that I can track my performance
- As a player, I want to see a leaderboard so that I can compare my performance with others
- As a player, I want real-time gameplay so that the experience feels responsive and engaging
- As a player, I want to rematch my opponent so that I can play multiple games quickly
- As a player, I want games to timeout so that I'm not stuck waiting indefinitely
- As a player, I want to play against computer when no humans are available
- As a player, I want to see my rank even if I'm not in the top 10

## Non-Functional Requirements

### Performance
- [x] Game moves processed within 100ms
- [x] Support for 100+ concurrent players
- [x] Real-time updates with <500ms latency (achieved via 250ms polling)

### Security
- [x] Secure user authentication (custom system)
- [x] Session management (localStorage with server validation)
- [x] Input validation and sanitization
- [x] Protection against cheating/manipulation (server-side game logic)

### Availability & Reliability
- [x] 99.5% uptime target (AWS serverless architecture)
- [x] Graceful handling of disconnections
- [x] Basic monitoring and logging

## Technical Requirements

### AWS Services (Implemented)
- [x] Amazon S3 (Static website hosting)
- [x] Amazon API Gateway (REST API)
- [x] AWS Lambda (Serverless backend logic)
- [x] Amazon DynamoDB (User data and game statistics)
- [x] Amazon Cognito (User authentication and management)
- [x] Polling-based Real-time Communication (Alternative to WebSocket)
- [x] Amazon CloudFront (Content delivery via S3)

### Integration Requirements
- [x] Polling-based real-time gameplay (250ms intervals)
- [x] REST API for user management and statistics
- [x] Frontend-backend integration

### Deployment Requirements
- [x] Serverless architecture deployment
- [x] AWS CDK for infrastructure
- [x] Manual deployment pipeline (AWS CLI + CDK)

## Constraints & Assumptions

### Constraints
- Must use native AWS services
- Must demonstrate Amazon Q Developer capabilities
- Serverless-first architecture
- Single-page web application

### Assumptions
- Players have modern web browsers with WebSocket support
- Basic internet connectivity for real-time gameplay
- Simple username-based authentication is sufficient

## Success Criteria
- [x] Two players can successfully play Rock, Paper, Scissors in real-time
- [x] Win/loss statistics are accurately tracked and displayed
- [x] Application handles player connections and disconnections gracefully
- [x] Game logic correctly determines winners (Rock beats Scissors, Scissors beats Paper, Paper beats Rock)
- [x] Leaderboard displays top players by win count
- [x] Cross-browser compatibility (Chrome, Safari, Firefox, Edge)
- [x] Repeat matchmaking reliability with page reload solution

## Implementation Notes

### Key Technical Decisions
- **Polling vs WebSocket**: Implemented 250ms polling for simplicity and reliability
- **Custom Authentication**: Built username/email system instead of Cognito for faster development
- **Page Reload Solution**: Implemented page reload for repeat matchmaking to ensure clean state
- **Cache Busting**: Added aggressive cache busting to prevent browser caching issues

### Browser Compatibility Solutions
- **Chrome Issues**: Resolved caching problems with enhanced cache busting
- **Safari Issues**: Added Safari-specific polling optimizations
- **Universal Fallback**: Implemented fallback mechanisms for all browsers

### Performance Optimizations
- **Ultra-Fast Polling**: 250ms intervals for near real-time experience
- **Efficient Database**: DynamoDB with optimized queries
- **Serverless Scaling**: Lambda functions auto-scale with demand

## Recent Enhancements (v3.0)

### Cognito Authentication
- [x] AWS Cognito User Pool integration
- [x] Email/password authentication
- [x] Email verification workflow
- [x] Guest mode for unregistered users
- [x] Secure token-based authentication
- [x] Cross-browser compatibility fixes

## Previous Enhancements (v2.0)

### Rematch System
- [x] Instant rematch between same players
- [x] Smart game joining (second player joins existing rematch)
- [x] Clean game state reset for new matches

### Game Timeouts
- [x] 1-minute timeout for active games
- [x] Automatic cleanup of timed-out games
- [x] Page reload after timeout for clean state

### Enhanced UI/UX
- [x] Separate Cancel/Play Computer buttons on waiting screen
- [x] Safari compatibility fixes
- [x] Improved error handling and user feedback
- [x] Cross-browser compatibility (Chrome, Safari, Firefox)

### Leaderboard Improvements
- [x] Top 10 players display
- [x] User rank shown even if outside top 10
- [x] Win rate percentage calculations
- [x] Highlighted user entries

## Out of Scope
- Advanced matchmaking algorithms
- Tournament brackets or advanced game modes
- Social features (chat, friends, etc.)
- Mobile app development
- Advanced analytics or reporting
- Payment or monetization features
- WebSocket implementation (replaced with polling)
- Advanced authentication (JWT, OAuth)
- Move cancellation (removed for better UX)