import os
import aws_cdk as cdk
from aws_cdk import (
    aws_dynamodb as dynamodb,
    aws_cognito as cognito,
    aws_lambda as lambda_,
    aws_iam as iam,
    aws_appsync as appsync,
    aws_logs as logs,
    Duration,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct


# Set via environment variable or AWS SSM — never hardcode here
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "carli")


class FinopsStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── DynamoDB ────────────────────────────────────────────────────────────
        expenses_table = dynamodb.Table(
            self,
            "ExpensesTable",
            table_name="carli-finops-expenses",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="expenseId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
        )
        expenses_table.add_global_secondary_index(
            index_name="month-createdAt-index",
            partition_key=dynamodb.Attribute(name="month", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="createdAt", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # Bot session state (TTL 24h, so it's cheap and auto-cleans)
        sessions_table = dynamodb.Table(
            self,
            "SessionsTable",
            table_name="carli-finops-sessions",
            partition_key=dynamodb.Attribute(name="chatId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
            time_to_live_attribute="ttl",
        )

        # ── Cognito ─────────────────────────────────────────────────────────────
        user_pool = cognito.UserPool(
            self,
            "FinopsUserPool",
            user_pool_name="carli-finops-users",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(username=True, email=True),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )

        user_pool_client = user_pool.add_client(
            "FinopsWebClient",
            user_pool_client_name="carli-finops-web",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(implicit_code_grant=True),
                scopes=[cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
            ),
        )

        # ── Lambda shared layer / role ───────────────────────────────────────────
        lambda_role = iam.Role(
            self,
            "LambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole"),
            ],
        )
        lambda_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                ],
                resources=["*"],
            )
        )
        expenses_table.grant_read_write_data(lambda_role)
        sessions_table.grant_read_write_data(lambda_role)

        # ── AppSync GraphQL API ──────────────────────────────────────────────────
        graphql_api = appsync.GraphqlApi(
            self,
            "FinopsApi",
            name="carli-finops-api",
            definition=appsync.Definition.from_file(
                os.path.join(os.path.dirname(__file__), "..", "schema.graphql")
            ),
            authorization_config=appsync.AuthorizationConfig(
                default_authorization=appsync.AuthorizationMode(
                    authorization_type=appsync.AuthorizationType.USER_POOL,
                    user_pool_config=appsync.UserPoolConfig(user_pool=user_pool),
                ),
                additional_authorization_modes=[
                    appsync.AuthorizationMode(
                        authorization_type=appsync.AuthorizationType.API_KEY,
                        api_key_config=appsync.ApiKeyConfig(
                            description="Bot and internal Lambda access",
                            expires=cdk.Expiration.after(Duration.days(365)),
                        ),
                    ),
                ],
            ),
            log_config=appsync.LogConfig(
                field_log_level=appsync.FieldLogLevel.ERROR,
            ),
            xray_enabled=False,
        )

        # ── AppSync Resolver Lambda ──────────────────────────────────────────────
        resolver_log_group = logs.LogGroup(
            self, "ResolverLogGroup",
            log_group_name=f"/aws/lambda/carli-finops-graphql-resolver",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.DESTROY,
        )
        resolver_fn = lambda_.Function(
            self,
            "GraphQLResolver",
            function_name="carli-finops-graphql-resolver",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset("../backend/expenses_api"),
            timeout=Duration.seconds(29),
            memory_size=256,
            role=lambda_role,
            environment={
                "EXPENSES_TABLE": expenses_table.table_name,
                "OWNER_USER_ID": OWNER_USER_ID,
                "REGION": self.region,
            },
            log_group=resolver_log_group,
        )

        lambda_ds = graphql_api.add_lambda_data_source("ResolverDS", resolver_fn)

        for field in ["listExpenses", "getMonthSummary"]:
            lambda_ds.create_resolver(
                f"Query{field}Resolver",
                type_name="Query",
                field_name=field,
            )
        for field in ["createExpense", "deleteExpense"]:
            lambda_ds.create_resolver(
                f"Mutation{field}Resolver",
                type_name="Mutation",
                field_name=field,
            )

        # Grant AppSync permission to invoke resolver Lambda
        graphql_api.grant_mutation(lambda_role, "createExpense", "deleteExpense")

        # ── Telegram Bot Lambda ──────────────────────────────────────────────────
        bot_fn = lambda_.Function(
            self,
            "TelegramBot",
            function_name="carli-finops-telegram-bot",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            # The deploy script pre-builds this directory with pip install
            code=lambda_.Code.from_asset("../backend/telegram_bot_build"),
            timeout=Duration.seconds(60),
            memory_size=512,
            role=lambda_role,
            environment={
                "TELEGRAM_BOT_TOKEN": TELEGRAM_BOT_TOKEN,
                "SESSIONS_TABLE": sessions_table.table_name,
                "EXPENSES_TABLE": expenses_table.table_name,
                "APPSYNC_ENDPOINT": graphql_api.graphql_url,
                "APPSYNC_API_KEY": graphql_api.api_key or "",
                "OWNER_USER_ID": OWNER_USER_ID,
                "REGION": self.region,
                "BEDROCK_REGION": "us-east-1",
            },
            log_group=logs.LogGroup(
                self, "BotLogGroup",
                log_group_name="/aws/lambda/carli-finops-telegram-bot",
                retention=logs.RetentionDays.ONE_MONTH,
                removal_policy=RemovalPolicy.DESTROY,
            ),
        )

        # API Gateway for Telegram webhook
        from aws_cdk import aws_apigateway as apigateway

        webhook_api = apigateway.RestApi(
            self,
            "WebhookApi",
            rest_api_name="carli-finops-webhook",
            description="Telegram bot webhook endpoint",
            deploy_options=apigateway.StageOptions(
                stage_name="prod",
                throttling_burst_limit=10,
                throttling_rate_limit=5,
            ),
        )

        webhook_resource = webhook_api.root.add_resource("webhook")
        webhook_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(bot_fn, proxy=True),
        )

        # ── Outputs ──────────────────────────────────────────────────────────────
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, export_name="CarliFinops-UserPoolId")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, export_name="CarliFinops-UserPoolClientId")
        CfnOutput(self, "AppSyncEndpoint", value=graphql_api.graphql_url, export_name="CarliFinops-AppSyncEndpoint")
        CfnOutput(self, "AppSyncApiKey", value=graphql_api.api_key or "", export_name="CarliFinops-AppSyncApiKey")
        CfnOutput(self, "WebhookUrl", value=f"{webhook_api.url}webhook", export_name="CarliFinops-WebhookUrl")
        CfnOutput(self, "ExpensesTableName", value=expenses_table.table_name)
