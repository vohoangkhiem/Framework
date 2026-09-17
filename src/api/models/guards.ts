import { isRecord } from '../../utils/json-utils';
import type { AddToCartRequest } from './cart.models';

/** Runtime guard for the payload the UI sends to POST /addtocart. */
export function isAddToCartRequest(value: unknown): value is AddToCartRequest {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.cookie === 'string' &&
    typeof value.prod_id === 'number' &&
    typeof value.flag === 'boolean'
  );
}
