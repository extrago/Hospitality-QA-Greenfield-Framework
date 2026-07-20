import { test, expect, type Page, type Locator } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── Constants ───────────────────────────────────────────────────────────────

const GUEST_DETAILS = {
  firstName: 'Alexandra',
  lastName:  'Harrison',
  email:     process.env.TEST_USER_EMAIL ?? 'qa.automation@hospitality-platform.com',
  phone:     '+1-555-867-5309',
  cardNumber: '4111 1111 1111 1111',
  cardExpiry: '12/27',
  cardCvc:    '737',
  cardName:   'Alexandra Harrison',
};

const SEARCH_PARAMS = {
  destination: 'Maldives',
  checkIn:     '2026-09-15',
  checkOut:    '2026-09-22',
  adults:      2,
  children:    1,
  rooms:       1,
};

// ─── Page Object Helpers ──────────────────────────────────────────────────────

/**
 * Encapsulates locators and interaction logic for the hotel search form.
 * Using a lightweight helper class keeps test code readable and DRY without
 * requiring a full page-object framework boilerplate.
 */
class SearchPage {
  readonly destinationInput: Locator;
  readonly checkInInput: Locator;
  readonly checkOutInput: Locator;
  readonly adultsCounter: Locator;
  readonly childrenCounter: Locator;
  readonly searchButton: Locator;

  constructor(readonly page: Page) {
    this.destinationInput = page.getByRole('combobox', { name: /destination/i });
    this.checkInInput     = page.getByLabel(/check.?in/i);
    this.checkOutInput    = page.getByLabel(/check.?out/i);
    this.adultsCounter    = page.getByTestId('guest-counter-adults');
    this.childrenCounter  = page.getByTestId('guest-counter-children');
    this.searchButton     = page.getByRole('button', { name: /search hotels/i });
  }

  async fillDestination(destination: string): Promise<void> {
    await this.destinationInput.click();
    await this.destinationInput.fill(destination);
    // Wait for the autocomplete dropdown and select the first matching suggestion.
    const suggestion = this.page.getByRole('option', { name: new RegExp(destination, 'i') }).first();
    await suggestion.waitFor({ state: 'visible' });
    await suggestion.click();
  }

  async fillCheckInDate(isoDate: string): Promise<void> {
    await this.checkInInput.fill(isoDate);
  }

  async fillCheckOutDate(isoDate: string): Promise<void> {
    await this.checkOutInput.fill(isoDate);
  }

  async setAdultCount(count: number): Promise<void> {
    // The counter widget exposes increment/decrement buttons and a value label.
    const incrementButton = this.adultsCounter.getByRole('button', { name: /increment|plus|\+/i });
    const currentValue    = await this.adultsCounter.getByRole('spinbutton').inputValue();
    const delta           = count - parseInt(currentValue, 10);
    for (let i = 0; i < Math.abs(delta); i++) {
      if (delta > 0) {
        await incrementButton.click();
      } else {
        await this.adultsCounter.getByRole('button', { name: /decrement|minus|-/i }).click();
      }
    }
  }

  async setChildrenCount(count: number): Promise<void> {
    const incrementButton = this.childrenCounter.getByRole('button', { name: /increment|plus|\+/i });
    const currentValue    = await this.childrenCounter.getByRole('spinbutton').inputValue();
    const delta           = count - parseInt(currentValue, 10);
    for (let i = 0; i < Math.abs(delta); i++) {
      if (delta > 0) {
        await incrementButton.click();
      } else {
        await this.childrenCounter.getByRole('button', { name: /decrement|minus|-/i }).click();
      }
    }
  }

  async submitSearch(): Promise<void> {
    await this.searchButton.click();
  }
}

/**
 * Encapsulates locators for the search results listing page.
 */
class SearchResultsPage {
  readonly hotelCards: Locator;
  readonly filterPanel: Locator;

  constructor(readonly page: Page) {
    this.hotelCards  = page.getByTestId('hotel-result-card');
    this.filterPanel = page.getByRole('complementary', { name: /filters/i });
  }

  async waitForResults(): Promise<void> {
    await this.hotelCards.first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  async selectFirstHotel(): Promise<void> {
    await this.hotelCards.first().getByRole('link', { name: /view details|select|book/i }).click();
  }

  async getResultCount(): Promise<number> {
    return this.hotelCards.count();
  }
}

/**
 * Encapsulates locators for the hotel detail / room selection page.
 */
class HotelDetailPage {
  readonly roomCards: Locator;
  readonly hotelName: Locator;
  readonly starRating: Locator;

  constructor(readonly page: Page) {
    this.roomCards  = page.getByTestId('room-option-card');
    this.hotelName  = page.getByRole('heading', { level: 1 });
    this.starRating = page.getByTestId('hotel-star-rating');
  }

  async waitForHotelDetail(): Promise<void> {
    await this.hotelName.waitFor({ state: 'visible' });
    await this.roomCards.first().waitFor({ state: 'visible' });
  }

  async selectFirstAvailableRoom(): Promise<string> {
    const firstCard       = this.roomCards.first();
    const roomNameLocator = firstCard.getByTestId('room-name');
    const roomName        = await roomNameLocator.textContent() ?? 'Unknown Room';

    await firstCard.getByRole('button', { name: /reserve|select room|book now/i }).click();

    return roomName.trim();
  }
}

/**
 * Encapsulates locators and interaction logic for the guest information form
 * and the payment section on the checkout page.
 */
class CheckoutPage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly cardNumberInput: Locator;
  readonly cardExpiryInput: Locator;
  readonly cardCvcInput: Locator;
  readonly cardNameInput: Locator;
  readonly termsCheckbox: Locator;
  readonly confirmButton: Locator;
  readonly orderSummaryPanel: Locator;

  constructor(readonly page: Page) {
    this.firstNameInput    = page.getByLabel(/first name/i);
    this.lastNameInput     = page.getByLabel(/last name/i);
    this.emailInput        = page.getByLabel(/email address/i);
    this.phoneInput        = page.getByLabel(/phone number/i);
    this.cardNumberInput   = page.getByLabel(/card number/i);
    this.cardExpiryInput   = page.getByLabel(/expiry date|expiration/i);
    this.cardCvcInput      = page.getByLabel(/cvc|cvv|security code/i);
    this.cardNameInput     = page.getByLabel(/name on card/i);
    this.termsCheckbox     = page.getByRole('checkbox', { name: /terms and conditions/i });
    this.confirmButton     = page.getByRole('button', { name: /confirm booking|complete reservation/i });
    this.orderSummaryPanel = page.getByTestId('order-summary');
  }

  async fillGuestDetails(guest: typeof GUEST_DETAILS): Promise<void> {
    await this.firstNameInput.fill(guest.firstName);
    await this.lastNameInput.fill(guest.lastName);
    await this.emailInput.fill(guest.email);
    await this.phoneInput.fill(guest.phone);
  }

  async fillPaymentDetails(guest: typeof GUEST_DETAILS): Promise<void> {
    // Card number may be inside an iframe depending on the payment provider.
    // We use the top-level locators and rely on Playwright's auto-waiting.
    await this.cardNumberInput.fill(guest.cardNumber);
    await this.cardExpiryInput.fill(guest.cardExpiry);
    await this.cardCvcInput.fill(guest.cardCvc);
    await this.cardNameInput.fill(guest.cardName);
  }

  async acceptTermsAndSubmit(): Promise<void> {
    await this.termsCheckbox.check();
    await expect(this.termsCheckbox).toBeChecked();
    await this.confirmButton.click();
  }
}

/**
 * Encapsulates locators for the booking confirmation screen.
 */
class ConfirmationPage {
  readonly confirmationHeading: Locator;
  readonly bookingReferenceNumber: Locator;
  readonly guestNameDisplay: Locator;
  readonly checkInDisplay: Locator;
  readonly checkOutDisplay: Locator;
  readonly downloadReceiptButton: Locator;

  constructor(readonly page: Page) {
    this.confirmationHeading    = page.getByRole('heading', { name: /booking confirmed|reservation confirmed/i });
    this.bookingReferenceNumber = page.getByTestId('booking-reference');
    this.guestNameDisplay       = page.getByTestId('confirmation-guest-name');
    this.checkInDisplay         = page.getByTestId('confirmation-check-in');
    this.checkOutDisplay        = page.getByTestId('confirmation-check-out');
    this.downloadReceiptButton  = page.getByRole('button', { name: /download receipt|get receipt/i });
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hotel Booking — Complete End-to-End Flow', () => {
  let searchPage: SearchPage;
  let resultsPage: SearchResultsPage;
  let detailPage: HotelDetailPage;
  let checkoutPage: CheckoutPage;
  let confirmationPage: ConfirmationPage;

  test.beforeEach(async ({ page }) => {
    searchPage       = new SearchPage(page);
    resultsPage      = new SearchResultsPage(page);
    detailPage       = new HotelDetailPage(page);
    checkoutPage     = new CheckoutPage(page);
    confirmationPage = new ConfirmationPage(page);

    // Navigate to the homepage and dismiss any cookie/consent banners.
    await page.goto('/');
    const consentButton = page.getByRole('button', { name: /accept all cookies|agree/i });
    if (await consentButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await consentButton.click();
    }
  });

  test('TC-E2E-001 — Guest searches for a hotel, selects a room, completes checkout, and sees a confirmation', async ({ page }) => {
    // ── Step 1: Search ──────────────────────────────────────────────────────
    await test.step('Fill and submit the hotel search form', async () => {
      await searchPage.fillDestination(SEARCH_PARAMS.destination);
      await searchPage.fillCheckInDate(SEARCH_PARAMS.checkIn);
      await searchPage.fillCheckOutDate(SEARCH_PARAMS.checkOut);
      await searchPage.setAdultCount(SEARCH_PARAMS.adults);
      await searchPage.setChildrenCount(SEARCH_PARAMS.children);
      await searchPage.submitSearch();
    });

    // ── Step 2: Verify Results ───────────────────────────────────────────────
    await test.step('Verify search results are displayed', async () => {
      await resultsPage.waitForResults();
      const count = await resultsPage.getResultCount();
      expect(count, 'Expected at least one hotel result').toBeGreaterThan(0);

      // The URL should reflect the search parameters.
      await expect(page).toHaveURL(/destination=Maldives/i);
    });

    // ── Step 3: Select a Hotel ───────────────────────────────────────────────
    await test.step('Open the first hotel detail page', async () => {
      await resultsPage.selectFirstHotel();
      await detailPage.waitForHotelDetail();

      const hotelNameText = await detailPage.hotelName.textContent();
      expect(hotelNameText, 'Hotel name heading must not be empty').toBeTruthy();
    });

    // ── Step 4: Select a Room ────────────────────────────────────────────────
    let selectedRoomName: string;
    await test.step('Select the first available room and proceed to checkout', async () => {
      selectedRoomName = await detailPage.selectFirstAvailableRoom();
      expect(selectedRoomName.length, 'Room name must be a non-empty string').toBeGreaterThan(0);
    });

    // ── Step 5: Fill Checkout Form ───────────────────────────────────────────
    await test.step('Fill in guest details on the checkout page', async () => {
      await page.waitForURL(/checkout|booking/i);
      await checkoutPage.fillGuestDetails(GUEST_DETAILS);

      // Verify that the order summary panel reflects the selected room.
      await expect(checkoutPage.orderSummaryPanel).toBeVisible();
      const summaryText = await checkoutPage.orderSummaryPanel.textContent();
      expect(summaryText).toContain(SEARCH_PARAMS.destination);
    });

    // ── Step 6: Fill Payment Details ─────────────────────────────────────────
    await test.step('Fill in payment details', async () => {
      await checkoutPage.fillPaymentDetails(GUEST_DETAILS);
    });

    // ── Step 7: Confirm Booking ───────────────────────────────────────────────
    await test.step('Accept terms and submit the reservation', async () => {
      await checkoutPage.acceptTermsAndSubmit();
    });

    // ── Step 8: Verify Confirmation ──────────────────────────────────────────
    await test.step('Verify the confirmation screen displays correct details', async () => {
      await page.waitForURL(/confirmation|booking-success/i, { timeout: 30_000 });

      // Heading must confirm the booking was completed.
      await expect(confirmationPage.confirmationHeading).toBeVisible();

      // A booking reference must be present and follow the expected format.
      const reference = await confirmationPage.bookingReferenceNumber.textContent();
      expect(reference, 'Booking reference must not be empty').toBeTruthy();
      expect(reference).toMatch(/^[A-Z0-9]{6,12}$/);

      // Guest name must match exactly what was entered.
      const displayedName = await confirmationPage.guestNameDisplay.textContent();
      expect(displayedName).toContain(GUEST_DETAILS.firstName);
      expect(displayedName).toContain(GUEST_DETAILS.lastName);

      // Check-in and check-out dates must be visible.
      await expect(confirmationPage.checkInDisplay).toBeVisible();
      await expect(confirmationPage.checkOutDisplay).toBeVisible();

      // Receipt download button must be available.
      await expect(confirmationPage.downloadReceiptButton).toBeEnabled();
    });
  });

  test('TC-E2E-002 — Search form validates required fields before submission', async ({ page }) => {
    await test.step('Click search without filling in any fields', async () => {
      await searchPage.submitSearch();
    });

    await test.step('Verify validation error messages appear', async () => {
      // The application must display inline validation messages and not navigate away.
      const destinationError = page.getByRole('alert').filter({ hasText: /destination is required/i });
      await expect(destinationError).toBeVisible();

      // The URL must remain on the homepage — no navigation should have occurred.
      await expect(page).toHaveURL('/');
    });
  });

  test('TC-E2E-003 — Check-out date cannot be earlier than or equal to check-in date', async ({ page }) => {
    await test.step('Set check-in date and an invalid (earlier) check-out date', async () => {
      await searchPage.fillDestination(SEARCH_PARAMS.destination);
      await searchPage.fillCheckInDate('2026-09-22');
      await searchPage.fillCheckOutDate('2026-09-15');
      await searchPage.submitSearch();
    });

    await test.step('Verify a date range validation error is shown', async () => {
      const dateError = page.getByRole('alert').filter({ hasText: /check-out.*must be after.*check-in|invalid date range/i });
      await expect(dateError).toBeVisible();
    });
  });
});
