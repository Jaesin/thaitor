Feature: API access control
  As the operator
  I want the translation and live-audio screens reachable only by members
  So that an anonymous visitor cannot drain Gemini / Azure quota (bug E4)

  # Hermetic profile only. @anon scenarios skip the default membership seed, so
  # they hit the app as a fresh, never-joined visitor. The Worker is the real
  # enforcement point (it 403s non-members — see worker/test); these scenarios
  # cover the frontend contract: Home is open + degrades, the rest is gated.

  @anon
  Scenario: A non-member can open the offline Today screen
    Given I am on the "today" screen
    Then I should see a "Listen" button
    And I should not see "Family members only"

  @anon
  Scenario: A non-member is gated out of Translate
    Given I am on the "translate" screen
    Then I should see "Family members only"

  @anon
  Scenario: A non-member is gated out of the Deck
    Given I am on the "deck" screen
    Then I should see "Family members only"

  @anon
  Scenario: Phrase of the day falls back to browser speech when TTS is unavailable
    Given the TTS service is unavailable
    And I am on the "today" screen
    And browser speech is tracked
    When I tap "Listen"
    Then the browser speech fallback should be used

  Scenario: A member's Today screen is allowed to prefetch TTS
    Given I am on the "today" screen
    Then a TTS request should have been made
