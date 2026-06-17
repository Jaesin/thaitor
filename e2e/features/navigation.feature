Feature: App shell navigation
  As a learner
  I want to move between the main sections of the app
  So that I can reach Today, Translate, Play and Deck quickly

  Background:
    Given I open the app

  Scenario: The Today screen is the landing screen
    Then I should see "Phrase of the day"
    And I should see "Two ways in"

  Scenario: Navigate to Translate via the bottom nav
    When I tap the "Translate" tab
    Then I should be on the "translate" route
    And I should see "Translation will appear here"

  Scenario: Navigate to Play via the bottom nav
    When I tap the "Play" tab
    Then I should be on the "play" route

  Scenario: Navigate to the Deck via the bottom nav
    When I tap the "Deck" tab
    Then I should be on the "deck" route
    And I should see "Your Thai"

  Scenario: Reach Settings from the gear link
    When I navigate to the "settings" screen
    Then the heading should be "Settings"
