import serverless from "serverless-http";
import app from "../../src/server";

const run = serverless(app, { binary: ["audio/*", "application/octet-stream"] });

export const handler = async (event: any, context: any) => {
  const prefix = "/.netlify/functions/mindcare";
  const path = event.path.startsWith(prefix) ? event.path.slice(prefix.length) || "/" : event.path;
  return run({ ...event, path }, context);
};
