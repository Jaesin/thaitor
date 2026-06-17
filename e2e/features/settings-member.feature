@live @member
Feature: Member settings
  As a joined family member
  I want to manage my profile, voice and theme
  So that the app fits how I learn

  # These scenarios require a real Firestore membership (members/{uid} doc),
  # so they are excluded from the default run. Run them against the Firebase
  # emulator or a seeded account with: npm run e2e:member

  Background:
    Given I am on the "settings" screen

  Scenario: Settings sections are present
    Then the heading should be "Settings"
    And I should see "Profiles"
    And I should see "Default voice"
    And I should see "Theme"

  Scenario: Saving a display name confirms
    When I set my display name to "Jaesin"
    And I save my display name
    Then I should see the saved confirmation

  Scenario: Changing the default voice persists the selection
    When I select the "Male" default voice
    Then the "Male" default voice should be selected

  Scenario: Switching theme
    When I select the "Night Market" theme
    Then the heading should be "Settings"
