import { buildApp } from "./application.js";

let appPromise: ReturnType<typeof buildApp> | null = null;

async function getApp() {
  if (!appPromise) appPromise = buildApp();
  const app = await appPromise;
  await app.ready();
  return app;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
