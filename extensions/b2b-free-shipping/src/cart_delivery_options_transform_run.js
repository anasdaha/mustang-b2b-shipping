// @ts-check

/**
 * @typedef {import("../generated/api").Input} Input
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/** @type {CartDeliveryOptionsTransformRunResult} */
const NO_CHANGES = { operations: [] };

// ---------------------------------------------------------------------------
// The title of the free shipping rate for B2B customers.
// Must EXACTLY match the rate name in:
// Shopify Admin → Settings → Shipping and Delivery → Manage rates
// ---------------------------------------------------------------------------
const RATE_B2B_FREE = 'dealer free shipping';

// ---------------------------------------------------------------------------
// Regional shipping rates for D2C (non-B2B) customers.
// Must EXACTLY match rate titles in Shopify Admin → Shipping and Delivery.
// Set a country to null to show all rates for that country without filtering.
// ---------------------------------------------------------------------------
const D2C_ALLOWED_RATES_BY_COUNTRY = {
  PK: ['Standard Shipping - Pakistan', 'Express Shipping - Pakistan'],
  GB: ['Standard Shipping - UK', 'Express Shipping - UK'],
  US: ['Standard Shipping - US', 'Express Shipping - US'],
  AE: ['Standard Shipping - UAE'],
  DEFAULT: null, // unlisted countries → no filtering, all rates shown
};

/**
 * @param {Input} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {

  /** @type {CartDeliveryOptionsTransformRunResult["operations"]} */
  const operations = [];

  const purchasingCompany = input.cart?.buyerIdentity?.purchasingCompany;
  const deliveryGroups    = input.cart?.deliveryGroups ?? [];

  // -------------------------------------------------------------------------
  // B2B PATH
  // Customer belongs to a company. Check if free shipping is enabled via
  // the company metafield "custom.free_shipping = true".
  // -------------------------------------------------------------------------
  if (purchasingCompany) {
    const freeShippingEnabled =
      purchasingCompany.company?.metafield?.value === 'true';

    // Company not eligible → no changes, show whatever rates exist
    if (!freeShippingEnabled) return NO_CHANGES;

    // Eligible → hide everything except "Dealer Free Shipping"
    for (const group of deliveryGroups) {
      for (const option of group.deliveryOptions) {
        const title = option.title?.toLowerCase() || '';
        if (!title.includes(RATE_B2B_FREE)) {
          operations.push({
            deliveryOptionHide: { deliveryOptionHandle: option.handle },
          });
        }
      }
    }

    return { operations };
  }

  // -------------------------------------------------------------------------
  // D2C PATH
  // Non-B2B customer. Filter visible rates by their shipping country.
  // -------------------------------------------------------------------------
  const countryCode =
    deliveryGroups[0]?.deliveryAddress?.countryCode ?? 'DEFAULT';

  const allowedRates =
    D2C_ALLOWED_RATES_BY_COUNTRY[countryCode] ??
    D2C_ALLOWED_RATES_BY_COUNTRY['DEFAULT'];

  // No filter configured for this country → show all rates
  if (!allowedRates) return NO_CHANGES;

  const allowedLower = allowedRates.map((r) => r.toLowerCase());

  for (const group of deliveryGroups) {
    for (const option of group.deliveryOptions) {
      const title = option.title?.toLowerCase() || '';
      if (!allowedLower.includes(title)) {
        operations.push({
          deliveryOptionHide: { deliveryOptionHandle: option.handle },
        });
      }
    }
  }

  return { operations };
}
