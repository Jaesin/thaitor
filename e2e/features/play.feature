Feature: Play hub
  As a learner
  I want a practice session launcher
  So that I can pick a drill to train with

  Background:
    Given I am on the "play" screen

  Scenario: Session start screen offers practice modes
    Then I should see "Ready to practice?"
    And I should see "Build phrases"
    And I should see "Audio Pick"
    And I should see "Tone Pop"

  Scenario: Session makeup stats are shown
    Then I should see "Due for review"
    And I should see "New sounds"
