# Coforma Studio Documentation

> [!IMPORTANT]
> Do not duplicate raw customer feedback, tenant records, OAuth identities, integration tokens, billing data, exports, webhook payloads, or production credentials in docs. Link to controlled workflows and describe data shapes instead.
> Operations that export/import customer data, run live integration syncs, or mutate production state require explicit operator intent and the appropriate local guard when invoked from a workstation.

Technical documentation for developers, operators, and stakeholders.

## 📊 Project Status

- **[Project Status](../PROJECT_STATUS.md)** - Current implementation status
- **[Latest Audit](./reports/COMPREHENSIVE_AUDIT_2025-11-19.md)** - Comprehensive audit (2025-11-19)
- **[RLS Implementation](./architecture/RLS_IMPLEMENTATION_SUMMARY.md)** - Multi-tenant security details

## Contents

### Architecture ✅ Available
- **[Database Schema](./database-schema.md)** - Database tables, relationships, and RLS policies
- **[API Specification](./api-specification.md)** - REST and tRPC endpoint documentation

### Operations ✅ Available
- **[Deployment Guide](./deployment.md)** - Current path: `build-deploy.yml` → GHCR → cosign → digest pin → Argo CD (web only). The Vercel/Railway runbooks below its first section are historical.
- **[Deploy Readiness (2026-07-07)](./deploy-readiness.md)** - Why only the web shell ships today

### Security ✅ Available
- **[Security Policy](../SECURITY.md)** - Security practices and vulnerability reporting
- **[RLS Implementation](./architecture/RLS_IMPLEMENTATION_SUMMARY.md)** - Multi-tenant isolation details
- **[Testing Guide](../packages/api/test/README.md)** - How to test RLS and security

### Development ✅ Available
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to the project
- **[Testing Guide](../packages/api/test/README.md)** - Unit, integration, and RLS testing
- **[README](../README.md)** - Quick start and setup

### Business ✅ Available
- **[Product Vision](./business/PRODUCT_VISION.md)** - Mission and vision
- **[Software Specification](./architecture/SOFTWARE_SPEC.md)** - Functional requirements
- **[Operating Model](./business/OPERATING_MODEL.md)** - Team structure and processes
- **[Business Development](./business/BIZ_DEV.md)** - Go-to-market strategy
- **[Technology Stack](./architecture/TECH_STACK.md)** - Technology decisions and rationale

### 🚧 Coming Soon

The following documents are referenced in planning but not yet created:
- System Architecture - High-level system design diagrams
- Multi-Tenancy Guide - Deep dive into tenant isolation
- Environment Setup - Detailed local development guide
- Database Migrations - Migration workflow and best practices
- Monitoring - Logging, error tracking, and alerts setup
- Secrets Management - Managing API keys and credentials
- Code Style - Coding standards (see CONTRIBUTING.md for now)

### 📁 Archive

- **[Archived Docs](./archive/)** - Outdated documentation preserved for historical reference
