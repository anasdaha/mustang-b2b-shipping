// @ts-check

/**
 * @typedef {import("../generated/api").Input} Input
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/** @type {CartDeliveryOptionsTransformRunResult} */
const NO_CHANGES = { operations: [] };

// ---------------------------------------------------------------------------
// B2B free shipping rate title — must EXACTLY match the rate name in:
// Shopify Admin → Settings → Shipping and Delivery → Manage rates
// ---------------------------------------------------------------------------
const RATE_B2B_FREE = 'dealer free shipping';

// ---------------------------------------------------------------------------
// D2C allowed rates per country.
// These are the EXACT rate names from your shipping zones.
// D2C customers will only see rates listed here for their country.
// "Dealer Free Shipping" is never listed here so D2C never sees it.
// ---------------------------------------------------------------------------
/** @type {Record<string, string[]>} */
const D2C_ALLOWED_RATES_BY_COUNTRY = {
  // US has 3 zones with different rate names — allow all of them
  US: [
    'Flat Rate Shipping',  // US Zone 2 - Mid
    'Flat Shipping',       // US Zone 1 - Near and Zone 3 - Far
  ],
  // Canada zones
  CA: [
    'Flat Shipping *does not include duties or taxes*',
  ],
  // All other countries (International zones)
  DEFAULT: [
    'Flat Shipping *does not include duties or taxes*',
  ],
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
  // Customer belongs to a B2B company.
  // If free_shipping metafield = true → show ONLY "Dealer Free Shipping"
  // If free_shipping metafield = false/not set → hide ALL rates
  // -------------------------------------------------------------------------
  if (purchasingCompany) {
    const freeShippingEnabled =
      purchasingCompany.company?.metafield?.value === 'true';

    if (!freeShippingEnabled) {
      // B2B company without free shipping — hide ALL rates
      // They should contact the store for shipping arrangements
      for (const group of deliveryGroups) {
        for (const option of group.deliveryOptions) {
          operations.push({
            deliveryOptionHide: { deliveryOptionHandle: option.handle },
          });
        }
      }
      return { operations };
    }

    // Eligible B2B → hide everything except "Dealer Free Shipping"
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
  // Non-B2B customer. Show only their region's rates.
  // "Dealer Free Shipping" is not in any allowed list so it's always hidden.
  // -------------------------------------------------------------------------
  const countryCode =
    deliveryGroups[0]?.deliveryAddress?.countryCode ?? 'DEFAULT';

  const allowedRates =
    D2C_ALLOWED_RATES_BY_COUNTRY[/** @type {string} */ (countryCode)] ??
    D2C_ALLOWED_RATES_BY_COUNTRY['DEFAULT'];

  // No filter configured → show all rates
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