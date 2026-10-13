# Operator account and test isolation

- Preserve the application operator's Super Admin username and password during development, audits, testing, fixture creation and cleanup. Do not rotate, reset, rename, disable or replace that account unless the human user explicitly requests that account change.
- Run database-mutating automated tests against a dedicated disposable localhost database ending in `_test`. Use separately provisioned test owners and Platform administrators. Never borrow or modify the application operator account for a test.
- Keep operator passwords out of source code, seeded defaults, documentation and version control. The ignored Windows DPAPI access handoff is for local operator access only.
- Preserve existing customer data and unrelated working-tree changes. Do not change another project's database credentials or configuration as part of this project's work.
