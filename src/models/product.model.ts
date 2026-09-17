/** Category labels as displayed in the UI sidebar. */
export type ProductCategory = 'Phones' | 'Laptops' | 'Monitors';

/** Category codes expected by the `/bycat` API endpoint. */
export type ApiCategoryCode = 'phone' | 'notebook' | 'monitor';

export interface Product {
  id: number;
  name: string;
  price: number;
  category: ProductCategory;
}

/** A single row as displayed in the cart table. */
export interface CartLine {
  name: string;
  price: number;
}
