import { handler } from "../netlify/functions/mindcare";
import assert from "node:assert/strict";

async function main() {
  const event = {
    path: "/.netlify/functions/mindcare/api/health", httpMethod: "GET", headers: {},
    queryStringParameters: {}, multiValueQueryStringParameters: {},
    requestContext: { identity: { sourceIp: "127.0.0.1" } }, body: null, isBase64Encoded: false,
  };
  const health = await handler(event, {});
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).status, "ok");
  const invalid = await handler({ ...event, path: "/.netlify/functions/mindcare/api/speak", httpMethod: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "test", language: "invalid" }) }, {});
  assert.equal(invalid.statusCode, 400);
  console.log("PASS Netlify function path mapping, health endpoint and request validation");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
