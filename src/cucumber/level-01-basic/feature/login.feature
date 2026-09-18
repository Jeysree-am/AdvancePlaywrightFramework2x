@level1
Feature: TTA Cart login

  Background:
    Given I am on TTACart Login page

  @smoke @p0
  Scenario: A standard user can Login
    When I am a "standard_user" with password "tta_secret"
    Then I should land on products page

  @negative
  Scenario: A locked-user is refused
    When I login as "locked_out_user" with password "tta_secret"
    Then I should see the login error as "locked out"

  @negative
  Scenario: Wrong Password is rejected
    When I login as "standard_user" with "wrong_password"
    Then I should see login error containing "do not match"
