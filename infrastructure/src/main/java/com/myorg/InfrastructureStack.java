package com.myorg;

import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.cognito.*;
import software.amazon.awscdk.services.lambda.*;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.apigateway.*;
import software.amazon.awscdk.services.apigatewayv2.*;
import software.amazon.awscdk.services.apigatewayv2.integrations.*;
import software.amazon.awscdk.services.s3.*;
import software.amazon.awscdk.services.cloudfront.*;
import software.amazon.awscdk.services.cloudfront.origins.*;
import software.amazon.awscdk.services.iam.*;
import java.util.Map;
import java.util.List;

public class InfrastructureStack extends Stack {
    public InfrastructureStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public InfrastructureStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        // DynamoDB Tables
        Table usersTable = Table.Builder.create(this, "RpsUsersTable")
                .tableName("rps-users")
                .partitionKey(Attribute.builder()
                        .name("userId")
                        .type(AttributeType.STRING)
                        .build())
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .build();

        Table gamesTable = Table.Builder.create(this, "RpsGamesTable")
                .tableName("rps-games")
                .partitionKey(Attribute.builder()
                        .name("gameId")
                        .type(AttributeType.STRING)
                        .build())
                .sortKey(Attribute.builder()
                        .name("timestamp")
                        .type(AttributeType.STRING)
                        .build())
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .build();

        Table connectionsTable = Table.Builder.create(this, "RpsConnectionsTable")
                .tableName("rps-connections")
                .partitionKey(Attribute.builder()
                        .name("connectionId")
                        .type(AttributeType.STRING)
                        .build())
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .timeToLiveAttribute("ttl")
                .build();

        // Cognito User Pool
        UserPool userPool = UserPool.Builder.create(this, "RpsUserPool")
                .userPoolName("rps-user-pool")
                .selfSignUpEnabled(true)
                .signInAliases(SignInAliases.builder()
                        .email(true)
                        .username(true)
                        .build())
                .passwordPolicy(PasswordPolicy.builder()
                        .minLength(8)
                        .requireLowercase(true)
                        .requireUppercase(true)
                        .requireDigits(true)
                        .build())
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .build();

        UserPoolClient userPoolClient = UserPoolClient.Builder.create(this, "RpsUserPoolClient")
                .userPool(userPool)
                .generateSecret(false)
                .authFlows(AuthFlow.builder()
                        .userPassword(true)
                        .userSrp(true)
                        .build())
                .build();

        // Lambda Functions
        Function authFunction = Function.Builder.create(this, "RpsAuthFunction")
                .runtime(Runtime.NODEJS_18_X)
                .handler("index.handler")
                .code(Code.fromAsset("../src/handlers/auth"))
                .environment(Map.of(
                        "USERS_TABLE", usersTable.getTableName(),
                        "USER_POOL_ID", userPool.getUserPoolId(),
                        "USER_POOL_CLIENT_ID", userPoolClient.getUserPoolClientId()
                ))
                .timeout(Duration.seconds(30))
                .build();

        Function gameFunction = Function.Builder.create(this, "RpsGameFunction")
                .runtime(Runtime.NODEJS_18_X)
                .handler("index.handler")
                .code(Code.fromAsset("../src/handlers/game"))
                .environment(Map.of(
                        "USERS_TABLE", usersTable.getTableName(),
                        "GAMES_TABLE", gamesTable.getTableName()
                ))
                .timeout(Duration.seconds(30))
                .build();

        Function websocketFunction = Function.Builder.create(this, "RpsWebSocketFunction")
                .runtime(Runtime.NODEJS_18_X)
                .handler("index.handler")
                .code(Code.fromAsset("../src/handlers/websocket"))
                .environment(Map.of(
                        "CONNECTIONS_TABLE", connectionsTable.getTableName(),
                        "GAMES_TABLE", gamesTable.getTableName(),
                        "USERS_TABLE", usersTable.getTableName()
                ))
                .timeout(Duration.seconds(30))
                .build();

        // Grant permissions
        usersTable.grantReadWriteData(authFunction);
        usersTable.grantReadWriteData(gameFunction);
        usersTable.grantReadWriteData(websocketFunction);
        gamesTable.grantReadWriteData(gameFunction);
        gamesTable.grantReadWriteData(websocketFunction);
        connectionsTable.grantReadWriteData(websocketFunction);

        // REST API Gateway
        RestApi api = RestApi.Builder.create(this, "RpsRestApi")
                .restApiName("rps-battle-arena-api")
                .description("REST API for RPS Battle Arena")
                .defaultCorsPreflightOptions(CorsOptions.builder()
                        .allowOrigins(List.of("*"))
                        .allowMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"))
                        .allowHeaders(List.of("Content-Type", "Authorization"))
                        .build())
                .build();

        // API Resources
        Resource authResource = api.getRoot().addResource("auth");
        authResource.addMethod("POST", new LambdaIntegration(authFunction));
        
        Resource statsResource = api.getRoot().addResource("stats");
        Resource userStatsResource = statsResource.addResource("{userId}");
        userStatsResource.addMethod("GET", new LambdaIntegration(gameFunction));
        
        Resource leaderboardResource = api.getRoot().addResource("leaderboard");
        leaderboardResource.addMethod("GET", new LambdaIntegration(gameFunction));

        // WebSocket API
        WebSocketApi webSocketApi = WebSocketApi.Builder.create(this, "RpsWebSocketApi")
                .apiName("rps-websocket-api")
                .description("WebSocket API for RPS Battle Arena real-time communication")
                .build();

        WebSocketStage webSocketStage = WebSocketStage.Builder.create(this, "RpsWebSocketStage")
                .webSocketApi(webSocketApi)
                .stageName("prod")
                .autoDeploy(true)
                .build();

        // WebSocket Routes
        webSocketApi.addRoute("$connect", WebSocketLambdaIntegration.Builder.create(websocketFunction).build());
        webSocketApi.addRoute("$disconnect", WebSocketLambdaIntegration.Builder.create(websocketFunction).build());
        webSocketApi.addRoute("join_queue", WebSocketLambdaIntegration.Builder.create(websocketFunction).build());
        webSocketApi.addRoute("make_move", WebSocketLambdaIntegration.Builder.create(websocketFunction).build());

        // Grant WebSocket permissions
        websocketFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .actions(List.of("execute-api:ManageConnections"))
                .resources(List.of(webSocketStage.getArn() + "/*"))
                .build());

        // S3 Bucket for frontend
        Bucket websiteBucket = Bucket.Builder.create(this, "RpsWebsiteBucket")
                .bucketName("rps-battle-arena-frontend")
                .websiteIndexDocument("index.html")
                .websiteErrorDocument("error.html")
                .publicReadAccess(true)
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .autoDeleteObjects(true)
                .build();

        // CloudFront Distribution
        Distribution distribution = Distribution.Builder.create(this, "RpsDistribution")
                .defaultBehavior(BehaviorOptions.builder()
                        .origin(new S3Origin(websiteBucket))
                        .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
                        .build())
                .defaultRootObject("index.html")
                .build();

        // Outputs
        software.amazon.awscdk.CfnOutput.Builder.create(this, "RestApiUrl")
                .value(api.getUrl())
                .description("REST API URL")
                .build();

        software.amazon.awscdk.CfnOutput.Builder.create(this, "WebSocketApiUrl")
                .value(webSocketStage.getUrl())
                .description("WebSocket API URL")
                .build();

        software.amazon.awscdk.CfnOutput.Builder.create(this, "WebsiteUrl")
                .value("https://" + distribution.getDistributionDomainName())
                .description("Website URL")
                .build();

        software.amazon.awscdk.CfnOutput.Builder.create(this, "UserPoolId")
                .value(userPool.getUserPoolId())
                .description("Cognito User Pool ID")
                .build();

        software.amazon.awscdk.CfnOutput.Builder.create(this, "UserPoolClientId")
                .value(userPoolClient.getUserPoolClientId())
                .description("Cognito User Pool Client ID")
                .build();
    }
}
