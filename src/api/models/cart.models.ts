/**
 * Cart endpoints key every cart by a "cookie" string:
 *  - authenticated shoppers: the session token (flag = true)
 *  - anonymous shoppers:     the browser's full `document.cookie` string (flag = false)
 */
export interface AddToCartRequest {
  /** Client-generated unique id of the cart line. */
  id: string;
  cookie: string;
  prod_id: number;
  flag: boolean;
}

export interface ViewCartRequest {
  cookie: string;
  flag: boolean;
}

export interface CartItem {
  id: string;
  cookie: string;
  prod_id: number;
  flag?: boolean;
}

export interface ViewCartResponse {
  Items: CartItem[];
}

export interface DeleteItemRequest {
  id: string;
}

export interface DeleteCartRequest {
  cookie: string;
}
