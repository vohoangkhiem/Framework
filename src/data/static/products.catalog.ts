import type { ApiCategoryCode, Product, ProductCategory } from '../../models/product.model';
import { NumberUtils } from '../../utils/number-utils';

/** Maps UI category labels to the codes expected by the `/bycat` API. */
export const CATEGORY_API_CODES: Readonly<Record<ProductCategory, ApiCategoryCode>> = {
  Phones: 'phone',
  Laptops: 'notebook',
  Monitors: 'monitor',
};

/**
 * Snapshot of the Demoblaze catalog (verified against GET /entries and POST /bycat).
 * Product ids are required for API-based cart preconditions; names and prices drive UI
 * assertions. Keep this list in sync with the application when it changes.
 */
export const PRODUCT_CATALOG = {
  samsungGalaxyS6: { id: 1, name: 'Samsung galaxy s6', price: 360, category: 'Phones' },
  nokiaLumia1520: { id: 2, name: 'Nokia lumia 1520', price: 820, category: 'Phones' },
  nexus6: { id: 3, name: 'Nexus 6', price: 650, category: 'Phones' },
  samsungGalaxyS7: { id: 4, name: 'Samsung galaxy s7', price: 800, category: 'Phones' },
  iphone6: { id: 5, name: 'Iphone 6 32gb', price: 790, category: 'Phones' },
  sonyXperiaZ5: { id: 6, name: 'Sony xperia z5', price: 320, category: 'Phones' },
  htcOneM9: { id: 7, name: 'HTC One M9', price: 700, category: 'Phones' },
  sonyVaioI5: { id: 8, name: 'Sony vaio i5', price: 790, category: 'Laptops' },
  macbookAir: { id: 11, name: 'MacBook air', price: 700, category: 'Laptops' },
  dellI7: { id: 12, name: 'Dell i7 8gb', price: 700, category: 'Laptops' },
  dell15Inch: { id: 13, name: '2017 Dell 15.6 Inch', price: 700, category: 'Laptops' },
  macbookPro: { id: 15, name: 'MacBook Pro', price: 1100, category: 'Laptops' },
  appleMonitor24: { id: 10, name: 'Apple monitor 24', price: 400, category: 'Monitors' },
  asusFullHd: { id: 14, name: 'ASUS Full HD', price: 230, category: 'Monitors' },
} as const satisfies Record<string, Product>;

export type ProductKey = keyof typeof PRODUCT_CATALOG;

export const ALL_PRODUCTS: readonly Product[] = Object.values(PRODUCT_CATALOG);

export const ProductCatalog = {
  get(key: ProductKey): Product {
    return PRODUCT_CATALOG[key];
  },

  findByName(name: string): Product | undefined {
    return ALL_PRODUCTS.find(product => product.name.toLowerCase() === name.toLowerCase());
  },

  findById(id: number): Product | undefined {
    return ALL_PRODUCTS.find(product => product.id === id);
  },

  byCategory(category: ProductCategory): Product[] {
    return ALL_PRODUCTS.filter(product => product.category === category);
  },

  apiCode(category: ProductCategory): ApiCategoryCode {
    return CATEGORY_API_CODES[category];
  },

  totalPrice(products: readonly Product[]): number {
    return NumberUtils.sum(products.map(product => product.price));
  },
} as const;
