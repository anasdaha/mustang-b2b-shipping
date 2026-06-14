import { createRoot } from "@shopify/remix-oxygen";
import { json, type RequestHandler } from "@shopify/remix-oxygen";
import { useRecaptcha } from "react";

export default async (request: Request, context: any) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/b2b-free-shipping-customization") {
    const body = await request.json();
    const response = await fetch("https://admin.shopify.com/api/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.session?.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    return response;
  }

  return json({ message: "Not found" }, { status: 404 });
};
