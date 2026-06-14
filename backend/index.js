import express from "express";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import { Shopify } from "@shopify/shopify-api";

dotenv.config();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SCOPES,
  HOST,
  SHOPIFY_API_VERSION = "2026-07",
  PORT = "3000",
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !SCOPES || !HOST) {
  throw new Error(
    "Missing required environment variables. Copy backend/.env.example to backend/.env and set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, and HOST."
  );
}

const HOST_NAME = HOST.replace(/^https?:\/\//, "").replace(/\/$/, "");

Shopify.Context.initialize({
  API_KEY: SHOPIFY_API_KEY,
  API_SECRET_KEY: SHOPIFY_API_SECRET,
  SCOPES: SCOPES.split(","),
  HOST_NAME,
  API_VERSION: SHOPIFY_API_VERSION,
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(
  cookieSession({
    name: "shopify.session",
    secret: SHOPIFY_API_SECRET,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    httpOnly: true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("B2B Free Shipping backend is running.");
});

app.get("/auth", async (req, res) => {
  const shop = req.query.shop;
  if (!shop || typeof shop !== "string") {
    return res.status(400).send("Missing shop parameter.");
  }

  try {
    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      shop,
      "/auth/callback",
      true
    );
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Auth begin failed:", error);
    return res.status(500).send("Authentication start failed.");
  }
});

app.get("/auth/callback", async (req, res) => {
  try {
    const session = await Shopify.Auth.validateAuthCallback(req, res, req.query);

    // Auto-activate the delivery customization function after OAuth
    const client = new Shopify.Clients.Graphql(session.shop, session.accessToken);
    await client.query({
      data: {
        query: `mutation {
          deliveryCustomizationCreate(deliveryCustomization: {
            functionId: "019e367b-e98b-7d6a-9509-538cb2c6e8f5"
            title: "B2B Free Shipping"
            enabled: true
          }) {
            deliveryCustomization { id enabled }
            userErrors { field message }
          }
        }`
      }
    });

    return res.redirect(\`/?shop=\${session.shop}\`);
  } catch (error) {
    console.error("Auth callback failed:", error);
    return res.status(500).send("Authentication callback failed.");
  }
});

app.post("/api/b2b-free-shipping-customization", async (req, res) => {
  try {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const client = new Shopify.Clients.Graphql({ session });
    const body = await client.query({
      data: {
        query: req.body.query,
        variables: req.body.variables ?? {},
      },
    });

    return res.status(200).json(body);
  } catch (error) {
    console.error("Delivery customization proxy failed:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal error" });
  }
});

app.listen(Number(PORT), () => {
  console.log(`Backend listening on ${HOST.replace(/\/$/, "")}`);
});
