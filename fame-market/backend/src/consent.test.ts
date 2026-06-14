import { afterEach, describe, expect, it } from 'vitest';
import {
  acceptCurrentConsent,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RULES_VERSION,
  getConsentStatus
} from './consent.js';

describe('beta consent', () => {
  const user = {
    uid: `consent-test-${Date.now()}`,
    email: 'consent@example.test',
    displayName: 'Consent Test',
    avatarUrl: null
  };

  afterEach(() => {
    delete process.env.CONSENT_REQUIRED;
  });

  it('does not block development unless consent is enabled', async () => {
    const status = await getConsentStatus(user);
    expect(status.accepted).toBe(true);
    expect(status.required).toBe(false);
  });

  it('records the current rules and privacy versions', async () => {
    process.env.CONSENT_REQUIRED = 'true';
    const before = await getConsentStatus(user);
    expect(before.accepted).toBe(false);

    const accepted = await acceptCurrentConsent(user);
    expect(accepted).toMatchObject({
      accepted: true,
      required: true,
      rulesVersion: CURRENT_RULES_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION
    });
  });
});
