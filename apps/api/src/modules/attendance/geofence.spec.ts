import { distanceMeters, isInsideGeofence } from './geofence';

describe('geofence', () => {
  it('returns ~0 for identical points', () => {
    expect(distanceMeters(-6.2, 106.8, -6.2, 106.8)).toBeLessThan(1);
  });

  it('allows punches inside the radius', () => {
    // ~111m per 0.001 deg latitude near equator
    expect(isInsideGeofence(-6.2, 106.8, -6.2, 106.8, 150)).toBe(true);
    expect(isInsideGeofence(-6.2005, 106.8, -6.2, 106.8, 150)).toBe(true);
  });

  it('rejects punches outside the radius', () => {
    expect(isInsideGeofence(-6.205, 106.8, -6.2, 106.8, 150)).toBe(false);
  });
});
