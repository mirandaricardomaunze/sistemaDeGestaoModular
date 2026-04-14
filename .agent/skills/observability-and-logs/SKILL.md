---
name: observability-and-logs
description: "Guidelines and rules for Logging, Monitoring, and Auditing in the Multicore system."
---

# 📝 Observability & Logging Standards

> 🤖 **AI INSTRUCTION (MANDATORY)**: You MUST ensure that critical operations, errors, and mutations are properly logged using standardized formats. Never log sensitive user data (PII or secrets).

This skill ensures the Multicore system is highly observable, meaning bugs, performance bottlenecks, and security events can be rapidly identified and diagnosed in a production environment.

## 1. Audit Trails (Business Logging)

- **Record Everything Important**:
  - All mutations (POST, PUT, PATCH, DELETE) relating to core business entities (Sales, Products, Users, Settings) MUST be recorded in the database's Audit/History table.
  - The audit log should clearly state: `Who` (userId), `Where` (companyId/tenantId), `What` (Entity/Action), `Before State` (JSON), and `After State` (JSON).
- **Immutable History**:
  - Audit logs are append-only. They must never be updated or deleted by the application logic.

## 2. Application Logging (Winston / Pino)

- **Structured Logging**:
  - All application logs must be in JSON format to be easily parsed by log aggregation tools (e.g., Datadog, ELK, CloudWatch).
  - Include correlation IDs (like `requestId`) to trace a single user's request across multiple services.
- **Log Levels**:
  - `ERROR`: System failures, unhandled exceptions, database connection drops. Requires immediate attention.
  - `WARN`: Handled errors, deprecation warnings, rate-limit hits, retries.
  - `INFO`: Normal application events (system started, cron job finished, user logged in).
  - `DEBUG`: Detailed flow information primarily for development/staging. Should be disabled in production.

## 3. Data Masking (PII & Secrets Prevention)

- **Sanitize Logs**:
  - NEVER log passwords, JWTs, Authorization headers, credit card numbers, or full personal identification documents in the application logs.
  - The logging utility must automatically mask fields like `password`, `token`, `secret`.

## 4. Observability Enforcement Checklist

1. [ ] Are business-critical mutations being recorded in the Audit log with Before/After states?
2. [ ] Are all errors logged with context (`userId`, `tenantId`, `requestId`) using the structured logger?
3. [ ] Are passwords and sensitive PII masked/removed before being logged?
4. [ ] Is the log level appropriate for the event (`error`, `warn`, `info`)?
