# NIfTI-first verification notes

- The protected `/studies/120001` route redirected to the existing clinical login screen when visited without an authenticated session. This confirms the NIfTI source and mask URLs remain behind the established clinician authentication boundary.
- No inference request was initiated during this verification because the external inference service is intentionally inactive.
- The public `/demo` page visibly accepts only the four original compressed NIfTI modalities and explicitly states that selected files remain in the browser while the inference service is inactive; it does not display or solicit a PNG result.
