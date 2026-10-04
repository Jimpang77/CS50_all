-- Keep a log of any SQL queries you execute as you solve the mystery.
-- Start by finding the crime scene report for July 28, 2025 on Humphrey Street
SELECT description
FROM crime_scene_reports
WHERE year = 2025
  AND month = 7
  AND day = 28
  AND street = 'Humphrey Street';

-- The report mentions: theft took place at 10:15am at the Humphrey Street bakery.
-- Three witnesses were interviewed; their interviews mention the bakery.

-- Read the interview transcripts from that day that mention the bakery
SELECT name, transcript
FROM interviews
WHERE year = 2025
  AND month = 7
  AND day = 28
  AND transcript LIKE '%bakery%';

-- Key clues from the interviews:
-- Ruth:    Thief got into a car in the bakery parking lot within 10 min of theft (10:15-10:25am)
-- Eugene:  Thief was seen at the ATM on Leggett Street withdrawing money earlier that morning
-- Raymond: Thief called someone for <1 min just after theft; mentioned earliest flight out the next day (July 29);
--          the person on the phone was going to purchase the ticket

-- CLUE 1: Check bakery security logs for cars leaving 10:15-10:25am on July 28
SELECT activity, license_plate, hour, minute
FROM bakery_security_logs
WHERE year = 2025
  AND month = 7
  AND day = 28
  AND hour = 10
  AND minute BETWEEN 15 AND 25;

-- Save these license plates as suspects
-- Let's get people who own these plates
SELECT name, license_plate
FROM people
WHERE license_plate IN (
    SELECT license_plate
    FROM bakery_security_logs
    WHERE year = 2025
      AND month = 7
      AND day = 28
      AND hour = 10
      AND minute BETWEEN 15 AND 25
);

-- CLUE 2: Check ATM withdrawals on Leggett Street on the morning of July 28
SELECT account_number, amount
FROM atm_transactions
WHERE year = 2025
  AND month = 7
  AND day = 28
  AND atm_location = 'Leggett Street'
  AND transaction_type = 'withdraw';

-- Get names of people who made those withdrawals
SELECT DISTINCT people.name, people.phone_number, people.passport_number, people.license_plate
FROM people
JOIN bank_accounts ON people.id = bank_accounts.person_id
JOIN atm_transactions ON bank_accounts.account_number = atm_transactions.account_number
WHERE atm_transactions.year = 2025
  AND atm_transactions.month = 7
  AND atm_transactions.day = 28
  AND atm_transactions.atm_location = 'Leggett Street'
  AND atm_transactions.transaction_type = 'withdraw';

-- CLUE 3: Check phone calls under 60 seconds on July 28
-- The thief called an accomplice briefly right after the theft
SELECT caller, receiver, duration
FROM phone_calls
WHERE year = 2025
  AND month = 7
  AND day = 28
  AND duration < 60;

-- CLUE 4: Find the earliest flight OUT of Fiftyville on July 29
SELECT flights.id, flights.hour, flights.minute, airports.city AS destination
FROM flights
JOIN airports ON flights.destination_airport_id = airports.id
WHERE flights.year = 2025
  AND flights.month = 7
  AND flights.day = 29
  AND flights.origin_airport_id = (
      SELECT id FROM airports WHERE city = 'Fiftyville'
  )
ORDER BY flights.hour, flights.minute
LIMIT 1;

-- The earliest flight is flight id — let's find who was on it
-- and cross-reference with our other clues

-- Find passengers on the earliest July 29 flight out of Fiftyville
SELECT people.name, people.phone_number, people.passport_number, people.license_plate
FROM people
JOIN passengers ON people.passport_number = passengers.passport_number
WHERE passengers.flight_id = (
    SELECT flights.id
    FROM flights
    JOIN airports ON flights.destination_airport_id = airports.id
    WHERE flights.year = 2025
      AND flights.month = 7
      AND flights.day = 29
      AND flights.origin_airport_id = (
          SELECT id FROM airports WHERE city = 'Fiftyville'
      )
    ORDER BY flights.hour, flights.minute
    LIMIT 1
);

-- Now intersect all three clues to find the thief:
-- Must appear in: bakery logs AND atm withdrawals AND flight passengers AND made a short call

SELECT name
FROM people
WHERE license_plate IN (
    -- Left bakery 10:15-10:25am
    SELECT license_plate FROM bakery_security_logs
    WHERE year = 2025 AND month = 7 AND day = 28
      AND hour = 10 AND minute BETWEEN 15 AND 25
)
AND phone_number IN (
    -- Made a call under 60s on July 28
    SELECT caller FROM phone_calls
    WHERE year = 2025 AND month = 7 AND day = 28
      AND duration < 60
)
AND passport_number IN (
    -- Was on the earliest flight out July 29
    SELECT passport_number FROM passengers
    WHERE flight_id = (
        SELECT flights.id FROM flights
        JOIN airports ON flights.destination_airport_id = airports.id
        WHERE flights.year = 2025 AND flights.month = 7 AND flights.day = 29
          AND flights.origin_airport_id = (SELECT id FROM airports WHERE city = 'Fiftyville')
        ORDER BY flights.hour, flights.minute
        LIMIT 1
    )
)
AND id IN (
    -- Withdrew from ATM on Leggett Street July 28
    SELECT people.id FROM people
    JOIN bank_accounts ON people.id = bank_accounts.person_id
    JOIN atm_transactions ON bank_accounts.account_number = atm_transactions.account_number
    WHERE atm_transactions.year = 2025 AND atm_transactions.month = 7 AND atm_transactions.day = 28
      AND atm_transactions.atm_location = 'Leggett Street'
      AND atm_transactions.transaction_type = 'withdraw'
);

-- Result: Bruce is the thief.

-- Find the escape city (destination of the earliest July 29 flight from Fiftyville)
SELECT airports.city
FROM airports
JOIN flights ON airports.id = flights.destination_airport_id
WHERE flights.year = 2025
  AND flights.month = 7
  AND flights.day = 29
  AND flights.origin_airport_id = (SELECT id FROM airports WHERE city = 'Fiftyville')
ORDER BY flights.hour, flights.minute
LIMIT 1;

-- Result: New York City

-- Find the accomplice: whoever Bruce called on July 28 in a call under 60 seconds
SELECT people.name
FROM people
WHERE people.phone_number = (
    SELECT receiver FROM phone_calls
    WHERE year = 2025
      AND month = 7
      AND day = 28
      AND duration < 60
      AND caller = (SELECT phone_number FROM people WHERE name = 'Bruce')
);

-- Result: Robin is the accomplice.
