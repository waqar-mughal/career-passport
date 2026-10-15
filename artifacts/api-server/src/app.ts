import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiErrorHandler } from "./lib/errors";
import type { CareerPassportRuntime } from "./lib/runtime";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

export function createApp(runtime: CareerPassportRuntime = {}) {
  const app = express();
  app.locals.careerPassportRuntime = runtime;

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // This resolver can only be supplied when the app is constructed in-process;
  // it is not configurable through an HTTP header or environment variable.
  if (runtime.resolveIdentity) {
    app.use(async (req, res, next) => {
      try {
        const identity = await runtime.resolveIdentity?.(req);
        if (identity) {
          (req as typeof req & { careerPassportTestIdentity?: typeof identity })
            .careerPassportTestIdentity = identity;
        }
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  // Clerk's proxy must run before body parsing so streamed proxy requests remain
  // intact. Pino strips query strings so invitation tokens are never logged.
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
  app.use("/api", router);
  app.use(apiErrorHandler);
  return app;
}

const app = createApp();
export default app;
