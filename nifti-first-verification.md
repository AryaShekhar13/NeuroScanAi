# NIfTI-first verification notes

- The protected `/studies/120001` route redirected to the existing clinical login screen when visited without an authenticated session. This confirms the NIfTI source and mask URLs remain behind the established clinician authentication boundary.
- No inference request was initiated during this verification because the external inference service is intentionally inactive.
- The public `/demo` page visibly accepts only the four original compressed NIfTI modalities and explicitly states that selected files remain in the browser while the inference service is inactive; it does not display or solicit a PNG result.
- After the persistent guest visitor cookie was present, revisiting `/demo` continued to show the normal intake and scan control rather than the consumed-guest registration screen. The scan was not run during this verification.
- The post-correction browser revisit again resolved to the normal NIfTI intake with the scan action available. Router tests separately verify that this same token becomes permanently blocked only when the completion endpoint runs after a successful inference result.
