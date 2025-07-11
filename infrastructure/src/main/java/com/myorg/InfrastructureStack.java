package com.myorg;

import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.lambda.*;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.apigateway.*;
import software.amazon.awscdk.services.apigatewayv2.*;

import software.amazon.awscdk.services.s3.*;
import software.amazon.awscdk.services.cloudfront.*;
import software.amazon.awscdk.services.cloudfront.origins.*;
import software.amazon.awscdk.CfnOutput;
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
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .removalPolicy(software.amazon.awscdk.RemovalPolicy.DESTROY)
                .build();

        // Lambda Functions
        software.amazon.awscdk.services.lambda.Function gameFunction = software.amazon.awscdk.services.lambda.Function.Builder.create(this, "RpsGameFunction")
                .runtime(Runtime.NODEJS_18_X)
                .handler("index.handler")
                .code(Code.fromAsset("../src"))
                .environment(Map.of(
                        "USERS_TABLE", usersTable.getTableName(),
                        "GAMES_TABLE", gamesTable.getTableName()
                ))
                .timeout(Duration.seconds(30))
                .build();

        // Grant permissions
        usersTable.grantReadWriteData(gameFunction);
        gamesTable.grantReadWriteData(gameFunction);

        // REST API Gateway
        RestApi api = RestApi.Builder.create(this, "RpsRestApi")
                .restApiName("rps-battle-arena-api")
                .description("REST API for RPS Battle Arena")
                .defaultCorsPreflightOptions(CorsOptions.builder()
                        .allowOrigins(List.of("*"))
                        .allowMethods(List.of("GET", "POST", "OPTIONS"))
                        .allowHeaders(List.of("Content-Type", "Authorization"))
                        .build())
                .build();

        // API Resources
        Resource authResource = api.getRoot().addResource("auth");
        authResource.addMethod("POST", new LambdaIntegration(gameFunction));
        
        Resource statsResource = api.getRoot().addResource("stats");
        Resource userStatsResource = statsResource.addResource("{userId}");
        userStatsResource.addMethod("GET", new LambdaIntegration(gameFunction));
        
        Resource leaderboardResource = api.getRoot().addResource("leaderboard");
        leaderboardResource.addMethod("GET", new LambdaIntegration(gameFunction));

        Resource gameResource = api.getRoot().addResource("game");
        gameResource.addMethod("POST", new LambdaIntegration(gameFunction));
        
        Resource gamesResource = api.getRoot().addResource("games");
        Resource userGamesResource = gamesResource.addResource("{userId}");
        userGamesResource.addMethod("GET", new LambdaIntegration(gameFunction));

        // S3 Bucket removed for simplified deployment

        // Outputs
        CfnOutput.Builder.create(this, "RestApiUrl")
                .value(api.getUrl())
                .description("REST API URL")
                .build();

        // Website URL output removed for simplified deployment
    }
}
