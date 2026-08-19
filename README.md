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
| `MAX_SINGLE_FILE_SIZE` | Recommended | Maximum compressed upload size in bytes for one NIfTI file. Defaults to `8388608` (8 MiB). |
| `MAX_STUDY_SIZE` | Recommended | Maximum total compressed upload size in bytes for one study. Defaults to `33554432` (32 MiB). |
| `MAX_FOLDER_FILES` | Recommended | Maximum number of files examined in a selected folder. Defaults to `200`. |

The platform supplies `DATABASE_URL`, `JWT_SECRET`, and managed object-storage credentials. They must remain platform-managed and must not be copied into a local configuration file.

## Security and upload controls

Password hashes use bcrypt with a cost factor of 12. Existing legacy scrypt hashes can be upgraded transparently at successful sign-in. Clinician sessions include a server-checked session version so logout and password-reset events invalidate previously issued session cookies. Login, password-reset request, and password-reset completion routes are rate-limited using hashed request identifiers.

MRI study intake performs server-side validation before storage. Each file must have an approved NIfTI filename and MIME type, pass NIfTI-1 header inspection, stay within compressed and decompressed size limits, and resolve to a recognised modality. The workflow requires exactly one selected file for each **T1**, **T1CE**, **T2**, and **FLAIR** modality; duplicate byte content is rejected by SHA-256 checksum. Stored metadata includes modality, checksum, source path when supplied by folder selection, uncompressed byte count, and parsed NIfTI details. The database retains object references and metadata only; file bytes remain in managed private storage.

## Verification

Run the following commands before a release:

```bash
pnpm test
pnpm check
```

The hardened suite covers credential hashing and legacy migration, reset-token hashing, SMTP configuration, NIfTI header and gzip handling, MIME and modality checks, and folder-level duplicate/completeness inspection. Release validation should also create a clearly labelled synthetic study with four harmless NIfTI fixtures and confirm that its study detail lists all four modalities.

## Clinical scope

The current analysis action is a **demonstration workflow**, not a diagnostic inference system. Do not use the application for clinical decision-making until it has been integrated with an appropriately validated PACS/DICOM pipeline, inference service, governance process, and role-based access controls.
