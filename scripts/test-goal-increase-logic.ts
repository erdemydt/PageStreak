import {
    computeFixedIncrement,
    computeWeeksRemaining,
    evaluateWeeklyConsistency,
    shouldAttemptAutoIncrease,
} from "../utils/goalIncrease";

type TestCase = {
  name: string;
  run: () => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const now = new Date("2026-03-31T12:00:00.000Z");

const tests: TestCase[] = [
  {
    name: "auto disabled",
    run: () => {
      const decision = shouldAttemptAutoIncrease(
        0,
        30,
        60,
        "2026-03-20T00:00:00.000Z",
        now,
      );

      assert(
        decision.shouldAttempt === false,
        "Expected shouldAttempt to be false",
      );
      assert(
        decision.reason === "auto_disabled",
        "Expected reason auto_disabled",
      );
    },
  },
  {
    name: "under 5 days met",
    run: () => {
      const consistency = evaluateWeeklyConsistency(4);

      assert(
        consistency.isEligible === false,
        "Expected consistency to be ineligible",
      );
      assert(
        consistency.reason === "insufficient_goal_met_days",
        "Expected reason insufficient_goal_met_days",
      );
      assert(consistency.shortfallDays === 1, "Expected shortfallDays to be 1");
    },
  },
  {
    name: "exactly 5 days met",
    run: () => {
      const consistency = evaluateWeeklyConsistency(5);

      assert(
        consistency.isEligible === true,
        "Expected consistency to be eligible",
      );
      assert(consistency.reason === "eligible", "Expected reason eligible");
      assert(consistency.shortfallDays === 0, "Expected shortfallDays to be 0");
    },
  },
  {
    name: "already at target",
    run: () => {
      const decision = shouldAttemptAutoIncrease(
        1,
        60,
        60,
        "2026-03-01T00:00:00.000Z",
        now,
      );

      assert(
        decision.shouldAttempt === false,
        "Expected shouldAttempt to be false",
      );
      assert(
        decision.reason === "already_at_target",
        "Expected reason already_at_target",
      );
    },
  },
  {
    name: "less than one week elapsed",
    run: () => {
      const decision = shouldAttemptAutoIncrease(
        true,
        30,
        60,
        "2026-03-28T12:00:00.000Z",
        now,
      );

      assert(
        decision.shouldAttempt === false,
        "Expected shouldAttempt to be false",
      );
      assert(
        decision.reason === "less_than_one_week",
        "Expected reason less_than_one_week",
      );
    },
  },
  {
    name: "fixed increment computes expected value",
    run: () => {
      const weeksRemaining = computeWeeksRemaining(
        "2026-04-28T12:00:00.000Z",
        now,
      );
      const increment = computeFixedIncrement(30, 60, weeksRemaining);

      assert(weeksRemaining === 4, "Expected weeksRemaining to equal 4");
      assert(increment === 8, "Expected increment to equal 8");
    },
  },
  {
    name: "increment clamps to minimum one when progress remains",
    run: () => {
      const increment = computeFixedIncrement(59, 60, 10);
      assert(increment === 1, "Expected increment to equal 1");
    },
  },
];

const run = () => {
  console.log("Running goal increase logic tests...");

  for (const test of tests) {
    test.run();
    console.log(`PASS: ${test.name}`);
  }

  console.log(`All tests passed: ${tests.length}/${tests.length}`);
};

run();
