@live @signup
Feature: Family sign-up
  As an invited person
  I want to join the family with an invite link
  So that my progress syncs and the member features unlock

  # Runs only in the live profile (E2E_LIVE=1) with a real seed invite token
  # (E2E_INVITE_TOKEN). The new member doc and any data it creates are deleted
  # automatically in the After hook.

  Scenario: Joining with a valid invite creates a membership
    Given I open the seed invite link
    Then the heading should be "Join Thaitor"
    When I enter a unique test name
    And I submit the join form
    Then I should be signed in as a member
