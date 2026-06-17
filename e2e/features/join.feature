Feature: Family join flow
  As an invited family member
  I want to join via an invite link
  So that I can share progress with my family

  Scenario: Opening join without a token explains what is needed
    Given I am on the "join" screen
    Then the heading should be "No invite token found"
    And I should see a "Back to home" link

  Scenario: Opening a valid invite link shows the name form
    Given I open a join link with token "DEMO-TOKEN"
    Then the heading should be "Join Thaitor"

  Scenario: Submitting without a name is rejected
    Given I open a join link with token "DEMO-TOKEN"
    When I submit the join form
    Then I should see "Please enter a name."
