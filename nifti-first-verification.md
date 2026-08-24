# NIfTI-first verification notes

- The protected `/studies/120001` route redirected to the existing clinical login screen when visited without an authenticated session. This confirms the NIfTI source and mask URLs remain behind the established clinician authentication boundary.
- No inference request was initiated during this verification because the external inference service is intentionally inactive.
- The public `/demo` page visibly accepts only the four original compressed NIfTI modalities and explicitly states that selected files remain in the browser while the inference service is inactive; it does not display or solicit a PNG result.
- After the persistent guest visitor cookie was present, revisiting `/demo` continued to show the normal intake and scan control rather than the consumed-guest registration screen. The scan was not run during this verification.
- The post-correction browser revisit again resolved to the normal NIfTI intake with the scan action available. Router tests separately verify that this same token becomes permanently blocked only when the completion endpoint runs after a successful inference result.
- An unauthenticated visit to `/admin` showed the authorization gate and then redirected to `/login`; no administration configuration or system data was rendered.
- After secure administrator sign-in, `/admin` loaded the protected clinical control plane with server-side MRI API status, clinician/study/inference counts, and recent inference activity. The initial API state correctly showed `Not configured` and did not disclose a browser-configured upstream endpoint.
- The authenticated `/admin/settings` route displayed the server-side MRI API URL form and explanatory security guidance. No placeholder API URL was saved or tested because the inference service remains inactive.
- Final administrator verification: `/admin` showed `Awaiting configuration`, `Configured API URL: Not configured`, no successful health check, and no model reported. The endpoint remains NULL in server-side storage and no fake URL was created.
