# Contributing to Hope, Inc. ERP

Thank you for contributing to the Hope, Inc. ERP project. This guide explains how our team organizes changes and submits work for review.

## Project overview

Hope, Inc. ERP is a website built with HTML, CSS, and JavaScript and connected to a Supabase (PostgreSQL) database.

Before making changes, review the project `README.md` for setup instructions and the purpose of the existing files.

## Team responsibilities

Team members should coordinate their work according to these responsibilities:

- **Developer:** implements and maintains website functionality using the project HTML and JavaScript files.
- **Database Administrator:** maintains the database schema, relationships, SQL setup, and database security policies in coordination with the Developer.
- **UI/UX Designer:** works on the visual design, page layouts, styling, and usability. Coordinate HTML changes with the Developer.
- **Tester / QA:** tests features, records reproducible bugs, and verifies fixes.
- **Scrum Master:** facilitates coordination, tracks work and blockers, and helps the team follow this contribution process.

Responsibilities may overlap. Coordinate before editing shared files such as `core.js`, `pages.js`, `style.css`, `config.js`, and individual HTML pages.

## Branch and change workflow

1. Start from the latest `main` branch.
2. Create a descriptive branch for one related task. Examples:
   - `feature/customer-management`
   - `fix/login-validation`
   - `database/update-schema`
   - `design/dashboard-layout`
   - `docs/testing-guide`
3. Make focused changes related to that task.
4. Test the changes that you can test locally. For database changes, document the SQL steps and test them in the team's Supabase development project.
5. Commit with a clear message, such as `Add customer form validation`.
6. Push your branch and open a Pull Request targeting `main`.
7. Complete review feedback and update the same Pull Request.
8. Merge only after the required review and checks are complete.

Do not commit directly to `main` unless the team has explicitly agreed that an exception is necessary.

## Pull Request expectations

Each Pull Request should:

- Have a short, specific title.
- Explain the reason for the change.
- List the important files or features changed.
- Describe the testing performed and its result.
- Link the related task or issue when available.
- Identify any known limitation or follow-up work.

Keep Pull Requests focused. Separate unrelated work into separate Pull Requests when practical. A Pull Request should represent real work; do not create empty or duplicate Pull Requests just to increase the count.

## Review process

- A team member other than the author should review the changes when possible.
- Reviewers should check correctness, readability, consistency with the existing project, and possible regressions.
- Test affected pages or database behavior before approving.
- The author should address feedback and request another review.
- The Scrum Master coordinates the process but does not replace technical review by the appropriate teammate.

## Testing guidance

When applicable, test the affected workflow in the browser using the project's local setup described in `README.md`.

For database changes, check that:
- The SQL script runs in the intended development database.
- Tables, relationships, constraints, and policies behave as expected.
- Row Level Security (RLS) is not unintentionally weakened.
- The website still works with the updated database.

Testers should record the steps to reproduce a bug, expected behavior, actual behavior, and whether the fix was verified.

## Security and configuration

- Do not commit passwords, private tokens, or Supabase `service_role` keys.
- The project README describes the browser configuration using the Supabase project URL and anon/public key. Never put a `service_role` key in frontend code.
- Coordinate changes to `config.js` with the Developer and Database Administrator.
- Use test data when possible and avoid committing private or real customer information.

## Team communication

Before editing a file that another member is actively changing, coordinate with that member. Report blockers early and keep the team task tracker up to date.

Thank you for helping keep the Hope, Inc. ERP project organized, secure, and maintainable.
