# Security Fixes Tracker — Clipper/Cuttr

**Started:** 2026-04-06
**Total Issues:** 42
**Approach:** Test → Fix → Verify for each issue

Legend: ⬜ Not started | 🟡 In progress | ✅ Fixed | 🧪 Test written

---

## Phase 1: CRITICAL — SSRF (6 issues)

### 1A. SSRF-VULN-01 — Unauthenticated Open Proxy ✅

| Field                    | Value                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Vuln**                 | `GET /api/face-swap/download-fixed-public?url=<ANY>&mode=direct` fetches ANY URL with zero auth |
| **File**                 | `backend/src/controllers/faceSwap.controller.ts:242`                                            |
| **Impact**               | AWS credential theft via `http://169.254.170.2/v2/credentials/`                                 |
| **Test file**            | `backend/src/controllers/__tests__/faceSwap.controller.test.ts`                                 |
| **Test case**            | `it("rejects private IP URLs with 400")` / `it("requires authentication")`                      |
| **Test result (before)** | ⬜                                                                                              |
| **Test result (after)**  | ⬜                                                                                              |

**Smoke test (local dev):**

```bash
# Should return 401 (requires auth now):
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/face-swap/download-fixed-public?url=http://169.254.169.254/latest/meta-data/&mode=direct"
# Expected: 401FFP

# With auth, should return 400 (blocked URL):
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/face-swap/download-fixed-public?url=http://169.254.169.254/latest/meta-data/&mode=direct" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
"
# Expected: 400

# With auth, should return 400 (localhost blocked):
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/face-swap/download-fixed-public?url=http://127.0.0.1:3001/health&mode=direct" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
"
# Expected: 400
```

---

### 1B. SSRF-VULN-02 — Authenticated Open Proxy ✅

| Field                    | Value                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Vuln**                 | `GET /api/face-swap/download-fixed?url=<ANY>&mode=direct` same as above but requires auth |
| **File**                 | `backend/src/controllers/faceSwap.controller.ts:~100`                                     |
| **Impact**               | Authenticated user can reach internal services                                            |
| **Test file**            | `backend/src/controllers/__tests__/faceSwap.controller.test.ts`                           |
| **Test case**            | `it("rejects private IP URLs with 400")`                                                  |
| **Test result (before)** | ⬜                                                                                        |
| **Test result (after)**  | ⬜                                                                                        |

**Smoke test (local dev):**

```bash
# Should return 400 (blocked URL):
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/face-swap/download-fixed?url=http://10.0.0.1/&mode=direct" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
"
# Expected: 400

# Should work for legitimate S3/CloudFront URLs:
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/face-swap/download-fixed?url=https://some-bucket.s3.amazonaws.com/video.mp4&mode=direct" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
"
# Expected: 200 (or appropriate response)
```

---

### 1C. SSRF-VULN-03 — yt-dlp SSRF (url/info, url/download) ✅

| Field                    | Value                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **Vuln**                 | `POST /api/clip-video/url/info` passes `req.body.url` to `yt-dlp` with only syntax check |
| **File**                 | `backend/src/services/videoDownload.service.ts:79,161`                                   |
| **Impact**               | File read via `file://`, internal service access                                         |
| **Test file**            | `backend/src/services/__tests__/videoDownload.service.test.ts`                           |
| **Test case**            | `it("rejects file:// URLs")` / `it("rejects private IP URLs")`                           |
| **Test result (before)** | ⬜                                                                                       |
| **Test result (after)**  | ⬜                                                                                       |

**Smoke test (local dev):**

```bash
# Should return 400:
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/url/info" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///etc/passwd"}'
# Expected: 400

curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/url/info" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/"}'
# Expected: 400

# Should work for legitimate YouTube URLs:
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/url/info" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
# Expected: 200
```

---

### 1D. SSRF-VULN-04 — API PlatformBearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA

yt-dlp SSRF ✅

| Field                    | Value                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| **Vuln**                 | `POST /api/platform/v1/clip` accepts `video_url`/`music_url` passed to yt-dlp |
| **File**                 | `backend/src/controllers/api-platform/apiClip.controller.ts:258,515`          |
| **Impact**               | Same as 1C but via API key auth                                               |
| **Test file**            | `backend/src/controllers/__tests__/apiClip.controller.test.ts`                |
| **Test case**            | `it("rejects private IP video_url")`                                          |
| **Test result (before)** | ⬜                                                                            |
| **Test result (after)**  | ⬜                                                                            |

**Smoke test (local dev):**

```bash
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/platform/v1/clip" \
  -H "X-API-Key: cuttr_Avq9R0C3ub-SFimYW5qfho7BDe-RZ92GLpKl-AVgMUI" \
  -H "Content-Type: application/json" \
  -d '{"video_url": "http://169.254.170.2/v2/metadata"}'
# Expected: 400
```

---

### 1E. SSRF-VULN-05 — API Platform face-swap fetch ✅

| Field                    | Value                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| **Vuln**                 | `POST /api/platform/v1/face-swap` accepts `face_image_url` passed to `fetch()` |
| **File**                 | `backend/src/services/s3.service.ts:542` (via `downloadVideoFromUrl`)          |
| **Impact**               | Blind SSRF to internal services                                                |
| **Test file**            | `backend/src/services/__tests__/s3.service.test.ts`                            |
| **Test case**            | `it("rejects private IP URLs in downloadVideoFromUrl")`                        |
| **Test result (before)** | ⬜                                                                             |
| **Test result (after)**  | ⬜                                                                             |

**Smoke test (local dev):**

```bash
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/platform/v1/face-swap" \
  -H "X-API-Key: cuttr_Avq9R0C3ub-SFimYW5qfho7BDe-RZ92GLpKl-AVgMUI" \
  -H "Content-Type: application/json" \
  -d '{"face_image_url": "http://169.254.169.254/latest/meta-data/"}'
# Expected: 400
```

---

### 1F. SSRF-VULN-06 / INJ-VULN-01 — CSS Injection → Puppeteer SSRF ✅

| Field                    | Value                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Vuln**                 | `POST /api/clip-video/teams/:teamId/clips/:clipId/text-overlay` — `color` param injected raw into CSS |
| **File**                 | `backend/src/services/clips/textOverlay.service.ts:98-105,186-193`                                    |
| **Impact**               | Puppeteer makes outbound requests to attacker-controlled URLs                                         |
| **Test file**            | `backend/src/services/clips/__tests__/textOverlay.service.test.ts`                                    |
| **Test case**            | `it("rejects non-hex color values")`                                                                  |
| **Test result (before)** | ⬜                                                                                                    |
| **Test result (after)**  | ⬜                                                                                                    |

**Smoke test (local dev):**

```bash
# Should return 400 (invalid color):
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/teams/1/clips/1/text-overlay" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"text":"test","color":"red; } body { background: url(http://evil.com)","style":"basic"}'
# Expected: 400

# Should work with valid hex color:
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/teams/1/clips/1/text-overlay" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"text":"test","color":"#FF0000","style":"basic"}'
# Expected: 200
```

---

## Phase 2: CRITICAL — Authentication (5 issues)

### 2A. AUTH-VULN-04 — Hardcoded Admin Credentials ✅

| Field                    | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Vuln**                 | `admin@cuttr.com` / `@dmin123!` in `admin.config.json` committed to git               |
| **File**                 | `backend/src/config/admin.config.json`, `backend/src/services/admin.service.ts:44-48` |
| **Impact**               | Anyone with repo access can log into admin panel                                      |
| **Test file**            | `backend/src/services/__tests__/admin.service.test.ts`                                |
| **Test case**            | `it("validates credentials from env vars with bcrypt")`                               |
| **Test result (before)** | ⬜                                                                                    |
| **Test result (after)**  | ⬜                                                                                    |

**Smoke test (local dev):**

```bash
# Set env vars first:
# ADMIN_EMAIL=admin@cuttr.com
# ADMIN_PASSWORD_HASH=$2b$10$... (bcrypt hash)

# Old hardcoded creds should fail:
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cuttr.com","password":"@dmin123!"}'
# Expected: 401 (unless you set the hash to match)
```

---

### 2B. AUTH-VULN-07 — JWT Fallback Secret ✅

| Field                    | Value                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| **Vuln**                 | `ADMIN_JWT_SECRET` falls back to `"admin-secret-key-change-in-production"` |
| **File**                 | `backend/src/services/admin.service.ts:17-18`                              |
| **Impact**               | Attacker can forge admin JWTs if env var is unset                          |
| **Test file**            | `backend/src/services/__tests__/admin.service.test.ts`                     |
| **Test case**            | `it("throws if ADMIN_JWT_SECRET is not set")`                              |
| **Test result (before)** | ⬜                                                                         |
| **Test result (after)**  | ⬜                                                                         |

**Smoke test (local dev):**

```bash
# Unset ADMIN_JWT_SECRET and try to start the server — should fail at startup
# ADMIN_JWT_SECRET= node dist/server.js
# Expected: Process exits with error
```

---

### 2C. AUTH-VULN-05 — Math.random() 2FA ✅

| Field                    | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| **Vuln**                 | 2FA codes generated with non-CSPRNG `Math.random()`    |
| **File**                 | `backend/src/services/admin.service.ts:69-71`          |
| **Impact**               | Predictable 2FA codes                                  |
| **Test file**            | `backend/src/services/__tests__/admin.service.test.ts` |
| **Test case**            | `it("generates 6-digit codes using crypto.randomInt")` |
| **Test result (before)** | ⬜                                                     |
| **Test result (after)**  | ⬜                                                     |

**Smoke test (local dev):**

```bash
# Verify by code inspection: grep for Math.random in admin.service.ts
grep -n "Math.random" backend/src/services/admin.service.ts
# Expected: no results

grep -n "crypto.randomInt" backend/src/services/admin.service.ts
# Expected: line ~70
```

---

### 2D. AUTH-VULN-09 — Unauthenticated WebSocket ✅

| Field                    | Value                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Vuln**                 | Socket.IO accepts connections with no auth, `join-team` takes any teamId                   |
| **File**                 | `backend/src/services/socket.service.ts:41-47`                                             |
| **Impact**               | Eavesdrop on any team's real-time events                                                   |
| **Test file**            | `backend/src/services/__tests__/socket.service.test.ts`                                    |
| **Test case**            | `it("rejects connections without valid token")` / `it("rejects join-team for non-member")` |
| **Test result (before)** | ⬜                                                                                         |
| **Test result (after)**  | ⬜                                                                                         |

**Smoke test (local dev):**

```bash
# Using wscat or a quick Node script:
# npx wscat -c "ws://localhost:3001/socket.io/?EIO=4&transport=websocket"
# Expected: Connection rejected (no auth token)

# With token but wrong team:
# socket.io-client connect with auth.token, emit join-team(99999)
# Expected: Error response, not joined
```

---

### 2E. AUTH-VULN-08 — Admin JWT 7-Day Lifetime ✅

| Field                    | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| **Vuln**                 | Admin JWT valid for 7 days with no revocation          |
| **File**                 | `backend/src/services/admin.service.ts:53`             |
| **Impact**               | Stolen admin token usable for 7 days                   |
| **Test file**            | `backend/src/services/__tests__/admin.service.test.ts` |
| **Test case**            | `it("generates token with 4h expiry")`                 |
| **Test result (before)** | ⬜                                                     |
| **Test result (after)**  | ⬜                                                     |

**Smoke test (local dev):**

```bash
# After admin login, decode the JWT and check exp:
# jwt.io or: node -e "console.log(JSON.parse(Buffer.from('TOKEN'.split('.')[1],'base64')))"
# Expected: exp - iat = 14400 (4 hours), not 604800 (7 days)
```

---

## Phase 3: CRITICAL — XSS (3 issues)

### 3A. XSS-VULN-01 — Folder Name → innerHTML ✅

| Field                    | Value                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **Vuln**                 | `folder.name` injected raw into `innerHTML` in drag preview                                         |
| **Files**                | `frontend/components/clips/SubfolderCard.tsx:50`, `frontend/components/clips/FolderTreeItem.tsx:66` |
| **Impact**               | Stored XSS → session token theft                                                                    |
| **Fix**                  | Replace `innerHTML` with `textContent` for user data                                                |
| **Test result (before)** | ⬜                                                                                                  |
| **Test result (after)**  | ⬜                                                                                                  |

**Smoke test (local dev):**

```bash
# 1. Create folder with XSS payload:
curl -s -X POST "http://localhost:3001/api/folders/teams/1/folders" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA" \
  -H "Content-Type: application/json" \
  -d '{"name":"<img src=x onerror=alert(1)>","color":"#FF0000"}'

# 2. Open http://localhost:3000/dashboard/clips
# 3. Drag the folder — should show escaped text, NOT trigger alert()
# Expected: Folder card shows literal "<img src=x onerror=alert(1)>" as text
```

---

### 3B. XSS-VULN-02 — Clip Title → innerHTML ✅

| Field                    | Value                                                      |
| ------------------------ | ---------------------------------------------------------- |
| **Vuln**                 | `clip.title` injected raw into `innerHTML` in drag preview |
| **File**                 | `frontend/components/clips/ClipCard.tsx:87-93`             |
| **Impact**               | Stored XSS → session token theft                           |
| **Fix**                  | Replace `innerHTML` with `textContent` for user data       |
| **Test result (before)** | ⬜                                                         |
| **Test result (after)**  | ⬜                                                         |

**Smoke test (local dev):**

```bash
# 1. Update clip title with XSS payload:
curl -s -X PATCH "http://localhost:3001/api/clip-video/teams/1/clips/CLIP_ID" \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjJhN2VmOGFkLTMyZWMtNGY5MS05OWVlLTFkYjhhYjE0NzZlZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NmbXJnYm55c3Nrem16ZnJza2twLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NTAwNjQ4LCJpYXQiOjE3NzU0OTcwNDgsImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFnZWxpYS5uYW1hbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4MDdkNjkxMi1kNDAzLTRhOWQtYWI4YS0wZWQ5MzQ5YTg5NjIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTQ5NzA0OH1dLCJzZXNzaW9uX2lkIjoiNDA4ZjVhOTEtMmNhMi00MDJmLWEwZjQtZTNhZDllMDBmMGRkIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.qIbQTDT5YSzUxAPaSUDpHRw0uhbRD28pokUpYuQTkITVgn93O5kvjO-lhnw423fPYamsP04Y2bwzliV6hrjfxA
" \
  -H "Content-Type: application/json" \
  -d '{"title":"<img src=x onerror=alert(1)>"}'

# 2. Open dashboard, drag the clip
# Expected: Shows escaped text, no alert()
```

---

### 3C. XSS-VULN-03 — Announcement dangerouslySetInnerHTML ✅

| Field                    | Value                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| **Vuln**                 | Announcement content rendered via `dangerouslySetInnerHTML` with no client-side sanitization  |
| **Files**                | `frontend/components/announcements/AnnouncementPopupModal.tsx:121`, `AnnouncementItem.tsx:93` |
| **Impact**               | Platform-wide XSS via admin-created announcements                                             |
| **Fix**                  | Add client-side `DOMPurify.sanitize()`                                                        |
| **Test result (before)** | ⬜                                                                                            |
| **Test result (after)**  | ⬜                                                                                            |

**Smoke test (local dev):**

```bash
# Requires admin access. Create announcement with mXSS payload and verify
# it renders as safe HTML (no script execution) in the frontend
```

---

## Phase 4: CRITICAL — Authorization / IDOR (26 issues)

### 4A. AUTHZ-VULN-01–10 — Missing Team Membership Check ✅

Affected endpoints (all use `requirePlanAccess` without `verifyTeamAccessOrFail`):

| Endpoint                                              | Controller                    | Status |
| ----------------------------------------------------- | ----------------------------- | ------ |
| `GET /api/virality/:teamId/dashboard`                 | virality.controller.ts        | ⬜     |
| `GET /api/virality/:teamId/accounts`                  | virality.controller.ts        | ⬜     |
| `POST /api/virality/:teamId/accounts`                 | virality.controller.ts        | ⬜     |
| `DELETE /api/virality/:teamId/accounts/:accountId`    | virality.controller.ts        | ⬜     |
| `POST /api/virality/:teamId/accounts/:accountId/sync` | virality.controller.ts        | ⬜     |
| `GET /api/virality/:teamId/competitors`               | virality.controller.ts        | ⬜     |
| `PUT /api/virality/:teamId/settings`                  | virality.controller.ts        | ⬜     |
| `GET /api/user-performance/:teamId/dashboard`         | userPerformance.controller.ts | ⬜     |
| `GET /api/ugc/scripts/:teamId`                        | ugcScript.controller.ts       | ⬜     |
| `GET /api/c/team/:teamId/jobs`                        | comfy.controller.ts           | ⬜     |
| `GET /api/c/saved-faces/:teamId`                      | comfy.controller.ts           | ⬜     |
| `GET /api/folders/teams/:teamId/folders`              | folder.controller.ts          | ⬜     |
| `GET /api/folders/teams/:teamId/folders/tree`         | folder.controller.ts          | ⬜     |
| `GET /api/stripe/subscription/:teamId`                | stripe.controller.ts          | ⬜     |

**Smoke test (local dev):**

```bash
# User A's token accessing User B's team (teamId=99):
curl -s -w "\n%{http_code}" "http://localhost:3001/api/virality/99/dashboard" \
  -H "Authorization: Bearer USER_A_TOKEN"
# Expected: 403 (Access denied to this team)

curl -s -w "\n%{http_code}" "http://localhost:3001/api/stripe/subscription/99" \
  -H "Authorization: Bearer USER_A_TOKEN"
# Expected: 403
```

---

### 4B. AUTHZ-VULN-11–16,20 — Missing Ownership Check on Resource IDs ✅

| Endpoint                             | Controller               | Status |
| ------------------------------------ | ------------------------ | ------ |
| `GET /api/ugc/script/:scriptId/full` | ugcScript.controller.ts  | ⬜     |
| `DELETE /api/ugc/script/:scriptId`   | ugcScript.controller.ts  | ⬜     |
| `GET /api/tags/clips/:clipId/tags`   | tag.controller.ts        | ⬜     |
| `PUT /api/tags/clips/:clipId/tags`   | tag.controller.ts        | ⬜     |
| `GET /api/c/jobs/:jobId`             | comfy.controller.ts      | ⬜     |
| `DELETE /api/c/jobs/:jobId`          | comfy.controller.ts      | ⬜     |
| `DELETE /api/c/saved-faces/:id`      | comfy.controller.ts      | ⬜     |
| `GET /api/actors/:id`                | actor.controller.ts      | ⬜     |
| `DELETE /api/actors/:id`             | actor.controller.ts      | ⬜     |
| `DELETE /api/voice-clones/:id`       | voiceClone.controller.ts | ⬜     |
| `GET /api/ad-clone/:projectId`       | adClone.controller.ts    | ⬜     |
| `GET /api/ugc-video/status/:jobId`   | ugcVideo.controller.ts   | ⬜     |

**Smoke test (local dev):**

```bash
# User A trying to access User B's script:
curl -s -w "\n%{http_code}" "http://localhost:3001/api/ugc/script/SOMEONE_ELSES_UUID/full" \
  -H "Authorization: Bearer USER_A_TOKEN"
# Expected: 403

# User A trying to delete User B's actor:
curl -s -w "\n%{http_code}" -X DELETE "http://localhost:3001/api/actors/999" \
  -H "Authorization: Bearer USER_A_TOKEN"
# Expected: 403
```

---

### 4C. AUTHZ-VULN-21 — Presigned Upload Unverified teamId ✅

| Field                    | Value                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Vuln**                 | `POST /api/clip-video/presigned-upload` accepts teamId from body without membership check |
| **File**                 | `backend/src/controllers/upload.controller.ts:172-210`                                    |
| **Test case**            | `it("rejects presigned upload for non-member team")`                                      |
| **Test result (before)** | ⬜                                                                                        |
| **Test result (after)**  | ⬜                                                                                        |

**Smoke test (local dev):**

```bash
curl -s -w "\n%{http_code}" -X POST "http://localhost:3001/api/clip-video/presigned-upload" \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId":"99","fileName":"test.mp4","fileType":"video/mp4"}'
# Expected: 403
```

---

## Phase 5: HIGH — Rate Limiting & Auth Hardening (4 issues)

### 5A. AUTH-VULN-02 — No Rate Limit on /auth/supabase ✅

| Field    | Value                                   |
| -------- | --------------------------------------- |
| **File** | `backend/src/routes/auth.routes.ts:143` |
| **Fix**  | Add `authLimiter` middleware            |

**Smoke test:** Check for `ratelimit-limit` header in response:

```bash
curl -sI -X POST "http://localhost:3001/api/auth/supabase" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"x","refreshToken":"x"}' | grep -i ratelimit
# Expected: ratelimit-limit: 5
```

### 5B. AUTH-VULN-03 — No Rate Limit on /auth/refresh ✅

| Field    | Value                                   |
| -------- | --------------------------------------- |
| **File** | `backend/src/routes/auth.routes.ts:242` |
| **Fix**  | Add `authLimiter` middleware            |

**Smoke test:** Same as above but for `/api/auth/refresh`

### 5C. AUTH-VULN-06 — No Rate Limit on /admin/resend-2fa ✅

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| **File** | `backend/src/routes/admin.routes.ts:~148` |
| **Fix**  | Add `adminAuthLimiter` middleware         |

**Smoke test:** Same header check for `/api/admin/resend-2fa`

### 5D. AUTH-VULN-10 — User Enumeration via Signup ✅

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| **File** | `backend/src/services/auth.service.ts:71-73`           |
| **Fix**  | Generic error message for existing/non-existing emails |

**Smoke test:**

```bash
# Existing email and non-existing should return same message:
curl -s -X POST "http://localhost:3001/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@test.com","password":"test123","firstName":"A","lastName":"B"}'
# Expected: Generic message, NOT "An account with this email already exists"
```

---

## Phase 6: MEDIUM — Security Headers & Hardening (7 issues)

### 6A. AUTH-VULN-11 — No HSTS / Helmet ✅

| Field    | Value                   |
| -------- | ----------------------- |
| **File** | `backend/src/app.ts`    |
| **Fix**  | Add `app.use(helmet())` |

**Smoke test:**

```bash
curl -sI "http://localhost:3001/health" | grep -iE "strict-transport|x-content-type|x-frame"
# Expected: strict-transport-security, x-content-type-options, x-frame-options headers present
```

### 6B. AUTH-VULN-12 — No Cache-Control on Auth Responses ✅ (via Helmet)

**Smoke test:**

```bash
curl -sI -X POST "http://localhost:3001/api/auth/signin" \
  -H "Content-Type: application/json" -d '{}' | grep -i cache-control
# Expected: cache-control: no-store
```

### 6C. AUTH-VULN-13 — CORS Wildcard \*.amplifyapp.com ✅

| Field    | Value                              |
| -------- | ---------------------------------- |
| **File** | `backend/src/app.ts:61`            |
| **Fix**  | Remove regex, use strict allowlist |

**Smoke test:**

```bash
curl -sI "http://localhost:3001/health" -H "Origin: https://evil.amplifyapp.com" | grep -i access-control
# Expected: No access-control-allow-origin header (blocked)
```

### 6D. Reduce Body Size Limit (10GB → 10MB) ✅

### 6E. Protect Swagger in Production ✅

### 6F. Reduce /health/worker Info Leak ✅

### 6G. Remove /debug-sentry ✅

### 6H. Timing-Safe Internal API Key Comparison ✅

**Smoke tests for 6D-6H:**

```bash
# 6D: Large body should be rejected
# (test by sending >10MB JSON to a non-upload endpoint)

# 6E: Swagger blocked in production
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api-docs"
# Expected: 404 or 401 in production mode

# 6F: No ARNs in health/worker
curl -s "http://localhost:3001/health/worker" | grep -i arn
# Expected: no matches

# 6G: debug-sentry removed
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/debug-sentry"
# Expected: 404
```

---

## Phase 7: MEDIUM — Latent Risks (2 issues)

### 7A. FFmpeg Shell String → Array Args ✅

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| **File** | `backend/src/utils/videoUniquify.ts:10,138`                       |
| **Fix**  | Convert `execAsync` template strings to `spawn()` with array args |

### 7B. Sentry PII Reduction ✅

| Field    | Value                       |
| -------- | --------------------------- |
| **File** | `backend/src/instrument.ts` |
| **Fix**  | `sendDefaultPii: false`     |

**Smoke test:**

```bash
grep "sendDefaultPii" backend/src/instrument.ts
# Expected: sendDefaultPii: false
```

---

## Progress Summary

| Phase     | Category   | Issues | Fixed  | Remaining |
| --------- | ---------- | ------ | ------ | --------- |
| 1         | SSRF       | 6      | 6      | 0         |
| 2         | Auth       | 5      | 5      | 0         |
| 3         | XSS        | 3      | 3      | 0         |
| 4         | AuthZ      | 26     | 26     | 0         |
| 5         | Rate Limit | 4      | 4      | 0         |
| 6         | Hardening  | 8      | 8      | 0         |
| 7         | Latent     | 2      | 2      | 0         |
| **TOTAL** |            | **54** | **54** | **0**     |

---

## Deployment Steps (Required for Completed Fixes)

### Phase 1 (SSRF) — No deployment changes needed

All SSRF fixes are code-only. No new env vars or infra changes required.

### Phase 2 (Auth) — NEW ENV VARS REQUIRED

Before deploying Phase 2 changes, you must set these new environment variables in **all environments** (staging + production) via AWS Secrets Manager / dotenv-vault:

#### 1. Generate admin password hash

Run this locally to generate a hash for your chosen admin password:

```bash
node -e "
const crypto = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(crypto.scrypt);

async function hash(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  console.log(salt + ':' + key.toString('hex'));
}

hash('YOUR_NEW_STRONG_PASSWORD_HERE');
"
```

#### 2. Set GitHub Actions secrets

These are needed for Terraform to create the AWS Secrets Manager entries. Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| GitHub Secret         | Value                                 | Notes                                                             |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `ADMIN_EMAIL`         | `admin@cuttr.com`                     | Or your preferred admin email                                     |
| `ADMIN_PASSWORD_HASH` | Output from step 1 (salt:hash format) | **Choose a strong password — old one `@dmin123!` is compromised** |
| `ADMIN_JWT_SECRET`    | Already set (verify it exists)        | Server will crash on startup if missing — this is intentional     |

Terraform (`infra/secrets.tf`) creates the AWS Secrets Manager entries automatically from these. The ECS task definition (`infra/ecs.tf`) injects them as env vars into the backend container. CI/CD (`ci.yml`) passes them as Terraform variables.

#### 3. Delete the old config file from git history (optional but recommended)

The old `admin.config.json` with `@dmin123!` is still in git history. To fully remove it:

```bash
# After merging the security fix branch:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/src/config/admin.config.json" \
  --prune-empty -- --all
```

Or use BFG Repo-Cleaner (faster for large repos).

#### 4. Frontend WebSocket update

The frontend Socket.IO client must now send the auth token on connection. Update wherever the socket connects:

```typescript
// Before (no auth):
const socket = io("https://api.cuttr.com");

// After (with auth):
const socket = io("https://api.cuttr.com", {
  auth: {
    token: localStorage.getItem("access_token"),
  },
});
```

Search for `io(` or `socket.io-client` in the frontend to find the connection point.

#### 5. Rotate the old admin password immediately

Since `@dmin123!` was in the git repo and confirmed valid on staging, you should:

1. Deploy the new code with env vars set
2. Verify admin login works with the new password
3. Consider rotating the `ADMIN_JWT_SECRET` to invalidate all existing admin sessions
4. Review access logs for any unauthorized admin activity

#### 6. Verify deployment

After deploying to staging:

```bash
# Admin login should work with new password:
curl -s -X POST "https://api-staging.cuttr.com/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cuttr.com","password":"YOUR_NEW_PASSWORD"}'
# Expected: 200 with requires2FA: true

# Old password should fail:
curl -s -w "\n%{http_code}" -X POST "https://api-staging.cuttr.com/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cuttr.com","password":"@dmin123!"}'
# Expected: 401

# WebSocket without auth should fail:
# Use wscat: npx wscat -c "wss://api-staging.cuttr.com/socket.io/?EIO=4&transport=websocket"
# Expected: Connection rejected

# SSRF should be blocked:
curl -s -w "\n%{http_code}" "https://api-staging.cuttr.com/api/face-swap/download-fixed-public?url=http://169.254.170.2/v2/metadata&mode=direct"
# Expected: 401 (now requires auth)
```
