import {
  haversineDistanceKm,
  parseCoordinates,
  PROXIMITY_THRESHOLD_KM,
} from '../utils/coordinate.utils';

describe('coordinate.utils', () => {
  describe('parseCoordinates', () => {
    it('parses comma-separated coordinates', () => {
      expect(parseCoordinates('18.5204,73.8567')).toEqual({
        latitude: 18.5204,
        longitude: 73.8567,
      });
    });

    it('parses coordinates with spaces', () => {
      expect(parseCoordinates('18.5204, 73.8567')).toEqual({
        latitude: 18.5204,
        longitude: 73.8567,
      });
    });

    it('parses semicolon-separated coordinates', () => {
      expect(parseCoordinates('18.5204;73.8567')).toEqual({
        latitude: 18.5204,
        longitude: 73.8567,
      });
    });

    it('parses tab-separated coordinates', () => {
      expect(parseCoordinates('18.5204\t73.8567')).toEqual({
        latitude: 18.5204,
        longitude: 73.8567,
      });
    });

    it('returns null for plain locality strings', () => {
      expect(parseCoordinates('Pune')).toBeNull();
      expect(parseCoordinates('Koregaon Park, Pune')).toBeNull();
    });

    it('returns null for empty or null input', () => {
      expect(parseCoordinates(null)).toBeNull();
      expect(parseCoordinates(undefined)).toBeNull();
      expect(parseCoordinates('')).toBeNull();
      expect(parseCoordinates('   ')).toBeNull();
    });

    it('rejects out-of-range latitude', () => {
      expect(parseCoordinates('91,73.8567')).toBeNull();
      expect(parseCoordinates('-91,73.8567')).toBeNull();
    });

    it('rejects out-of-range longitude', () => {
      expect(parseCoordinates('18.5204,181')).toBeNull();
      expect(parseCoordinates('18.5204,-181')).toBeNull();
    });
  });

  describe('haversineDistanceKm', () => {
    it('returns 0 for the same point', () => {
      expect(haversineDistanceKm(18.5204, 73.8567, 18.5204, 73.8567)).toBe(0);
    });

    it('computes a plausible distance between two known points', () => {
      const distance = haversineDistanceKm(18.5204, 73.8567, 19.076, 72.8777); // Pune -> Mumbai
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it('returns NaN for invalid inputs instead of throwing', () => {
      expect(Number.isNaN(haversineDistanceKm(NaN, 0, 0, 0))).toBe(true);
      expect(Number.isNaN(haversineDistanceKm(18, 200, 19, 72))).toBe(true);
    });
  });

  it('exports a proximity threshold', () => {
    expect(PROXIMITY_THRESHOLD_KM).toBe(50);
  });
});
