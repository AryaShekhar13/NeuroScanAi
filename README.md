# NeuroScan AI

NeuroScan AI is a protected clinical MRI study workspace built with React, Express, tRPC, Drizzle, and managed MySQL/TiDB plus managed object storage. The application accepts **only NIfTI-1 MRI files** (`.nii` and `.nii.gz`) for study intake. It is designed for authenticated clinician workflows and stores study bytes in managed object storage rather than in database rows.

## Required configuration

Set production configuration through the project secret manager; do **not** commit an `.env` file or include credential values in source control.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Yes | Public application origin used in password-reset links. Use the final HTTPS URL, without a trailing slash. |
| `SMTP_HOST` | Yes for reset delivery | SMTP relay hostname for transactional password-reset messages. |
| `SMTP_PORT` | Yes for reset delivery | SMTP relay port, typically `587` for STARTTLS or `465` for implicit TLS. |
| `SMTP_USERNAME` | Yes for reset delivery | SMTP service account username. |
| `SMTP_PASSWORD` | Yes for reset delivery | SMTP service account password or provider-issued app password. |
| `SMTP_FROM` | Yes for reset delivery | Verified sender address, for example `NeuroScan AI <security@example.org>`. |
| `ADMIN_EMAIL` | Yes for initial admin setup | Initial clinical administrator email. The server initializes this account only if absent. |
| `ADMIN_INITIAL_PASSWORD` | Yes for initial admin setup | One-time administrator password supplied through secure deployment secrets. Only a bcrypt hash is stored; existing passwords are never overwritten. |
| `MAX_SINGLE_FILE_SIZE` | Recommended | Maximum compressed upload size in bytes for one NIfTI file. Defaults to `8388608` (8 MiB). |
| `MAX_MRI_UPLOAD_MB` | Optional override | Whole-megabyte maximum compressed upload size for one MRI file. When set, this takes precedence over `MAX_SINGLE_FILE_SIZE`; choose a value consistent with the hosted worker’s available memory. |
| `MAX_STUDY_SIZE` | Recommended | Maximum total compressed upload size in bytes for one study. Defaults to `33554432` (32 MiB). |
| `MAX_FOLDER_FILES` | Recommended | Maximum number of files examined in a selected folder. Defaults to `200`. |

The platform supplies `DATABASE_URL`, `JWT_SECRET`, and managed object-storage credentials. They must remain platform-managed and must not be copied into a local configuration file.

MRI inference endpoints are managed by authenticated clinical administrators at `/admin/settings`. The URL is stored server-side, is never returned to ordinary users or guests, and can be tested and changed without a frontend code change or redeployment. Do not put an upstream MRI API URL in a `VITE_` variable.

## Durable analysis jobs and GPU boundary

Each clinician analysis is assigned a persistent server-generated job identifier. Status progresses through queued, validation, volume preparation, AI segmentation, report-artifact check, saving, completion, or a retryable/failed state. The always-on worker owns processing rather than the browser, so a refresh returns the existing job state instead of creating another analysis. A stored authoritative segmentation checkpoint is finalized before any retry can queue another inference attempt.

Original MRI inputs and completed `.nii.gz` segmentation masks remain in managed persistent object storage. The worker does not retain MRI bytes on local disk after a cycle. A future GPU API must provide its own authenticated cleanup contract for temporary Kaggle files; no unverified cleanup URL is called by this application. A storage or database failure is recorded as retryable, never reported as a completed analysis.

## Security and upload controls

Password hashes use bcrypt with a cost factor of 12. Existing legacy scrypt hashes can be upgraded transparently at successful sign-in. Clinician sessions include a server-checked session version so logout and password-reset events invalidate previously issued session cookies. Login, password-reset request, and password-reset completion routes are rate-limited using hashed request identifiers.

MRI study intake performs server-side validation before storage. Each file must have an approved NIfTI filename and MIME type, pass NIfTI-1 header inspection, stay within compressed and decompressed size limits, and resolve to a recognised modality. The workflow requires exactly one selected file for each **T1**, **T1CE**, **T2**, and **FLAIR** modality; duplicate byte content is rejected by SHA-256 checksum. Stored metadata includes modality, checksum, source path when supplied by folder selection, uncompressed byte count, and parsed NIfTI details. The database retains object references and metadata only; file bytes remain in managed private storage.

## Verification

Run the following commands before a release:

```bash
pnpm test
pnpm check
```

The hardened suite covers credential hashing and legacy migration, reset-token hashing, SMTP configuration, NIfTI header and gzip handling, configurable upload limits, MIME and modality checks, folder-level duplicate/completeness inspection, administrator authorization, and durable job retry semantics. Once a real HTTPS API is configured, release validation must run a complete non-production `.nii.gz` study through persistent job creation, refresh recovery, returned-mask alignment, storage, and viewer review. Do not substitute a fake result or confidence score.

## Clinical scope

The current analysis action is a **demonstration workflow**, not a diagnostic inference system. Do not use the application for clinical decision-making until it has been integrated with an appropriately validated PACS/DICOM pipeline, inference service, governance process, and role-based access controls.
