# Story 1.1: Set up initial project from starter template

## Metadata
- Story Key: 1-1-set-up-initial-project-from-starter-template
- Epic: Epic 1 - Start Private Ledger and Account Baseline
- Status: done
- Created: 2026-04-30T18:20:33.3793366+05:30
- Last Updated: 2026-04-30T18:45:28.8852718+05:30
- Source: _bmad-output/planning-artifacts/epics.md

## User Story
As a privacy-conscious user,
I want the app initialized with a local-first desktop foundation,
So that my financial workflows run without cloud dependency.

## Acceptance Criteria
1. Given a fresh repository, when the project is scaffolded with Tauri v2 + React + TypeScript + Vite and SQLite plugin support, then the app can run locally in development and build Windows artifacts.
2. No core feature path requires external network connectivity.

## Implementation Checklist
- [x] Scaffold app with create-tauri-app using Tauri v2 + React + TypeScript + Vite.
- [x] Add and configure Tauri SQL plugin with SQLite support.
- [x] Ensure local-first architecture defaults (no external API dependency in core paths).
- [x] Configure package scripts for local dev run and Windows build.
- [x] Validate development startup on Windows.
- [x] Validate Windows build artifact generation.
- [x] Document setup and run commands in project README.

## Technical Notes
- Follow architecture constraints from planning artifacts.
- Keep command boundary typed between frontend and Tauri commands.
- Restrict native capabilities to the minimum needed for local-first flows.

## Definition of Done
- Project scaffolding is committed and runnable locally.
- SQL plugin is integrated and SQLite-backed commands are wired for initial use.
- Windows artifacts build successfully.
- Local-first invariant is maintained for MVP core workflows.
