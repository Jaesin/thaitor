Feature: Phrasebook deck
  As a traveller
  I want a deck of common Thai phrases
  So that I can browse, filter and save the ones I need

  Background:
    Given I am on the "deck" screen

  Scenario: Deck shows the built-in phrases
    Then the heading should be "Your Thai"
    And I should see "Hello"

  Scenario: Category filters are available
    Then I should see a "Food" button
    And I should see a "Transport" button

  Scenario: Filtering by a category
    When I tap "Food"
    Then I should see "Not spicy"
