-- Separate database used by the API integration tests and Playwright E2E runs,
-- so automated tests never touch development data.
CREATE DATABASE saas_test;
