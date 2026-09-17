import { faker } from '@faker-js/faker';
import type { UserCredentials } from '../../models/user.model';
import { RandomUtils } from '../../utils/random-utils';
import { UserBuilder } from '../builders/user.builder';

/**
 * Faker-powered user factory for realistic-looking data. Uniqueness is guaranteed by the
 * time-based id appended to every username.
 */
export const UserFactory = {
  /** Deterministic data for a given seed (use in debugging or snapshot-style tests). */
  seed(seed: number): void {
    faker.seed(seed);
  },

  unique(): UserCredentials {
    const handle = faker.internet
      .username()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10)
      .toLowerCase();
    return UserBuilder.aUser()
      .withUsername(`${handle}_${RandomUtils.uniqueId('', 5)}`)
      .withPassword(faker.internet.password({ length: 12, memorable: false }))
      .build();
  },

  withLongCredentials(length = 30): UserCredentials {
    return UserBuilder.aUser().withUsernameLength(length).withPasswordLength(length).build();
  },

  withSpecialCharacterPassword(): UserCredentials {
    return UserBuilder.aUser().withSpecialCharacterPassword().build();
  },

  /** Valid-looking credentials that were never registered. */
  unregistered(): UserCredentials {
    return UserBuilder.aUser().build();
  },
} as const;
