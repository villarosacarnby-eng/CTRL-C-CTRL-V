# Hope, Inc. ERP — QA Coordination Plan

## Purpose
This document helps the Scrum Master coordinate testing with the Tester / QA member. The Tester owns test execution and technical findings; the Scrum Master helps track status and follow-up.

## Areas identified in the project README
- Landing page and authentication: `index.html`, `login.html`, `register.html`, `forgot-password.html`, `reset-password.html`
- Dashboard: `dashboard.html`
- Customers and products: `customers.html`, `products.html`, `price-history.html`
- Human Resources: `hr.html`, `hr-jobs.html`, `hr-departments.html`, `job-history.html`
- Sales: `sales.html`, `sale-form.html`, `sale-details.html`
- Reports and administration: `reports.html`, `users.html`, `settings.html`

## Test record template
For each test, record:
- Test ID:
- Feature / page:
- Preconditions / test account role:
- Steps:
- Expected result:
- Actual result:
- Result: Pass / Fail / Blocked
- Evidence or screenshot reference:
- Tester:
- Date:

## Defect record template
For each defect, record:
- Bug ID and short title:
- Affected page / feature:
- Severity: Critical / High / Medium / Low
- Steps to reproduce:
- Expected behavior:
- Actual behavior:
- Browser / environment:
- Screenshot or console error:
- Assigned owner:
- Status: Open / In Progress / Ready for Retest / Closed

## Coordination checklist
- [ ] Confirm the feature is ready for testing.
- [ ] Confirm the test account and role needed.
- [ ] Record test results and reproducible defects.
- [ ] Link defects to the relevant GitHub issue or Pull Request.
- [ ] Retest fixes before closing defects.
- [ ] Include unresolved issues in the Sprint Review.

## Important notes
- Test with sample data and an appropriate development Supabase project.
- Never include real passwords, private customer data, or secret keys in test evidence.
- The README notes that System Settings is currently a placeholder; do not report placeholder behavior as a defect unless the team has agreed that the page should be implemented.
- The README describes the Reports page's Save as PDF action as using the browser print window; test against that documented behavior.
