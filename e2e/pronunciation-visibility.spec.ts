import { test, expect } from './fixtures/auth.fixture';
import { mockAudioRecording } from './fixtures/audio.fixture';
import { skipToAssessmentModules } from './helpers/navigation';

const MOCK_AZURE_RESPONSE = {
  "success": true,
  "itemId": "pronR-1",
  "provider": "azure",
  "scores": {
    "overall": 34,
    "accuracy": 0,
    "fluency": 80,
    "completeness": 90
  },
  "words": [
    { "word": "un", "score": 0, "status": "incorrect", "phonemes": [] },
    { "word": "parking", "score": 0, "status": "incorrect", "phonemes": [] }
  ],
  "allPhonemes": [],
  "overallFeedback": "Keep practicing!",
  "strengths": [],
  "improvements": [],
  "practiceSuggestions": [],
  "debug": {
    "recordingStatus": "success",
    "audioSize": 41051,
    "apiCallStatus": "success"
  }
};

test.describe('Pronunciation Result Visibility QA', () => {
  test.beforeEach(async ({ page }) => {
    // Mock audio recording
    await mockAudioRecording(page);
    
    // Intercept API call
    await page.route('**/functions/v1/analyze-pronunciation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_AZURE_RESPONSE)
      });
    });
  });

  test('Regular User: Should NOT see Word-by-Word Analysis', async ({ page }) => {
    // 1. Create a unique test user
    const testUser = { email: `user-${Date.now()}@example.com`, password: 'TestPass123!' };
    
    // 2. Perform Signup
    await page.goto('/signup');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[id="password"]', testUser.password);
    await page.fill('input[id="confirmPassword"]', testUser.password);
    await page.click('button:has-text("Create Account")');
    await page.waitForURL('/', { timeout: 15000 });

    // 3. Navigate to Pronunciation Assessment
    await page.click('a:has-text("Start Your Assessment")');
    await skipToAssessmentModules(page);

    // 4. Record and Stop (auto-submits)
    await page.click('button:has(svg.lucide-mic)');
    await page.waitForTimeout(1000); // Record for 1 second
    await page.click('button:has(svg.lucide-square)');

    // 5. Wait for the score to appear (indicating analysis is done)
    await expect(page.locator('text=/100/')).toBeVisible({ timeout: 15000 });

    // 6. VERIFY: "Word-by-Word Analysis" should NOT be present in the DOM
    const wordByWordHeader = page.locator('h3:has-text("Word-by-Word Analysis")');
    await expect(wordByWordHeader).not.toBeVisible();

    // 7. VERIFY: The specific word accuracy buttons should NOT be visible
    const wordAccuracyButton = page.locator('button:has-text("un")');
    await expect(wordAccuracyButton).not.toBeVisible();
    
    // 8. VERIFY: Dev mode toggle should NOT be present for regular users
    await expect(page.locator('label:has-text("Dev")')).not.toBeVisible();
  });

  test('Admin User (Dev Mode OFF): Should NOT see Word-by-Word Analysis', async ({ page }) => {
    // 1. Login as Admin (assuming tom@solvlanguages.com is configured as admin)
    const adminUser = { email: 'tom@solvlanguages.com', password: 'TestPass123!' };
    
    await page.goto('/login');
    await page.fill('input[type="email"]', adminUser.email);
    await page.fill('input[type="password"]', adminUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });

    // 2. Navigate to Pronunciation Assessment
    await page.click('a:has-text("Start Your Assessment")');
    await skipToAssessmentModules(page);

    // 3. Record and Stop
    await page.click('button:has(svg.lucide-mic)');
    await page.waitForTimeout(1000);
    await page.click('button:has(svg.lucide-square)');

    // 4. Wait for analysis results
    await expect(page.locator('text=/100/')).toBeVisible({ timeout: 15000 });

    // 5. Look for Dev switch - ensure it is OFF (default is now false)
    const devToggle = page.locator('button[id="dev-mode"]');
    await expect(devToggle).toBeVisible();
    
    // Check if it's off (aria-checked="false")
    await expect(devToggle).toHaveAttribute('aria-checked', 'false');

    // 6. VERIFY: Even as admin, if Dev Mode is OFF, technical sections are hidden
    await expect(page.locator('h3:has-text("Word-by-Word Analysis")')).not.toBeVisible();
    await expect(page.locator('text=Phoneme Analysis')).not.toBeVisible();
    await expect(page.locator('text=Debug Information')).not.toBeVisible();

    // 7. TOGGLE: Turn Dev Mode ON
    await devToggle.click();
    await expect(devToggle).toHaveAttribute('aria-checked', 'true');

    // 8. VERIFY: Now sections SHOULD be visible
    await expect(page.locator('h3:has-text("Word-by-Word Analysis")')).toBeVisible();
    await expect(page.locator('text=Phoneme Analysis')).toBeVisible();
    await expect(page.locator('text=Debug Information')).toBeVisible();
  });
});
