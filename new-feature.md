# Implementation Prompt: eGuard Parent Care Automation Engine

## Project Context

You are working on the existing production application **eGuard**, a family and child online safety platform.

Your task is to implement a new feature called:

**eGuard Parent Care Automation Engine**

The purpose of this feature is to proactively help parents remain engaged with eGuard by delivering useful family safety guidance, tracking meaningful activities, sending appropriate reminders, and reactivating inactive parents.

This must be implemented as a new feature within the existing application, not as a replacement application, separate prototype, or unnecessary microservice.

## 1. Primary Objectives

Implement a production-ready automation system that:

1. Increases 7-day and 30-day parent retention.
2. Reactivates parents who have stopped using eGuard.
3. Encourages parents to complete useful family safety activities.
4. Personalizes communications based on available preferences and activity history.
5. Supports push notifications, email, and in-app notifications.
6. Provides administrators with visibility and control over automations.
7. Protects user consent, privacy, notification preferences, and production stability.

Measure success through meaningful actions and retention, not merely app opens or notification clicks.

## 2. Mandatory Repository Audit

Before modifying the codebase, inspect the existing project.

Identify and document:

- Frontend framework and application structure.
- Backend framework and API organization.
- Database technology, schema, migrations, and ORM.
- Authentication and authorization implementation.
- Existing user, parent, family, and child data models.
- Existing notification and messaging infrastructure.
- Push notification provider and device-token management.
- Email delivery provider and existing email templates.
- In-app notification components.
- Existing background workers, schedulers, queues, or cron jobs.
- Existing admin dashboard and permission model.
- Analytics, logging, testing, deployment, and environment configuration.

Search for reusable components before creating new ones.

Do not assume a particular framework, database, provider, route, or schema. Discover these from the repository.

Produce a concise implementation plan identifying which existing components will be reused and which new components are required.

Then proceed with implementation unless blocked by a genuinely missing external credential, destructive migration risk, or essential architectural uncertainty.

## 3. Architecture Requirements

Integrate the feature into the existing architecture.

Implement the following logical components using the project's established conventions:

### A. Event Collector

Capture relevant lifecycle and engagement events, including:

- Parent registration.
- Qualifying parent activity.
- Safety activity started.
- Safety activity completed.
- Weekly plan started.
- Notification delivered.
- Notification clicked.
- Notification opted out.
- Parent reactivated.

Reuse existing analytics and activity records where possible.

Events must be validated, deduplicated, and associated with the correct authenticated user.

Use stable event identifiers and timestamps. Do not trust client-supplied user or family identifiers without authorization checks.

### B. Automation Rule Engine

Create a reusable mechanism for evaluating triggers, eligibility conditions, scheduling rules, and campaign state.

The engine must support:

- Event-triggered automations.
- Time-triggered automations.
- Multi-step campaigns.
- Delayed actions.
- Cancellation of obsolete scheduled work.
- Frequency limits.
- Consent and preference enforcement.
- Automation enable/disable controls.
- Versioned automation definitions where appropriate.

Avoid implementing each automation as an unrelated collection of hardcoded notification handlers.

### C. Scheduler and Job Processing

Reuse the existing job queue or scheduler if available.

If none exists, implement the simplest reliable background-processing solution compatible with the current stack.

Support:

- Due-job processing.
- Idempotent execution.
- Safe concurrent processing.
- Bounded retries with exponential backoff and jitter.
- Permanent failure handling.
- Failed-job inspection.
- Recovery from worker restarts.
- Cancellation of pending jobs.
- Appropriate database transactions and locking.

Do not send notifications directly from user-facing HTTP requests when delivery can be scheduled asynchronously.

Do not introduce a new message broker or infrastructure dependency unless necessary.

### D. Notification Delivery Adapters

Implement a shared delivery interface for:

- Push notifications.
- Email.
- In-app notifications.

Reuse the existing notification providers, templates, authentication, and device-token management.

If a channel is not currently configured, implement its integration boundary and clearly document the required environment variables and credentials. Never fabricate successful delivery.

Prevent duplicate messages when jobs are retried.

Track provider acceptance, actual delivery when supported, clicks, and meaningful follow-up actions separately.

## 4. Initial Automations

Implement the following five automations.

### Automation 1: Family Safety Briefing

Purpose: Deliver practical safety guidance on a schedule chosen by the parent.

Requirements:

- Default to three times per week, subject to parent preferences.
- Support parent-selected delivery time and language.
- Use approved content from an existing content library where available.
- Avoid repetitive, outdated, irrelevant, or already-delivered content.
- Include one practical tip and one suggested action.
- Provide a relevant deep link into the application.
- Allow the parent to disable or adjust the frequency.

Do not fabricate current threats or present unverified information as fact.

### Automation 2: Incomplete Activity Follow-up

Purpose: Help parents finish activities they have started.

Requirements:

- Detect eligible incomplete activities.
- Schedule a follow-up approximately 24 hours later.
- Recheck whether the activity is still incomplete before sending.
- Cancel pending reminders when the activity is completed, becomes invalid, or is no longer relevant.
- Include a direct link to continue the activity.
- Avoid repeated reminders for the same activity.

### Automation 3: Weekly Family Safety Plan

Purpose: Give parents a manageable plan containing one or two useful activities.

Requirements:

- Generate or select a weekly plan based on approved content, age-appropriate categories, parent preferences, and previous completions where available.
- Schedule delivery at the parent's preferred time.
- Avoid recommending activities that have already been completed unnecessarily.
- Track plan creation, delivery, opening, and activity completion.
- Include a direct link to begin an activity.

Do not require AI generation for the first version if a curated content library can provide reliable recommendations.

### Automation 4: Inactive Parent Reactivation

Purpose: Re-engage parents who have stopped taking meaningful actions in eGuard.

Initial sequence:

- Day 7 of inactivity: Send one useful, personalized resource.
- Day 14 of inactivity: Send a second helpful suggestion if the parent remains inactive.
- Day 21 of inactivity: Send a final respectful check-in if appropriate.

Treat these as configurable defaults, not mandatory sends.

Requirements:

- Define qualifying activity using real application events.
- Exclude passive opens and background activity.
- Enroll only eligible, active accounts.
- Recheck inactivity before every message.
- Cancel the remaining sequence immediately after a qualifying return.
- Stop when consent is withdrawn, the account is disabled, or the parent opts out.
- Apply global and campaign-specific contact limits.
- Avoid guilt, fear-based messaging, or manipulative language.

Track reactivation as a qualifying action after inactivity, not merely an app launch.

### Automation 5: Monthly Family Progress Report

Purpose: Demonstrate the value parents have received from eGuard.

Requirements:

- Summarize genuine completed activities.
- Present accurate progress metrics.
- Suggest a practical next step.
- Use existing activity data rather than invented statistics.
- Send through the parent's permitted channel.
- Support in-app viewing and email delivery where configured.
- Allow the parent to disable optional reports.

Never claim that a family is completely safe or that an activity reduced risk unless the application has evidence supporting that claim.

## 5. Database and Data Model

Inspect the existing schema before adding tables.

Reuse existing user, family, notification, activity, and consent records wherever possible.

Implement equivalent models or schema extensions for the following logical entities, merging them with existing tables when appropriate:

### Parent Care Preferences

Fields may include:

- User reference.
- Timezone.
- Preferred language.
- Automation enabled status.
- Push, email, and in-app preferences.
- Preferred briefing days and delivery time.
- Quiet hours.
- Updated timestamp.

### Automation Definitions

Fields may include:

- Unique automation key.
- Name and description.
- Trigger type.
- Configuration and eligibility rules.
- Template reference.
- Enabled status.
- Version.
- Created and updated timestamps.

### Automation Enrollments

Fields may include:

- User reference.
- Automation reference.
- Enrollment status.
- Start timestamp.
- Last processed step.
- Next scheduled step.
- Completion timestamp.
- Exit reason.

### Automation Jobs

Fields may include:

- User reference.
- Automation reference.
- Related event or enrollment.
- Scheduled timestamp.
- Job status.
- Attempt count.
- Unique idempotency key.
- Last error code.
- Processing timestamp.

### Parent Care Message History

Fields may include:

- User reference.
- Automation and job references.
- Delivery channel.
- Template reference.
- Delivery status.
- Provider message reference.
- Sent, delivered, and clicked timestamps when available.

### Parent Care Events

Fields may include:

- Unique event identifier.
- User and authorized family references.
- Event type.
- Occurrence timestamp.
- Minimal event metadata.

### Suppression and Contact Restrictions

Support explicit opt-outs, temporary campaign suppression, cooldown periods, and other contact restrictions.

Use appropriate foreign keys, indexes, uniqueness constraints, transactions, and retention policies.

Use the existing migration framework. Do not reset, drop, or destructively recreate production tables.

Do not store unnecessary child information, sensitive incident details, message contents, passwords, or authentication codes in automation metadata.

## 6. Scheduling and Eligibility Rules

Implement a centralized eligibility check before scheduling and immediately before delivery.

At minimum, verify:

- Account is active.
- Automation is enabled.
- The parent has appropriate consent for the communication purpose and channel.
- The channel is available and permitted.
- The parent has not opted out.
- Quiet hours are respected.
- Global and campaign-specific frequency limits are respected.
- The message has not already been sent for the same intended step.
- The triggering activity remains relevant.
- The parent has not already completed the action.
- Reactivation conditions still hold.

Use the parent's stored timezone. Use Asia/Manila as the default only when justified by the application's existing locale or explicit parent settings.

Store timestamps consistently and convert to local time for scheduling.

Support daylight-saving-safe timezone handling even if the initial rollout primarily targets the Philippines.

Define configurable global contact limits. Start with no more than one proactive push or email per day and no more than three proactive push/email messages in a rolling seven-day period, counting all campaigns together. In-app messages should also be frequency-limited.

Do not send the same content through multiple channels by default. Use a deliberate channel preference and fallback policy.

Never use marketing-style engagement automation to suppress or delay important safety communications that have a separate, legitimate operational purpose.

## 7. Admin Dashboard

Add an administrative section to the existing admin application.

Reuse the existing UI components, routing, design system, authentication, and permission model.

Provide the following views.

### Engagement Overview

Display:

- Weekly active families.
- Seven-day retention.
- Thirty-day retention.
- Eligible inactive parents.
- Reactivated parents.
- Safety activities completed.
- Notification engagement and opt-outs.

### Automation Management

Allow authorized administrators to:

- View available automations.
- Enable or pause automations.
- Inspect configuration and schedule.
- Review templates.
- Inspect enrollment and completion counts.
- Review campaign-level performance.

### Delivery Operations

Display:

- Pending jobs.
- Successfully processed jobs.
- Delivery failures.
- Retry counts.
- Provider errors.
- Permanently failed jobs.
- Duplicate-send incidents.

Provide safe retry controls where appropriate.

### Trust and Compliance

Display:

- Consent and suppression status.
- Channel availability.
- Contact frequency.
- Template approval status.
- Administrative changes and audit history.

Use aggregated reporting by default. Restrict access to individual parent records to authorized personnel with a legitimate operational purpose.

Require confirmation for consequential actions such as pausing a live campaign or retrying failed messages at scale.

## 8. API Integration

Follow existing route naming, authentication, response format, validation, and authorization conventions.

Implement equivalent functionality for:

- Reading parent preferences.
- Updating parent preferences.
- Listing suggested and pending activities.
- Recording activity completion.
- Reading in-app messages.
- Recording message interactions.
- Ingesting internal events.
- Reading aggregated admin metrics.
- Managing automation status.
- Inspecting failed jobs.

Do not create duplicate APIs if equivalent existing endpoints can be safely extended.

Validate all inputs server-side and enforce ownership checks for parent-facing operations.

Use the existing authorization mechanism for admin-only endpoints.

Do not expose provider credentials, internal error traces, or other users' records.

## 9. Frontend Requirements

Add a parent-facing settings section using the existing eGuard interface.

Parents must be able to:

- Enable or disable optional parent-care automations.
- Select allowed communication channels.
- Configure briefing frequency and delivery time.
- Select supported language preferences.
- Configure quiet hours where supported.
- View recommended safety activities.
- Mark activities complete.
- View recent in-app notifications.
- Manage communication preferences and opt-outs.

Integrate with existing notification settings instead of introducing contradictory preference controls.

Add appropriate loading, empty, success, error, and offline states.

Ensure the experience is responsive and accessible.

Use clear, supportive, non-alarming language appropriate for families in the Philippines.

## 10. Analytics and KPIs

Instrument the complete automation lifecycle.

Track:

- Automation eligibility.
- Enrollment.
- Job scheduling.
- Job cancellation.
- Delivery attempts.
- Provider acceptance.
- Delivery confirmation when available.
- Message interaction.
- Activity started.
- Activity completed.
- Parent reactivation.
- Opt-out.
- Permanent delivery failure.

Implement aggregated reports for:

- Seven-day retention.
- Thirty-day retention.
- Reactivation rate within seven days.
- Activity completion rate.
- Campaign conversion.
- Channel-specific opt-out rate.
- Delivery reliability.
- Duplicate-send rate.
- Automation failure rate.

Use clearly defined denominators and attribution windows.

When practical, implement a randomized holdout group for evaluating incremental retention improvements. Do not claim causal impact from simple before-and-after comparisons.

Initial pilot goals may include a 10% relative improvement in seven-day retention, a 5% relative improvement in thirty-day retention, and a 15–25% reactivation rate among eligible inactive parents. Treat these as hypotheses to validate, not guaranteed results.

## 11. Privacy, Security, and Reliability

Implement the following safeguards:

- Data minimization and purpose limitation.
- Consent-aware channel selection.
- Immediate opt-out enforcement.
- Secure handling of device tokens and provider credentials.
- Server-side ownership and role checks.
- Rate limiting on exposed endpoints.
- Validated event ingestion.
- Idempotent job processing.
- Audit logging for administrative changes.
- Retention and deletion policies.
- Safe message previews that avoid sensitive child information.
- Protection against duplicate delivery after retries.
- Monitoring for unexpected opt-out increases and delivery failures.

Review the implementation against applicable Philippine privacy requirements, including the Data Privacy Act of 2012 and relevant National Privacy Commission guidance.

Do not claim legal compliance without appropriate review.

Do not introduce surveillance capabilities or claim to monitor children's devices, browsing, or private conversations unless such functionality already exists and has been properly authorized.

## 12. Testing Requirements

Write tests using the repository's existing testing framework.

At minimum, cover:

### Unit Tests

- Trigger evaluation.
- Eligibility rules.
- Timezone scheduling.
- Quiet hours.
- Frequency caps.
- Consent enforcement.
- Inactivity calculations.
- Reactivation sequence cancellation.
- Idempotency.
- Retry classification.
- Template rendering.

### Integration Tests

- Event ingestion to scheduled job.
- Scheduled job to channel adapter.
- Activity completion cancelling a reminder.
- Parent reactivation cancelling subsequent messages.
- Opt-out preventing delivery.
- Provider failure and recovery.
- Admin authorization.
- Migration compatibility.

### End-to-End Tests

- Parent configures preferences.
- Parent receives an eligible in-app message.
- Parent completes an activity.
- Pending reminder is cancelled.
- Inactive parent re-enters the application and is removed from the reactivation sequence.
- Administrator pauses an automation.

Use mocks or sandbox credentials for external providers. Never send test messages to real parents during automated test runs.

## 13. Implementation Order

Work in this order:

1. Audit and map the current architecture.
2. Document reuse decisions and implementation plan.
3. Implement schema changes and reversible migrations.
4. Implement event tracking and preference management.
5. Implement the shared rules engine and scheduler.
6. Implement delivery adapters and message history.
7. Implement the five initial automations.
8. Add parent-facing settings and activity views.
9. Add admin management and analytics.
10. Add tests, observability, and operational safeguards.
11. Run migrations and tests in a safe development or staging environment.
12. Document deployment, rollback, configuration, and monitoring.
13. Prepare a staged production rollout with a small consenting pilot cohort.

Do not disable existing features or alter unrelated business logic to make the new feature easier to implement.

## 14. Coding and Execution Rules

- Work directly in the existing repository.
- Preserve the current technology stack and established conventions.
- Reuse existing services and components.
- Do not create a separate app or rewrite the entire backend.
- Do not assume unavailable dependencies or provider credentials.
- Do not hardcode secrets.
- Do not fabricate data, delivery results, or completed integrations.
- Do not use destructive production database operations.
- Do not silently swallow exceptions.
- Do not leave core functionality as TODO comments or placeholder implementations.
- Do not declare success until tests have actually run and results have been inspected.
- Keep changes scoped to this feature.
- If an existing architectural limitation blocks a requirement, document it and implement the safest compatible alternative.
- Ask for clarification only when a genuinely essential decision cannot be inferred from the repository or implemented safely.

## 15. Final Deliverables

After implementation, provide:

1. Summary of the existing architecture discovered.
2. List of files created and modified.
3. Database migrations and schema changes.
4. Implemented automations and their trigger rules.
5. APIs and frontend routes added or extended.
6. Admin dashboard capabilities.
7. Required environment variables and external provider configuration.
8. Tests executed and their actual results.
9. Deployment and rollback instructions.
10. Known limitations and follow-up work.
11. A production-readiness checklist.

Clearly distinguish implemented functionality from functionality requiring external credentials, configuration, or additional approval.

## Definition of Done

The feature is ready for a controlled pilot only when:

- It integrates into the existing eGuard application.
- Parent preferences and consent are enforced.
- Jobs are idempotent and recoverable.
- Activity completion cancels related reminders.
- Reactivation stops when a parent returns.
- Push, email, and in-app channels use actual configured integrations.
- Administrators can monitor and control automations.
- Retention and reactivation outcomes are measurable.
- Automated tests pass, with failures and untested areas explicitly reported.
- Deployment and rollback procedures are documented.
- No destructive production changes have been performed.

Begin by inspecting the existing repository, then implement the feature incrementally and verify each stage.