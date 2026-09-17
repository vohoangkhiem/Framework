import type { ApiProduct, EntriesResponse } from '../models/catalog.models';

/**
 * Reusable mock payloads. Keeping them next to the mocking utilities (instead of inline in
 * tests) makes contract changes a single edit.
 */
export const mockProducts: Record<'mockedPhone' | 'mockedLaptop', ApiProduct> = {
  mockedPhone: {
    id: 901,
    title: 'QA Mock Phone X',
    price: 1234,
    cat: 'phone',
    desc: 'Mocked product returned by RouteMocker',
    img: 'imgs/galaxy_s6.jpg',
  },
  mockedLaptop: {
    id: 902,
    title: 'QA Mock Laptop Pro',
    price: 2345,
    cat: 'notebook',
    desc: 'Mocked product returned by RouteMocker',
    img: 'imgs/macbook_air.jpg',
  },
};

export const mockEntriesResponse: EntriesResponse = {
  Items: [mockProducts.mockedPhone, mockProducts.mockedLaptop],
  LastEvaluatedKey: { id: '902' },
  Count: 2,
  ScannedCount: 2,
};
