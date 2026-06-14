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

const FUNCTION_ID = "019e367b-e98b-7d6a-9509-538cb2c6e8f5";
const CUSTOMIZATION_TITLE = "B2B Free Shipping";
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

// Helper: get GraphQL client for current session
async function getClient(req, res) {
  const session = await Shopify.Utils.loadCurrentSession(req, res, true);
  if (!session) return null;
  return new Shopify.Clients.Graphql(session.shop, session.accessToken);
}

// Helper: get existing delivery customization ID
async function getCustomizationId(client) {
  const result = await client.query({
    data: {
      query: `{
        deliveryCustomizations(first: 20) {
          nodes { id title enabled }
        }
      }`,
    },
  });
  const nodes = result.body.data.deliveryCustomizations.nodes;
  return nodes.find((n) => n.title === CUSTOMIZATION_TITLE) || null;
}

// Home page — show current status + enable/disable buttons
app.get("/", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.send(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h1>B2B Free Shipping</h1>
        <p>No shop detected. Please install the app via Shopify Admin.</p>
      </body></html>
    `);
  }

  try {
    const client = await getClient(req, res);
    if (!client) {
      return res.redirect(`/auth?shop=${shop}`);
    }

    const customization = await getCustomizationId(client);
    const isActive = customization?.enabled === true;
    const statusColor = isActive ? "#008060" : "#d72c0d";
    const statusText = isActive ? "Active" : "Inactive";

    return res.send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:600px">
        <h1>B2B Free Shipping</h1>
        <p>Status: <strong style="color:${statusColor}">${statusText}</strong></p>
        ${isActive
          ? `<form method="POST" action="/deactivate?shop=${shop}">
               <button type="submit" style="background:#d72c0d;color:white;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-size:16px">
                 Disable Function
               </button>
             </form>`
          : `<form method="POST" action="/activate?shop=${shop}">
               <button type="submit" style="background:#008060;color:white;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-size:16px">
                 Enable Function
               </button>
             </form>`
        }
      </body></html>
    `);
  } catch (err) {
    console.error("Home error:", err);
    return res.redirect(`/auth?shop=${shop}`);
  }
});

// Activate the function
app.post("/activate", async (req, res) => {
  const shop = req.query.shop;
  try {
    const client = await getClient(req, res);
    if (!client) return res.redirect(`/auth?shop=${shop}`);

    await client.query({
      data: {
        query: `mutation {
          deliveryCustomizationCreate(deliveryCustomization: {
            functionId: "${FUNCTION_ID}"
            title: "${CUSTOMIZATION_TITLE}"
            enabled: true
          }) {
            deliveryCustomization { id enabled }
            userErrors { field message }
          }
        }`,
      },
    });

    return res.redirect(`/?shop=${shop}`);
  } catch (err) {
    console.error("Activate error:", err);
    return res.status(500).send("Failed to activate function.");
  }
});

// Deactivate the function
app.post("/deactivate", async (req, res) => {
  const shop = req.query.shop;
  try {
    const client = await getClient(req, res);
    if (!client) return res.redirect(`/auth?shop=${shop}`);

    const customization = await getCustomizationId(client);
    if (customization) {
      await client.query({
        data: {
          query: `mutation {
            deliveryCustomizationDelete(id: "${customization.id}") {
              deletedId
              userErrors { field message }
            }
          }`,
        },
      });
    }

    return res.redirect(`/?shop=${shop}`);
  } catch (err) {
    console.error("Deactivate error:", err);
    return res.status(500).send("Failed to deactivate function.");
  }
});

// Auth start
app.get("/auth", async (req, res) => {
  const shop = req.query.shop;
  if (!shop || typeof shop !== "string") {
    return res.status(400).send("Missing shop parameter.");
  }
  try {
    const redirectUrl = await Shopify.Auth.beginAuth(req, res, shop, "/auth/callback", true);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Auth begin failed:", error);
    return res.status(500).send("Authentication start failed.");
  }
});

// Auth callback
app.get("/auth/callback", async (req, res) => {
  try {
    const session = await Shopify.Auth.validateAuthCallback(req, res, req.query);
    return res.redirect(`/?shop=${session.shop}`);
  } catch (error) {
    console.error("Auth callback failed:", error);
    return res.status(500).send("Authentication callback failed.");
  }
});

// GraphQL proxy
app.post("/api/b2b-free-shipping-customization", async (req, res) => {
  try {
    const session = await Shopify.Utils.loadCurrentSession(req, res, true);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const client = new Shopify.Clients.Graphql(session.shop, session.accessToken);
    const body = await client.query({
      data: {
        query: req.body.query,
        variables: req.body.variables ?? {},
      },
    });

    return res.status(200).json(body);
  } catch (error) {
    console.error("Proxy failed:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Internal error" });
  }
});

app.listen(Number(PORT), () => {
  console.log(`Backend listening on ${HOST.replace(/\/$/, "")}`);
});