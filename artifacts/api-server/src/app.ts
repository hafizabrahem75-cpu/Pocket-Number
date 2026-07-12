import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow only this app's own domain(s) — the frontend and API are served
// behind the same Replit domain(s) via path-based routing, so no other
// origin legitimately needs cross-origin access. REPLIT_DOMAINS /
// REPLIT_DEV_DOMAIN are provided by the Replit environment; both dev and
// deployed domains are included since either may be present depending on
// environment.
const allowedOrigins = new Set(
  [process.env.REPLIT_DOMAINS, process.env.REPLIT_DEV_DOMAIN]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((domain) => `https://${domain.trim()}`),
);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests (no Origin header, e.g. server-to-server,
      // curl) are always allowed; browser cross-origin requests are only
      // allowed from this app's own known domain(s).
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      const corsError = Object.assign(new Error("Not allowed by CORS"), { status: 403 });
      callback(corsError);
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be registered last. Returns a controlled JSON
// error instead of leaking stack traces or falling through to Express's
// default HTML error page.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled request error");

  if (res.headersSent) {
    return;
  }

  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;

  res.status(status).json({ error: "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً" });
});

export default app;
