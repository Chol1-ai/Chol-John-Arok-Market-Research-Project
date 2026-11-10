# Project Guidelines

## Build-Phase Verification

After completing each build phase, verify the whole project for consistency and functionality, not only the changed feature:

- Run the backend production build and the complete test suite (`npm run backend:build` and `npm test`).
- Check JavaScript syntax for changed frontend files and run `git diff --check`.
- Verify Prisma schema and migration status when database changes are made.
- Smoke-test all affected live surfaces and end-to-end workflows in a browser when browser tools are available; check relevant API behavior and role/outlet access.
- Review related documentation and roadmap status for consistency with the implementation and test evidence.
- Fix regressions before calling the phase complete. Clearly report checks that could not be run and never describe unverified behavior as passing.

The integration test suite runs the destructive development seed and rebuilds operational data. Run it only against a disposable or explicitly designated development database; never run it against production data.
