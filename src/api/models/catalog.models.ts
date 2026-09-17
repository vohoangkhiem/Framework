import type { ApiCategoryCode } from '../../models/product.model';

/** Product as returned by the catalog endpoints (`/entries`, `/bycat`, `/view`, `/pagination`). */
export interface ApiProduct {
  id: number;
  title: string;
  price: number;
  cat: string;
  desc?: string;
  img?: string;
}

export interface EntriesResponse {
  Items: ApiProduct[];
  /** Pagination cursor; the API serialises the id as a string. */
  LastEvaluatedKey?: { id: string };
  Count?: number;
  ScannedCount?: number;
}

export interface ByCategoryRequest {
  cat: ApiCategoryCode;
}

export interface ViewProductRequest {
  id: string;
}

export interface PaginationRequest {
  id: string;
}
