## Introduction

This is the README file for **RPS Battle Arena**, a multiplayer Rock, Paper, Scissors web application built as part of the "Disney Hack the Code Challenge", a mini hack-a-thon for building applications using Amazon Q Developer IDE experience. The project, including the files below, will be implemented by the Amazon Q Developer, through interactive discussion with the user.

## Use case

RPS Battle Arena provides an engaging multiplayer gaming experience where users can play the classic Rock, Paper, Scissors game against other online players in real-time. The application solves the problem of finding opponents for this simple yet entertaining game, while adding competitive elements through win tracking and leaderboards. This creates a fun, accessible gaming platform that brings people together for quick, casual gameplay sessions.

## Value proposition

RPS Battle Arena delivers instant entertainment value through:
- **Real-time multiplayer gameplay** - No waiting for turns, immediate game resolution
- **Competitive tracking** - Personal statistics and leaderboards motivate continued play
- **Zero setup required** - Browser-based gameplay with simple authentication
- **Scalable architecture** - Built on AWS serverless technology for reliable performance
- **Cost-effective solution** - Demonstrates how to build engaging multiplayer experiences using AWS native services efficiently

## Development approach

When working with this project, the agent should ensure it is working within a git repo. If one is not configured yet, the agent should create one.

The agent should update and extend this README.md file with additional information about the project as development progresses, and commit changes to this file and the other planning files below as they are updated.

Working with the user, the agent will implement the project step by step, first by working out the requirements, then the design/architecture including AWS infrastructure components, then the list of tasks needed to: 1) implement the project source code and any AWS infrastructure required, 2) steps to deploy the application and infrastructure components, 3) run any integration tests against the deployed project.

Once all planning steps are completed and documented, and the user is ready to proceed, the agent will begin implementing the tasks one at a time until the project is completed.

## 🚀 Live Application

**Standalone Game**: Open `rps-battle-arena.html` in your browser
**API URL**: https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/

> Note: S3 frontend has permission issues. Use the standalone HTML file for immediate access.

### API Endpoints
- `POST /auth` - User authentication
- `GET /leaderboard` - Top players leaderboard  
- `GET /stats/{userId}` - User statistics
- `POST /game` - Play Rock Paper Scissors

### Test the API
```bash
# Get leaderboard
curl "https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/leaderboard"

# Play a game
curl -X POST "https://19qwltuxoi.execute-api.us-east-1.amazonaws.com/prod/game" \
  -H "Content-Type: application/json" \
  -d '{"action":"play","move":"rock"}'
```

## Project layout 

* requirements.md: Defines the requirements for this project
* design.md: Defines the design and architecture for this project
* tasks.md: Lists the discrete tasks that need to be executed in order to successfully implement the project
* infrastructure/: AWS CDK Java project for infrastructure deployment
* src/: Lambda function source code (Node.js)
* frontend/: Web application (HTML/CSS/JavaScript)

## Deployment Architecture

- **Frontend**: S3 Static Website Hosting
- **Backend**: AWS Lambda + API Gateway
- **Database**: Amazon DynamoDB
- **Infrastructure**: AWS CDK (Java)

