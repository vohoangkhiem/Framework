import { faker } from '@faker-js/faker';
import type { ConfirmedOrderData, OrderFormData } from '../../models/order.model';
import { DateUtils } from '../../utils/date-utils';
import { RandomUtils } from '../../utils/random-utils';
import { OrderBuilder } from '../builders/order.builder';

/** Faker-powered order factory producing realistic shipping and payment details. */
export const OrderFactory = {
  valid(): ConfirmedOrderData {
    const expiry = DateUtils.futureCardExpiry(RandomUtils.int(6, 36));
    return OrderBuilder.anOrder()
      .withName(faker.person.fullName())
      .withCountry(faker.location.country())
      .withCity(faker.location.city())
      .withCreditCard(RandomUtils.creditCardNumber('4', 16))
      .withExpiry(expiry.month, expiry.year)
      .buildConfirmed();
  },

  mandatoryOnly(): ConfirmedOrderData {
    return OrderBuilder.anOrder()
      .withName(faker.person.fullName())
      .withMandatoryFieldsOnly()
      .buildConfirmed();
  },

  withSpecialCharacterName(): ConfirmedOrderData {
    return OrderBuilder.anOrder().withName("O'Brien-Smith Jr. & Søn").buildConfirmed();
  },

  withoutName(): OrderFormData {
    return OrderBuilder.anOrder().withoutName().build();
  },

  withoutCreditCard(): OrderFormData {
    return OrderBuilder.anOrder().withoutCreditCard().build();
  },

  empty(): OrderFormData {
    return OrderBuilder.anOrder().empty().build();
  },
} as const;
