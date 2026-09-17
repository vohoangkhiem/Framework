import { apiProductSchema, entriesResponseSchema } from '@api/schemas';
import { TAGS, tags } from '@config/test-tags';
import { ALL_PRODUCTS, CATEGORY_API_CODES, ProductCatalog } from '@data/static/products.catalog';
import { expect, test } from '@fixtures';
import type { ProductCategory } from '@models/product.model';

test.describe('Catalog API', tags(TAGS.api, TAGS.catalog, TAGS.regression), () => {
  test(
    'returns the first catalog page matching the contract',
    tags(TAGS.smoke),
    async ({ catalogApi }) => {
      const { status, data, raw } = await catalogApi.getEntries();

      expect(raw).toBeSuccessful();
      expect(status).toBe(200);
      expect(data).toMatchSchema(entriesResponseSchema);
      expect(data.Items.length).toBeGreaterThan(0);
      expect(data.LastEvaluatedKey, 'first page should expose a pagination key').toBeDefined();
    }
  );

  test('paginates through the whole catalog', async ({ catalogApi }) => {
    const products = await catalogApi.getAllProducts();
    const ids = products.map(product => product.id);

    expect(new Set(ids).size, 'product ids should be unique').toBe(ids.length);
    for (const expected of ALL_PRODUCTS) {
      expect(ids, `catalog should contain "${expected.name}"`).toContain(expected.id);
    }
  });

  for (const category of Object.keys(CATEGORY_API_CODES) as ProductCategory[]) {
    test(`filters products by category "${category}"`, async ({ catalogApi }) => {
      const apiCode = ProductCatalog.apiCode(category);

      const { data } = await catalogApi.getByCategory(apiCode);

      expect(data).toMatchSchema(entriesResponseSchema);
      expect(data.Items.length).toBeGreaterThan(0);
      for (const item of data.Items) {
        expect(item.cat).toBe(apiCode);
      }
      const titles = data.Items.map(item => item.title);
      for (const expected of ProductCatalog.byCategory(category)) {
        expect(titles).toContain(expected.name);
      }
    });
  }

  test('returns product details by id', async ({ catalogApi, testData }) => {
    const expected = testData.products.get('samsungGalaxyS6');

    const { data } = await catalogApi.getProduct(expected.id);

    expect(data).toMatchSchema(apiProductSchema);
    expect(data.id).toBe(expected.id);
    expect(data.title).toBe(expected.name);
    expect(data.price).toBe(expected.price);
  });

  test('framework catalog snapshot matches live product names and prices', async ({
    catalogApi,
  }) => {
    // Guards the static test data against silent drift in the application catalog.
    for (const product of ALL_PRODUCTS) {
      const { data } = await catalogApi.getProduct(product.id);
      expect.soft(data.title, `title of product ${product.id}`).toBe(product.name);
      expect.soft(data.price, `price of product ${product.id}`).toBe(product.price);
    }
  });
});
