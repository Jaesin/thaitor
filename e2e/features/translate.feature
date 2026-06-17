Feature: Travel translation
  As a traveller
  I want to translate English into Thai
  So that I can speak with locals

  Background:
    Given I am on the "translate" screen

  Scenario: Empty state before translating
    Then the result panel should be empty
    And I should see "Common phrases"

  Scenario: Translating English text shows a Thai result
    When I type "hello" into the translation box
    And I submit the translation
    Then the translation result should appear
    And I should see a "Save phrase" button

  Scenario: Saving a translation to the phrasebook
    When I type "hello" into the translation box
    And I submit the translation
    And I tap "Save phrase"
    Then I should see "Saved to phrasebook"

  Scenario: Common phrases sheet can be opened
    When I tap "Common phrases"
    Then I should see "Goodbye"
    And I should see "Thank you"
