---
name: security-and-auth
description: "Enterprise-grade security, authentication, authorization, and data integrity standards for the Multicore system."
---

# 🛡️ Security & Authentication Standards

> 🤖 **AI INSTRUCTION (MANDATORY)**: You MUST enforce these security rules on every code generation or modification. Do not bypass rate limiting, password hashing, or role-based access checks. Do not allow SQL injection vulnerabilities or XSS loopholes.

This skill ensures the Multicore system remains secure against external and internal threats, protecting tenant data and system integrity.

## 0. Git, Secrets & Agent Skills

- The agent MUST NEVER stage, commit, or push real secrets or sensitive data, including `.env`, `.env.production`, credentials, API keys, JWT secrets, DATABASE_URL, Supabase/OpenAI/Gemini keys, database dumps, logs with PII, or generated files containing real customer/company data.
- The agent MUST NEVER stage, commit, or push agent skills/instructions (`.agent/skills/`, `.agents/skills/`, `.claude/`, `CLAUDE.md`, or equivalent rule files) unless the project owner explicitly asks to version those rule changes.
- Before any authorized commit or push, the agent MUST inspect `git status --short` and the staged diff to confirm no secrets, real tenant data, or private agent instructions are included.
- If a secret is already tracked by Git, the agent MUST stop, report the risk, and recommend removal plus credential rotation. Do not hide, normalize, or push the secret.

## 1. Authentication (Login & Identity)

- **Passwords & Secrets**: 
  - Never store plain-text passwords. 
  - Always use a strong hashing algorithm (e.g., `bcrypt` or `argon2`) with an appropriate salt/cost factor before saving to the database.
  - Never log passwords or secrets in terminal output or log files.
- **Tokens (JWT)**:
  - Tokens must have expiration times (`expiresIn`) that are appropriately short.
  - Sensitive data (like passwords or PII) MUST NOT be included in the JWT payload. Include only identifiers (`userId`, `companyId`, `role`).
  - Refresh tokens, if used, should be securely stored (e.g., HttpOnly cookies) and rotatable.

## 2. Authorization (Access Control)

- **Tenant Isolation**: (Refer to `multicore` skill rules). All requests must be scoped to the authenticated `companyId`/`tenantId`.
- **Role-Based Access Control (RBAC)**:
  - Validate the user's role/permissions *before* executing business logic in the Service layer.
  - Destructive operations (DELETE), financial manipulations, or sensitive data exports MUST be restricted to `Admin` or `Manager` roles.
  - Controllers must extract user identity and pass it explicitly to Services so Services can enforce permission checks.

## 3. Data Integrity & Input Validation

- **Zod Validation**:
  - Never trust HTTP inputs (`req.body`, `req.query`, `req.params`).
  - All incoming data MUST pass through strict Zod schemas.
  - Use `z.string().trim()` and define `.min()` and `.max()` length limits to prevent oversized payload attacks.
- **SQL / NoSQL Injection Prevention**:
  - Since Prisma is used, rely on Prisma's parameterized queries. 
  - NEVER concatenate raw strings into `prisma.$queryRaw`. If raw queries are absolutely necessary, use Prisma's safe tagged template string`` Prisma.sql`.

## 4. API Protection (Rate Limiting & Headers)

- **Rate Limiting (Brute Force Protection)**:
  - Public authentication routes (Login, Register, Forgot Password) MUST have aggressive rate limiting.
  - Standard API routes should have sensible rate limits to prevent DoS attacks.
- **Security Headers**:
  - Ensure the application runs with standard security middleware (e.g., `helmet` for Express).
  - Configure CORS carefully. In production, only allow strictly defined origins (no `*`).

## 5. Security Enforcement Checklist

1. [ ] Are passwords being hashed before storage?
2. [ ] Are user inputs strictly validated using Zod?
3. [ ] Is the endpoint protected against Unauthorized (401) and Forbidden (403) access?
4. [ ] Are there checks to ensure Tenant Data Isolation?
5. [ ] Are public/auth routes rate-limited?
