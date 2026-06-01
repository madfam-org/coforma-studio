# Coforma Studio Public Repo Sanitization Contract

Date: 2026-06-01
Status: launch-blocking when Coforma Studio is used in an active SKU, customer demo, studio workflow, or delivery proof

## Position

Coforma Studio is a customer/delivery-facing studio surface. Public repo sanitization must ensure test env files, API docs, studio claims, and package examples are safe and commercially truthful.

## Current remediation posture

- `packages/api/.env.test` has been rewritten as a synthetic public-safe test environment file.
- No repo-level pass is granted until current-tree scan, history scan, public artifact review, and owner approval are recorded in Tulana.

## Launch-blocking checks

A Coforma-linked platform/SKU cannot pass Product/Offer GA public-repo sanitization until evidence confirms:

- Test env values are synthetic and non-production.
- API and studio docs do not overstate production availability or fulfillment capability.
- Public packages/examples contain no customer assets, tenant identifiers, or internal delivery data.
- Local, staging, and production surfaces are clearly separated.
