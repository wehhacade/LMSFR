# Import survey FCM tasks into ptmsmanagement

Workspace: **ptmsmanagement**  
Dashboard: https://192.168.129.41/dashboard

## Files (in repo)

| File | Use |
|------|-----|
| `docs/templates/ptms-survey-fcm-tasks.json` | **Tasks + nested todos** (recommended) |
| `docs/templates/ptms-survey-fcm-todos.json` | Extra flat todos (optional second import) |
| `docs/templates/ptms-survey-fcm-tasks.csv` | CSV import if UI supports it |

Copy to `docs/imports/` for local edits (that folder is gitignored except `.gitkeep`).

## Import steps

1. Open https://192.168.129.41/dashboard and log in.
2. Switch workspace to **ptmsmanagement** (workspace selector in the UI).
3. **Tasks import**
   - Use **Import** → upload `ptms-survey-fcm-tasks.json` (or `.csv`).
   - Nested `todos` inside each task are created automatically when using JSON.
4. **Optional second import** — only if you added extra flat todos:
   - Import `ptms-survey-fcm-todos.json` (each row needs matching `task_title` from step 3).
5. Confirm **10 tasks** appear with correct priorities and due dates.

## Task summary

| # | Task | Priority |
|---|------|----------|
| 1 | Align Firebase jimcaplaya — backend + mobile_services | high |
| 2 | Commit survey FCM backend to git | high |
| 3 | Add celery-beat to docker-compose | high |
| 4 | Rebuild mobile_services after applicationId change | high |
| 5 | E2E test survey deadline FCM push | high |
| 6 | Notification tap opens response in mobile_services | medium |
| 7 | Prevent duplicate deadline FCM notifications | medium |
| 8 | Add deadline_days to web survey submit form | medium |
| 9 | Survey FCM ops runbook | medium |
| 10 | Legacy API paths for survey FCM (optional) | low |

## Already done (close or skip in tracker)

- Backend: `/survey/fcm-token/`, `/survey/expired-deadlines/`, `deadline_days` on create, Celery task, mgmt command, tests
- Mobile: Firebase native setup, `deadline_days` on submit form, `applicationId` = `com.example.survey`, FCM register on login
- `.gitignore`: `mobile_services/`, `mobile/`, `scripts/` local-only

## Blockers

- Backend `serviceAccountKey.json` missing — must be **jimcaplaya** to match mobile `google-services.json`
- No **celery-beat** container — scheduled notifications not running until task #3 is done
