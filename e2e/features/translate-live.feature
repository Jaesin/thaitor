@live
Feature: Live translation against the real Worker
  As a traveller
  I want real Thai translations and audio
  So that I can trust what the app tells me to say

  # Runs only in the live profile (E2E_LIVE=1): hits the deployed Worker, so
  # Gemini returns a real translation. With E2E_SOUND=1 the audio is audible.

  Background:
    Given I am on the "translate" screen

  Scenario: English text is translated to real Thai
    When I type "thank you" into the translation box
    And I submit the translation
    Then the translation result should appear
    And the result should contain Thai script
