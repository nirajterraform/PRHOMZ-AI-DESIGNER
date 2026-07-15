import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requireAuth, requireVerifiedEmail, AuthedRequest } from "./middleware/auth";
import { requireOidc } from "./middleware/oidc";
import { ApiError } from "./lib/apiError";
import { handleProxyGenerateImage } from "./proxyGenerateImage";
import { handleProxyRemodel } from "./proxyRemodel";
import { handleDeleteAccount } from "./deleteAccount";
import { handleProxyChat } from "./proxyChat";
import { handleProxyGenerateProductList } from "./proxyGenerateProductList";
import { handleProxySwapProduct } from "./proxySwapProduct";
import { handleProxyShopifySearch } from "./proxyShopifySearch";
import { handleProxyCreateCheckoutSession } from "./proxyCreateCheckoutSession";
import { handleProxyCreateCustomerPortalSession } from "./proxyCreateCustomerPortalSession";
import { handleOnSignup } from "./onUserCreate";
import { handleExpireOldImages } from "./expireOldImages";
import { handleOnGalleryFinalize } from "./onGalleryImageFinalize";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "prhomz-api" });
});

const wrap =
  <T,>(fn: (req: AuthedRequest) => Promise<T>) =>
  async (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const result = await fn(req);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

// --- End-user proxy routes (Firebase ID token + email verified) ---

app.post(
  "/proxyGenerateImage",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyGenerateImage(req.user!.uid, req.body)),
);

app.post(
  "/proxyRemodel",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyRemodel(req.user!.uid, req.body)),
);

app.post(
  "/proxyChat",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyChat(req.body)),
);

app.post(
  "/proxyGenerateProductList",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyGenerateProductList(req.body)),
);

app.post(
  "/proxySwapProduct",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxySwapProduct(req.body)),
);

app.post(
  "/proxyShopifySearch",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyShopifySearch(req.body)),
);

app.post(
  "/proxyCreateCheckoutSession",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) =>
    handleProxyCreateCheckoutSession(req.user!.uid, req.user!.email, req.body),
  ),
);

app.post(
  "/proxyCreateCustomerPortalSession",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleProxyCreateCustomerPortalSession(req.user!.uid, req.body)),
);

// Soft-deletes the calling user's account: cancels Stripe subscription,
// anonymizes feedback, marks deletedAt + hardDeleteAt, disables Auth user.
// Frontend signs out immediately on success.
app.post(
  "/deleteAccount",
  requireAuth,
  requireVerifiedEmail,
  wrap((req) => handleDeleteAccount(req.user!.uid)),
);

// --- Internal routes ---

// Post-signup user-doc bootstrap. Called by the frontend right after
// createUserWithEmailAndPassword. Firebase ID token required, but email is not
// yet verified at this point so we skip requireVerifiedEmail.
app.post(
  "/internal/onSignup",
  requireAuth,
  wrap((req) => handleOnSignup(req.user!.uid, req.user!.email, req.body?.profile)),
);

// Scheduled sweep — Cloud Scheduler hits this hourly with an OIDC token.
app.post(
  "/internal/expireOldImages",
  requireOidc,
  wrap(() => handleExpireOldImages()),
);

// Eventarc binary-mode delivery for GCS object-finalize on the gallery bucket.
// The body is the GCS object metadata JSON; OIDC token from the Eventarc SA.
app.post(
  "/internal/onGalleryFinalize",
  requireOidc,
  wrap((req) => handleOnGalleryFinalize(req.body)),
);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
      return;
    }
    console.error(
      JSON.stringify({ severity: "ERROR", error: err.message, stack: err.stack }),
    );
    res.status(500).json({ error: "internal" });
  },
);

export default app;
