import type { APIRequestContext } from '@playwright/test';
import type { ApiCategoryCode } from '../../models/product.model';
import type { ApiProduct, EntriesResponse } from '../models/catalog.models';
import { apiProductSchema, entriesResponseSchema } from '../schemas';
import { BaseApiClient, type ApiClientOptions, type ApiResult } from './base-api.client';

/** Items per page returned by `/entries` and `/pagination`. */
export const CATALOG_PAGE_SIZE = 9;
const MAX_PAGES = 20;

/** Client for the product catalog endpoints. */
export class CatalogApiClient extends BaseApiClient {
  constructor(request: APIRequestContext, options: ApiClientOptions = {}) {
    super(request, { name: 'CatalogApi', ...options });
  }

  /** First page of the catalog plus the pagination cursor. */
  async getEntries(): Promise<ApiResult<EntriesResponse>> {
    return this.sendJson('GET', '/entries', entriesResponseSchema);
  }

  async getPage(lastEvaluatedId: string): Promise<ApiResult<EntriesResponse>> {
    return this.sendJson('POST', '/pagination', entriesResponseSchema, {
      data: { id: lastEvaluatedId },
    });
  }

  async getByCategory(category: ApiCategoryCode): Promise<ApiResult<EntriesResponse>> {
    return this.sendJson('POST', '/bycat', entriesResponseSchema, { data: { cat: category } });
  }

  async getProduct(id: number): Promise<ApiResult<ApiProduct>> {
    return this.sendJson('POST', '/view', apiProductSchema, { data: { id: String(id) } });
  }

  /**
   * Walks the catalog page by page. Mirrors the UI's stop condition: the API returns a cursor
   * even on the last page, so a page smaller than the page size marks the end.
   */
  async getAllProducts(): Promise<ApiProduct[]> {
    const products: ApiProduct[] = [];
    const seenCursors = new Set<string>();
    let page = await this.getEntries();
    products.push(...page.data.Items);

    for (let pageIndex = 1; pageIndex < MAX_PAGES; pageIndex += 1) {
      const cursor = page.data.LastEvaluatedKey?.id;
      const isLastPage =
        cursor === undefined ||
        seenCursors.has(cursor) ||
        page.data.Items.length < CATALOG_PAGE_SIZE ||
        (page.data.ScannedCount !== undefined && page.data.ScannedCount < CATALOG_PAGE_SIZE);
      if (isLastPage) {
        break;
      }
      seenCursors.add(cursor);
      page = await this.getPage(cursor);
      products.push(...page.data.Items);
    }
    return products;
  }
}
