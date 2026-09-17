import { mockEntriesResponse, mockProducts } from '@api/mocks/mock-data';
import type { EntriesResponse } from '@api/models/catalog.models';
import { TAGS, tags } from '@config/test-tags';
import { expect, test } from '@fixtures';

/**
 * Demonstrates request interception: the UI is exercised against controlled API responses,
 * which makes error handling and rendering logic testable without touching server state.
 */
test.describe(
  'Catalog with mocked API',
  tags(TAGS.ui, TAGS.catalog, TAGS.mock, TAGS.regression),
  () => {
    test('renders products from a mocked catalog response', async ({ routeMocker, homePage }) => {
      await routeMocker.mockJson('**/entries', mockEntriesResponse);

      await homePage.goto();

      await homePage.expectProductCount(mockEntriesResponse.Items.length);
      await homePage.expectProductsListed(
        mockEntriesResponse.Items.map(item => ({ name: item.title }))
      );
      expect(routeMocker.interceptedCalls('/entries')).toHaveLength(1);
    });

    test('injects an extra product into the real catalog response', async ({
      routeMocker,
      homePage,
    }) => {
      await routeMocker.modifyJsonResponse<EntriesResponse>('**/entries', payload => ({
        ...payload,
        Items: [mockProducts.mockedPhone, ...payload.Items],
      }));

      await homePage.goto();

      await homePage.expectProductListed(mockProducts.mockedPhone.title);
      await homePage.expectProductListed('Samsung galaxy s6');
    });

    test('shows an empty grid but stays usable when the catalog API fails', async ({
      routeMocker,
      homePage,
    }) => {
      await routeMocker.mockServerError('**/entries', 503);

      await homePage.gotoExpectingEmptyCatalog();

      await homePage.expectProductCount(0);
      await homePage.header.expectLoggedOut();
    });

    test('renders the catalog even when the API is slow', async ({ routeMocker, homePage }) => {
      await routeMocker.delay('**/entries', 2_500);

      await homePage.goto();

      await homePage.expectProductListed('Samsung galaxy s6');
    });
  }
);
