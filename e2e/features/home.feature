Feature: Today screen
  As a learner
  I want a daily home screen
  So that I can see my phrase of the day, modes and quests

  Background:
    Given I am on the "today" screen

  Scenario: Phrase of the day is shown
    Then I should see "Phrase of the day"
    And I should see a "Listen" button

  Scenario: Both mode entry points are present
    Then I should see "Travel"
    And I should see "Learn"

  Scenario: Mode cards link to the right places
    Then I should see a "Travel" link
    And I should see a "Learn" link

  Scenario: Daily quests strip is shown
    Then I should see "Daily quests"

  Scenario: Daily reviews progress is shown
    Then I should see "Daily phrases"

  @tts
  Scenario: Listening to the phrase of the day plays audio
    When I tap "Listen"
    Then I should see "Stop"
