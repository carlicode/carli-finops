/**
 * AWS configuration for Amplify.
 * These values are populated after `cdk deploy` via the outputs.
 * Run `scripts/update-config.sh` after deploying to update this file automatically.
 */
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      loginWith: {
        username: true,
        email: true,
      },
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_APPSYNC_ENDPOINT || 'https://XXXXXXXXXX.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'userPool' as const,
    },
  },
};

export default awsConfig;
