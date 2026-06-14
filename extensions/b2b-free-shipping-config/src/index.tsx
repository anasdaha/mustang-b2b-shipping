import { reactExtension, Text, BlockStack, Banner } from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.delivery-customization.action.render';

export default reactExtension(TARGET, () => <B2BFreeShippingConfig />);

function B2BFreeShippingConfig() {
  return (
    <BlockStack>
      <Banner tone="success">
        <Text>B2B Free Shipping is active for this store.</Text>
      </Banner>
    </BlockStack>
  );
}
