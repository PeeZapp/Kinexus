import { describe, expect, it } from 'vitest';

import {
  STREAMING_SERVICE_PICKER_LIMIT,
  isSelectableStreamingService,
  mergeStreamingServices,
  normalizeStreamingProviderIds,
  resolveStreamingDisplayPriority,
  titleStreamsOn,
} from './streaming';

describe('streaming services', () => {
  it('keeps subscription services and drops stores', () => {
    expect(isSelectableStreamingService(8, 'Netflix')).toBe(true);
    expect(isSelectableStreamingService(350, 'Apple TV')).toBe(true);
    expect(isSelectableStreamingService(350, 'Apple TV+')).toBe(true);
    expect(isSelectableStreamingService(2, 'Apple TV')).toBe(false);
    expect(isSelectableStreamingService(10, 'Amazon Video')).toBe(false);
    expect(isSelectableStreamingService(192, 'YouTube')).toBe(false);
    expect(isSelectableStreamingService(9, 'Paramount+ Amazon Channel')).toBe(false);
  });

  it('prefers the country display priority over the global TMDB rank', () => {
    expect(resolveStreamingDisplayPriority({ AU: 25, US: 345 }, 'AU', 345)).toBe(25);
    expect(resolveStreamingDisplayPriority({ AU: 25, US: 345 }, 'au', 345)).toBe(25);
    expect(resolveStreamingDisplayPriority({ US: 345 }, 'AU', 345)).toBe(345);
    expect(resolveStreamingDisplayPriority(undefined, 'AU', undefined)).toBe(99);
  });

  it('merges movie and series providers and prefers the stronger listing', () => {
    const services = mergeStreamingServices([
      { providerId: 8, providerName: 'Netflix', logoPath: '/netflix.jpg', displayPriority: 1 },
      { providerId: 8, providerName: 'Netflix', logoPath: '/older.jpg', displayPriority: 4 },
      { providerId: 337, providerName: 'Disney Plus', logoPath: '/disney.jpg', displayPriority: 0 },
      { providerId: 3, providerName: 'Google Play Movies', logoPath: '/play.jpg', displayPriority: 2 },
    ]);
    expect(services.map((service) => service.providerName)).toEqual(['Disney Plus', 'Netflix']);
    expect(services[1]?.logoPath).toBe('/netflix.jpg');
  });

  it('keeps country-prominent free services when ranking by regional priority', () => {
    const services = mergeStreamingServices([
      { providerId: 8, providerName: 'Netflix', logoPath: null, displayPriority: resolveStreamingDisplayPriority({ AU: 1, US: 0 }, 'AU', 0) },
      { providerId: 73, providerName: 'Tubi TV', logoPath: null, displayPriority: resolveStreamingDisplayPriority({ AU: 25, US: 345 }, 'AU', 345) },
      { providerId: 21, providerName: 'Stan', logoPath: null, displayPriority: resolveStreamingDisplayPriority({ AU: 12, US: 12 }, 'AU', 12) },
      ...Array.from({ length: STREAMING_SERVICE_PICKER_LIMIT }, (_, i) => ({
        providerId: 1000 + i,
        providerName: `Niche ${i}`,
        logoPath: null,
        displayPriority: 50 + i,
      })),
    ]);
    const names = services.map((service) => service.providerName);
    expect(names.slice(0, 3)).toEqual(['Netflix', 'Stan', 'Tubi TV']);
    expect(names).toContain('Tubi TV');
    expect(services).toHaveLength(STREAMING_SERVICE_PICKER_LIMIT);
  });

  it('normalizes selected service ids', () => {
    expect(normalizeStreamingProviderIds([8, '337', 8, 0, -1, 9.5, 9])).toEqual([8, 337, 9]);
  });

  it('matches subscription offers on the services someone has', () => {
    const providers = [
      { offerType: 'rent' as const, providerId: 8 },
      { offerType: 'flatrate' as const, providerId: 337 },
    ];
    expect(titleStreamsOn(providers, [8])).toBe(false);
    expect(titleStreamsOn(providers, [337])).toBe(true);
    expect(titleStreamsOn(providers, [])).toBe(false);
  });
});
