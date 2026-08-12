import { handler as getMarkets } from '../lambda/get-markets.js';

const run = async () => {
  const result = await getMarkets({
    body: null,
    headers: {
      origin: 'http://localhost:3001',
    },
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/markets',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '/markets',
  } as any);

  console.log(result.statusCode);
  console.log(result.body);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
