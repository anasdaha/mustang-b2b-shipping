// @ts-check

/**
 * @typedef {import("../generated/api").Input} Input
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/**
 * @type {CartDeliveryOptionsTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {Input} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {

  /** @type {CartDeliveryOptionsTransformRunResult["operations"]} */
  const operations = [];

  const purchasingCompany =
    input.cart?.buyerIdentity?.purchasingCompany;

  // Retail customers
  if (!purchasingCompany) {
    return NO_CHANGES;
  }

// TEMP SAFETY RESTRICTION
const companyName =
  purchasingCompany?.company?.name;

if (
  companyName !== 'Gold Tier Test Company' &&
  companyName !== 'Silver Tier Test Company'
) {
  return NO_CHANGES;
}

  // Hide all non-free shipping methods
  for (const group of input.cart.deliveryGroups) {

    for (const option of group.deliveryOptions) {

      const title =
        option.title?.toLowerCase() || '';

      if (!title.includes('dealer free shipping')) {

        operations.push({
          deliveryOptionHide: {
            deliveryOptionHandle: option.handle,
          },
        });

      }
    }
  }

  return { operations };
}