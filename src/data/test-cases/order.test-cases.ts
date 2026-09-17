import type { ConfirmedOrderData, OrderFormData } from '../../models/order.model';
import { OrderBuilder } from '../builders/order.builder';
import { OrderFactory } from '../factories/order.factory';
import { alertMessages } from '../static/messages';
import { multiCategoryCart, singleProductCart, type CartScenario } from './cart.test-cases';

export interface OrderTestCase {
  description: string;
  cart: CartScenario;
  orderData: ConfirmedOrderData;
}

export interface OrderValidationTestCase {
  description: string;
  orderData: OrderFormData;
  expectedMessage: string;
}

export const orderTestCases: readonly OrderTestCase[] = [
  {
    description: 'places an order with all fields completed',
    cart: singleProductCart,
    orderData: OrderBuilder.anOrder().withCreditCard('4111111111111111').buildConfirmed(),
  },
  {
    description: 'places an order with only the mandatory fields',
    cart: singleProductCart,
    orderData: OrderFactory.mandatoryOnly(),
  },
  {
    description: 'places an order for a name containing special characters',
    cart: singleProductCart,
    orderData: OrderFactory.withSpecialCharacterName(),
  },
  {
    description: 'places an order for multiple products with the combined total',
    cart: multiCategoryCart,
    orderData: OrderFactory.valid(),
  },
];

export const orderValidationTestCases: readonly OrderValidationTestCase[] = [
  {
    description: 'rejects an order without name and credit card',
    orderData: OrderFactory.empty(),
    expectedMessage: alertMessages.orderValidationError,
  },
  {
    description: 'rejects an order without a name',
    orderData: OrderFactory.withoutName(),
    expectedMessage: alertMessages.orderValidationError,
  },
  {
    description: 'rejects an order without a credit card',
    orderData: OrderFactory.withoutCreditCard(),
    expectedMessage: alertMessages.orderValidationError,
  },
];
