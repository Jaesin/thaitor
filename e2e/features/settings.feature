Feature: Settings
  As a family member
  I want to reach the settings screen
  So that I can manage my profile, voice and theme

  Background:
    Given I am on the "settings" screen

  # Hermetic scenarios run as a seeded member by default; the full members-only
  # settings UI is exercised live by the @member profile (settings-member.feature).
  Scenario: Settings route renders
    Then the heading should be "Settings"

  # @anon opts out of the default membership seed so Settings shows its public,
  # not-yet-a-member prompt.
  @anon
  Scenario: A non-member is prompted to join
    Then I should see "not a member yet"
    And I should see a "Back to home" link
