import type { Product } from '../../models/product.model';
import { PRODUCT_CATALOG, ProductCatalog, type ProductKey } from '../static/products.catalog';

export interface CartScenario {
  description: string;
  products: Product[];
  expectedTotal: number;
}

/**
 * Builds cart scenarios from catalog entries, computing the expected total so that test
 * data can never drift out of sync with the prices it references.
 */
export class CartBuilder {
  private readonly products: Product[] = [];
  private description = '';

  static aCart(): CartBuilder {
    return new CartBuilder();
  }

  describedAs(description: string): this {
    this.description = description;
    return this;
  }

  withProduct(product: ProductKey | Product): this {
    this.products.push(typeof product === 'string' ? PRODUCT_CATALOG[product] : product);
    return this;
  }

  withProducts(...products: Array<ProductKey | Product>): this {
    products.forEach(product => this.withProduct(product));
    return this;
  }

  build(): CartScenario {
    return {
      description: this.description || `Cart with ${this.products.length} product(s)`,
      products: [...this.products],
      expectedTotal: ProductCatalog.totalPrice(this.products),
    };
  }
}
