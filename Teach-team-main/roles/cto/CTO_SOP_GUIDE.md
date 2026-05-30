# SOP: Tech Team Engineering & Maintenance Guide for CTO

This Standard Operating Procedure (SOP) provides the technical governance and operational guidelines for the **CTO & Autonomous Debugging Task Force**. It is designed to ensure maximum system stability, zero-regression deployments, and seamless cross-stack maintenance across any software project.

---

## 1. Stack-Agnostic Governance Model

The Tech Team governs codebases by dividing system components into three distinct operational layers. The CTO adapts these layers to match the exact stack configuration declared in the root `architect_blueprint.md`.

```
┌────────────────────────────────────────────────────────┐
│             Presentation & Frontend Layer              │
│       React / Next.js / Vue / Angular / Flutter        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          Database & Security Isolation Layer           │
│     Supabase / Postgres / MySQL / MongoDB / RLS        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│      Orchestration & Background Integration Layer      │
│     n8n / Temporal / Node.js APIs / Serverless         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Patterns

### 2.1 Schema-Driven Security & RLS Compliance
All persistent datastores must enforce strict isolation boundaries.
*   **Access Control**: Row-Level Security (RLS) or equivalent context-based security policies must be active on all user-accessible tables.
*   **Isolation Guard**: All SELECT, INSERT, UPDATE, and DELETE operations must filter by the active authenticated context using the project's designated resolver function.
*   **Declarative Migrations**: Schema alterations must never be executed via manual database UI consoles. They must be defined via reproducible migration files within the project’s migrations folder.

### 2.2 Workflow Orchestration & Background Tasks
Complex reasoning, AI calls, notifications, or batch-processing integrations should be isolated from presentation layers.
*   **Triggers**: Applications communicate with background controllers via authenticated webhooks or event streams.
*   **State Tracking**: Async workflows must use transactional logging to support retry policies and idempotency.

### 2.3 Component-Driven Interface Design
Frontend systems must adhere to strict modularity:
*   **State Segregation**: Clear division between local component state, cached server state, and local offline persistence models.
*   **Type Constraints**: Strong typing must govern all component interfaces and data transfer objects (DTOs).

---

## 3. Safety Protocol: Zero-Regression Patches

To apply updates or fix issues without introducing regressions, follow this strict protocol:

### 3.1 Strict Type Safety Verification
*   **No Loose Types**: The use of loose structures (such as `any` in TypeScript or unmapped dictionaries in Python) is forbidden unless explicitly permitted by the Architect.
*   **Static Analysis Gate**: Prior to staging code, execute compiler-level checks (e.g., `tsc --noEmit`, Python `mypy`, or language-specific compiler gates).

### 3.2 Relational Integrity & Schema Synchronization
*   **Incremental Additions**: When adding fields, verify all references across queries, views, and APIs are accounted for.
*   **Destructive Updates**: Before deleting code or columns:
    1. Scan the entire codebase (e.g., Grep/ripgrep) to identify all reference instances.
    2. Confirm external integration pipelines do not depend on the target element.
    3. Remove dependencies first, then execute a dry-run local compile to verify the system is free of orphan references.

### 3.3 Static Checking & Lint Rules
*   Lint checks must execute with clean status prior to promotion.

---

## 4. Operational Debugging Protocol

When an issue is reported, isolate the root cause using the **Golden Debugging Trio**:

```
                  ┌──────────────────────┐
                  │ 1. Telemetry & Logs  │
                  │ Check failing status │
                  │ and console exceptions│
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
┌───────────▼───────────┐         ┌───────────▼───────────┐
│  2. Cache & Persistence│         │  3. Boundary Context  │
│ Verify stale cache state│         │ Verify tenant JWT /   │
│ and storage sync flows│         │ RLS context filters   │
└───────────────────────┘         └───────────────────────┘
```

*   **Telemetry & Logs**: Check network responses, API gateways, and system console pipes for uncaught exceptions.
*   **Cache & Persistence**: Inspect state caching layers to identify sync discrepancies.
*   **Boundary Context**: If data is missing or queries return blank arrays even though data exists, verify that active user sessions, token payloads, and database row owners align.

---

## 5. Generic Feature Integration Path

Integrating a new system capability follows a four-step lifecycle:
1.  **Schema / Data Contract Formulation**: Prepare database tables, schemas, or models via migrations.
2.  **Orchestration / Logic Setup**: Set up backend routes, cron jobs, or workflow listeners.
3.  **Client-Side Integration Hooks**: Build query hooks, local state controllers, or data providers.
4.  **UI Component Mounting & Route Registration**: Build accessible interface views and register paths.

---

## 6. Pre-Commit Integrity Checklist

| Target Check | Purpose | Local Command Example |
| :--- | :--- | :--- |
| **Static Compliance** | Validate code formatting and rules. | `npm run lint` / `flake8` / standard linter |
| **Compilation Gate** | Check type and syntax integrity. | `npx tsc --noEmit` / compiler dry-run |
| **Telemetry & Schema** | Check structural drift and sequence. | `node scripts/diagnose_telemetry.js` |
| **E2E Smoke Verification** | Check page mounting and exception absence. | `node scripts/verify_ui_e2e.js` |

---

**Prepared by the Autonomous Tech Team**  
*Version 2.0 | General Release*
