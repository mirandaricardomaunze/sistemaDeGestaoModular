---
name: testing-standards
description: "Guidelines and rules for automated testing, mocking, and coverage in the Multicore system."
---

# 🧪 Testing Standards

> 🤖 **AI INSTRUCTION (MANDATORY)**: When generating new core features, especially financial or inventory logic, you must actively suggest or generate accompanying unit tests. Ensure tests follow the AAA pattern and never touch the real database.

This skill ensures the Multicore system's reliability through automated testing. Code that is not tested is code that is broken by default.

## 1. Test Architecture & Principles

- **AAA Pattern**: All tests must follow the **Arrange, Act, Assert** structure clearly.
  - *Arrange*: Setup data, mocks, and inputs.
  - *Act*: Call the function/service being tested.
  - *Assert*: Verify the output and side effects (e.g., was the mock called?).
- **Isolation (Mocks)**:
  - Unit tests MUST NOT connect to the real database or external APIs.
  - Use `jest-mock-extended` (or similar) to mock Prisma (`prismaMock`).
  - Mock external services (e.g., Email, M-Pesa, SMS).

## 2. What to Test

1. **Business Logic (Services)**:
   - This is the highest priority. Complex calculations, inventory decrement, financial totals, and permissions logic MUST have exhaustive unit testing.
2. **Edge Cases & Errors**:
   - Don't just test the "happy path". Test what happens when input is missing, stock is low, or permissions are denied.
   - Verify that the correct custom Errors are thrown.
3. **Data Validation**:
   - Write tests for Zod schemas to ensure they correctly reject invalid structures or sanitize inputs.

## 3. Test Quality Rules

- **Descriptive Names**:
  - *Poor*: `it("should calculate correctly", ...)`
  - *Good*: `it("should calculate total with 17% IVA when products are taxable", ...)`
- **One Assertion Concept**:
  - Each `it` block should test ONE logical outcome or side effect.
- **No Flaky Tests**:
  - Tests should not depend on real time (`Date.now()`), network state, or execution order. Mock timers if necessary.

## 4. Testing Enforcement Checklist

1. [ ] Is the business logic covered by unit tests?
2. [ ] Does the test structure follow the AAA (Arrange, Act, Assert) pattern?
3. [ ] Are database calls and external dependencies correctly mocked?
4. [ ] Are edge cases and error states tested, not just the happy path?
