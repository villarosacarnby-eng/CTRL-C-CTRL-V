# Hope, Inc. ERP — Project Plan

## 1. Project overview
Hope, Inc. ERP is a browser-based business management website built with HTML, CSS, and JavaScript and connected to a Supabase (PostgreSQL) database.

The documented modules include:
- Authentication and account access
- Dashboard
- Customers and products
- Product price history
- Human Resources: employees, jobs, departments, and job history
- Sales, sale details, and reports
- User management and system settings

## 2. Project objective
Coordinate the team to deliver a working, understandable, and tested ERP website whose pages use the shared Supabase database and whose access rules are respected.

## 3. Team roles
| Role | Main responsibility |
|---|---|
| Developer | Implement and maintain website features and application logic |
| Database Administrator | Maintain database schema, SQL setup, relationships, and database security |
| UI/UX Designer | Improve page layout, visual consistency, and usability |
| Tester / QA | Prepare and execute tests, record defects, and verify fixes |
| Scrum Master | Facilitate Scrum events, track progress and blockers, and support team coordination |

## 4. Work approach
The team should organize work into short sprints:
1. Select a realistic sprint goal.
2. Break the goal into small, assignable tasks.
3. Agree on acceptance criteria before work starts.
4. Update task status as work progresses.
5. Demonstrate completed work during the review.
6. Record improvements during the retrospective.

## 5. Definition of Done
A task may be considered done when:
- The agreed work has been implemented.
- The affected page or database behavior has been tested.
- No known critical defect remains unresolved.
- Documentation is updated when necessary.
- The change has been reviewed and merged according to the team's repository rules.

## 6. Risks and coordination
- Shared files such as `core.js`, `pages.js`, `style.css`, `config.js`, and HTML pages can be edited by more than one role. Coordinate ownership before editing.
- Database changes may affect multiple pages. The Database Administrator and Developer should review these changes together.
- Do not place Supabase service-role keys, passwords, or private tokens in frontend files or Git commits.
- Test database changes in a development project before applying them to a live project.

## 7. Progress and approval
Track tasks in the team's agreed project board. Use GitHub Pull Requests to document proposed changes, review them, and preserve the contribution history.

> Update this plan with the actual sprint dates, team names, and agreed project priorities. Do not report planned work as completed work.
