import os
import aws_cdk as cdk
from stacks.finops_stack import FinopsStack

app = cdk.App()

FinopsStack(
    app,
    "CarliFinopsStack",
    env=cdk.Environment(
        # Uses CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION or explicit env vars
        account=os.environ.get("CDK_DEPLOY_ACCOUNT", os.environ.get("CDK_DEFAULT_ACCOUNT")),
        region=os.environ.get("CDK_DEPLOY_REGION", os.environ.get("CDK_DEFAULT_REGION", "us-east-1")),
    ),
    description="Carli FinOps - Personal expense tracker with Telegram bot and web dashboard",
)

app.synth()
