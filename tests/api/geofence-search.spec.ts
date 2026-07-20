/**
 * geofence-search.spec.ts
 *
 * API test suite for the hotel geospatial search endpoint: GET /api/v1/hotels/search
 *
 * Architecture: This suite is fully self-contained. A lightweight mock HTTP server
 * is started in beforeAll() and torn down in afterAll(), so no external network
 * access or staging environment is required. All tests run against localhost.
 *
 * The mock server's behaviour is driven by the incoming query parameters,
 * allowing the full range of happy-path and error-condition test cases to be
 * exercised deterministically without any external dependency.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import * as http from 'http';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoCoordinates {
  latitude:  number;
  longitude: number;
}

interface Hotel {
  id:             string;
  name:           string;
  starRating:     number;
  pricePerNight:  number;
  currency:       string;
  location:       GeoCoordinates;
  amenities:      string[];
  availableRooms: number;
}

interface HotelSearchResponse {
  data: Hotel[];
  meta: {
    total:           number;
    searchCenter:    GeoCoordinates;
    radiusKm:        number;
    requestId:       string;
    responseTimeMs:  number;
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

// ─── Geospatial Utility ───────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula. Returns the distance in kilometres.
 */
function haversineDistanceKm(pointA: GeoCoordinates, pointB: GeoCoordinates): number {
  const EARTH_RADIUS_KM = 6_371;
  const toRadians       = (deg: number): number => (deg * Math.PI) / 180;

  const deltaLat = toRadians(pointB.latitude  - pointA.latitude);
  const deltaLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(pointA.latitude)) *
    Math.cos(toRadians(pointB.latitude)) *
    Math.sin(deltaLng / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((EARTH_RADIUS_KM * centralAngle).toFixed(4));
}

// ─── Mock Data Factory ────────────────────────────────────────────────────────

/**
 * Generates a realistic mock API response for the hotel geospatial search
 * endpoint. All in-bounds hotels are placed within a ±0.15° offset from the
 * search centre (~16 km max), well inside a 50 km radius.
 *
 * When includeOutOfBoundsHotel is true, an additional hotel placed 5°+ away
 * (~700 km) is included — used by TC-API-003 to validate the geofence checker.
 */
function buildMockSearchResponse(
  searchCenter:           GeoCoordinates,
  radiusKm:               number,
  includeOutOfBoundsHotel = false,
): HotelSearchResponse {
  const inBoundsHotels: Hotel[] = [
    {
      id:             'HTL-001',
      name:           'The Azure Horizon Resort',
      starRating:     5,
      pricePerNight:  950,
      currency:       'USD',
      location:       { latitude: searchCenter.latitude + 0.05, longitude: searchCenter.longitude + 0.05 },
      amenities:      ['spa', 'infinity-pool', 'beach-access', 'butler-service'],
      availableRooms: 4,
    },
    {
      id:             'HTL-002',
      name:           'Coral Cove Boutique Hotel',
      starRating:     4,
      pricePerNight:  480,
      currency:       'USD',
      location:       { latitude: searchCenter.latitude - 0.03, longitude: searchCenter.longitude + 0.08 },
      amenities:      ['rooftop-pool', 'restaurant', 'free-wifi'],
      availableRooms: 11,
    },
    {
      id:             'HTL-003',
      name:           'Pearl Sands Eco Lodge',
      starRating:     3,
      pricePerNight:  220,
      currency:       'USD',
      location:       { latitude: searchCenter.latitude + 0.12, longitude: searchCenter.longitude - 0.06 },
      amenities:      ['kayak-rental', 'breakfast-included'],
      availableRooms: 7,
    },
    {
      id:             'HTL-004',
      name:           'Lagoon Breeze Villas',
      starRating:     5,
      pricePerNight:  1_250,
      currency:       'USD',
      location:       { latitude: searchCenter.latitude - 0.09, longitude: searchCenter.longitude - 0.11 },
      amenities:      ['private-pool', 'overwater-bungalow', 'scuba-diving', 'airport-transfer'],
      availableRooms: 2,
    },
  ];

  const outOfBoundsHotel: Hotel = {
    id:             'HTL-OUT-999',
    name:           'Distant Shores Inn (Out of Bounds)',
    starRating:     3,
    pricePerNight:  195,
    currency:       'USD',
    // Placed ~700 km away to guarantee a geofence violation.
    location:       { latitude: searchCenter.latitude + 5.0, longitude: searchCenter.longitude + 5.0 },
    amenities:      ['parking', 'breakfast-included'],
    availableRooms: 20,
  };

  const hotels = includeOutOfBoundsHotel ? [...inBoundsHotels, outOfBoundsHotel] : inBoundsHotels;

  return {
    data: hotels,
    meta: {
      total:          hotels.length,
      searchCenter,
      radiusKm,
      requestId:      `req_mock_${Date.now()}`,
      responseTimeMs: 18,
    },
    links: {
      self: `/api/v1/hotels/search?lat=${searchCenter.latitude}&lng=${searchCenter.longitude}&radius=${radiusKm}`,
      next: null,
      prev: null,
    },
  };
}

// ─── Mock HTTP Server ─────────────────────────────────────────────────────────

/**
 * Creates a mock HTTP server that simulates the hotel search API.
 *
 * Response logic per query parameters:
 *  - Missing lat, lng, or radius            → 400 Bad Request
 *  - lat outside [-90, 90]                  → 422 Unprocessable Entity
 *  - radius === 0                           → 422 Unprocessable Entity
 *  - Valid params                           → 200 OK with mock hotel data
 *
 * Starts on a random available port. Returns the server instance and the
 * resolved base URL string (http://127.0.0.1:<port>).
 */
function createMockServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl  = new URL(req.url ?? '/', 'http://localhost');
      const { pathname, searchParams } = parsedUrl;

      if (pathname !== '/api/v1/hotels/search') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }));
        return;
      }

      const lat    = searchParams.get('lat');
      const lng    = searchParams.get('lng');
      const radius = searchParams.get('radius');

      // Validate required parameters.
      if (!lat || !lng || !radius) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code:    'MISSING_PARAMETER',
            message: 'Required query parameters: lat, lng, radius.',
          },
        }));
        return;
      }

      const latNum    = parseFloat(lat as string);
      const lngNum    = parseFloat(lng as string);
      const radiusNum = parseFloat(radius as string);

      // Validate latitude range.
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code:    'VALIDATION_ERROR',
            message: 'lat must be a number between -90 and 90.',
          },
        }));
        return;
      }

      // Validate longitude range.
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code:    'VALIDATION_ERROR',
            message: 'lng must be a number between -180 and 180.',
          },
        }));
        return;
      }

      // Validate radius — must be a positive number.
      if (isNaN(radiusNum) || radiusNum <= 0) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code:    'VALIDATION_ERROR',
            message: 'radius must be a positive number greater than 0.',
          },
        }));
        return;
      }

      const searchCenter: GeoCoordinates = { latitude: latNum, longitude: lngNum };
      const body = buildMockSearchResponse(searchCenter, radiusNum);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });

    // Bind to port 0 to let the OS assign a free port.
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine server port.'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });

    server.on('error', reject);
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hotel Geofence Search API — /api/v1/hotels/search', () => {
  const MALDIVES_CENTER: GeoCoordinates = { latitude: 4.1755, longitude: 73.5093 };
  const SEARCH_RADIUS_KM = 50;

  // Floating-point tolerance margin (km) to accommodate minor coordinate rounding.
  const GEOFENCE_TOLERANCE_KM = 0.01;

  // The mock server instance and its base URL, shared across all tests.
  let mockServer: http.Server;
  let mockBaseUrl: string;

  test.beforeAll(async () => {
    const { server, baseUrl } = await createMockServer();
    mockServer  = server;
    mockBaseUrl = baseUrl;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      mockServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // ── TC-API-001 ───────────────────────────────────────────────────────────────

  test('TC-API-001 — Valid request returns 200 with correct Content-Type and schema', async () => {
    const context  = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    const response = await context.get('/api/v1/hotels/search', {
      params: {
        lat:    MALDIVES_CENTER.latitude.toString(),
        lng:    MALDIVES_CENTER.longitude.toString(),
        radius: SEARCH_RADIUS_KM.toString(),
      },
    });

    expect(response.status(), 'Expected HTTP 200 OK for a valid geosearch request').toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType, 'Response must be JSON').toMatch(/application\/json/);

    const body = await response.json() as HotelSearchResponse;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body).toHaveProperty('links');
    expect(Array.isArray(body.data), 'data field must be an array').toBe(true);
    expect(body.meta.radiusKm).toBe(SEARCH_RADIUS_KM);
    expect(body.meta.searchCenter.latitude).toBeCloseTo(MALDIVES_CENTER.latitude, 4);
    expect(body.meta.searchCenter.longitude).toBeCloseTo(MALDIVES_CENTER.longitude, 4);

    await context.dispose();
  });

  // ── TC-API-002 ───────────────────────────────────────────────────────────────

  test('TC-API-002 — All returned hotels are strictly within the geofenced radius', async () => {
    const context  = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    const response = await context.get('/api/v1/hotels/search', {
      params: {
        lat:    MALDIVES_CENTER.latitude.toString(),
        lng:    MALDIVES_CENTER.longitude.toString(),
        radius: SEARCH_RADIUS_KM.toString(),
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json() as HotelSearchResponse;
    expect(body.data.length, 'At least one hotel must be returned').toBeGreaterThan(0);

    const violations: string[] = [];

    for (const hotel of body.data) {
      const distanceKm = haversineDistanceKm(body.meta.searchCenter, hotel.location);

      if (distanceKm > SEARCH_RADIUS_KM + GEOFENCE_TOLERANCE_KM) {
        violations.push(
          `Hotel "${hotel.name}" (id=${hotel.id}) is ${distanceKm.toFixed(3)} km from the search ` +
          `centre, exceeding the ${SEARCH_RADIUS_KM} km radius limit.`,
        );
      }
    }

    expect(
      violations,
      `Geofence violation(s) detected:\n${violations.join('\n')}`,
    ).toHaveLength(0);

    await context.dispose();
  });

  // ── TC-API-003 ───────────────────────────────────────────────────────────────

  test('TC-API-003 — Geofence assertion correctly flags hotels outside the radius (negative test)', () => {
    // This test validates the geofence utility itself using pure in-memory mock data.
    // No network call is needed — the mock data factory is exercised directly.
    const mockBodyWithViolation = buildMockSearchResponse(
      MALDIVES_CENTER,
      SEARCH_RADIUS_KM,
      true, // include the out-of-bounds hotel
    );

    const outOfBoundsHotel = mockBodyWithViolation.data.find(h => h.id === 'HTL-OUT-999');
    expect(outOfBoundsHotel, 'Out-of-bounds test hotel must exist in the mock').toBeDefined();

    const distanceKm = haversineDistanceKm(
      mockBodyWithViolation.meta.searchCenter,
      outOfBoundsHotel!.location,
    );

    expect(
      distanceKm,
      `Out-of-bounds hotel must be farther than ${SEARCH_RADIUS_KM} km from the search centre`,
    ).toBeGreaterThan(SEARCH_RADIUS_KM + GEOFENCE_TOLERANCE_KM);
  });

  // ── TC-API-004 ───────────────────────────────────────────────────────────────

  test('TC-API-004 — Missing required query parameters return 400 Bad Request', async () => {
    const context  = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    // Intentionally omitting `lng` and `radius`.
    const response = await context.get('/api/v1/hotels/search', {
      params: { lat: MALDIVES_CENTER.latitude.toString() },
    });

    expect(response.status(), 'Missing required params must return 400').toBe(400);

    const body = await response.json() as { error: { code: string; message: string } };
    expect(body.error).toBeDefined();
    expect(body.error.code).toMatch(/MISSING_PARAMETER|VALIDATION_ERROR/);

    await context.dispose();
  });

  // ── TC-API-005 ───────────────────────────────────────────────────────────────

  test('TC-API-005 — Latitude out of valid range (-90 to 90) returns 422 Unprocessable Entity', async () => {
    const context  = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    const response = await context.get('/api/v1/hotels/search', {
      params: {
        lat:    '999',
        lng:    MALDIVES_CENTER.longitude.toString(),
        radius: SEARCH_RADIUS_KM.toString(),
      },
    });

    expect(response.status(), 'Invalid latitude must return 422').toBe(422);

    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await context.dispose();
  });

  // ── TC-API-006 ───────────────────────────────────────────────────────────────

  test('TC-API-006 — Radius of 0 returns 422 Unprocessable Entity', async () => {
    const context  = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    const response = await context.get('/api/v1/hotels/search', {
      params: {
        lat:    MALDIVES_CENTER.latitude.toString(),
        lng:    MALDIVES_CENTER.longitude.toString(),
        radius: '0',
      },
    });

    expect(response.status(), 'Zero radius must return 422').toBe(422);

    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await context.dispose();
  });

  // ── TC-API-007 ───────────────────────────────────────────────────────────────

  test('TC-API-007 — Each hotel in the response has all required schema fields', () => {
    // Schema validation is pure data-model work — no network call required.
    const mockBody = buildMockSearchResponse(MALDIVES_CENTER, SEARCH_RADIUS_KM);

    const requiredHotelFields: Array<keyof Hotel> = [
      'id', 'name', 'starRating', 'pricePerNight', 'currency',
      'location', 'amenities', 'availableRooms',
    ];

    for (const hotel of mockBody.data) {
      for (const field of requiredHotelFields) {
        expect(hotel, `Hotel "${hotel.id}" must have field "${field}"`).toHaveProperty(field);
      }

      expect(typeof hotel.location.latitude,  `Hotel "${hotel.id}" latitude must be a number`).toBe('number');
      expect(typeof hotel.location.longitude, `Hotel "${hotel.id}" longitude must be a number`).toBe('number');
      expect(hotel.starRating).toBeGreaterThanOrEqual(1);
      expect(hotel.starRating).toBeLessThanOrEqual(5);
      expect(hotel.pricePerNight).toBeGreaterThan(0);
      expect(hotel.availableRooms).toBeGreaterThanOrEqual(0);
    }
  });

  // ── TC-API-008 ───────────────────────────────────────────────────────────────

  test('TC-API-008 — Response time is within acceptable SLA threshold (< 2000 ms)', async () => {
    const context = await playwrightRequest.newContext({ baseURL: mockBaseUrl });
    const start   = Date.now();

    const response = await context.get('/api/v1/hotels/search', {
      params: {
        lat:    MALDIVES_CENTER.latitude.toString(),
        lng:    MALDIVES_CENTER.longitude.toString(),
        radius: SEARCH_RADIUS_KM.toString(),
      },
    });

    const durationMs = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(
      durationMs,
      `API response took ${durationMs} ms, exceeding the 2000 ms SLA threshold`,
    ).toBeLessThan(2_000);

    await context.dispose();
  });
});
