# Synthetic MRI Slice Navigator — Verification Record

The supplied archive was inspected as **synthetic demo data, not real MRI**. Its metadata declares a 256 × 256 × 60 test volume with source names `slice_001.png` through `slice_060.png`.

Desktop validation confirmed that the protected study viewer renders one main image at a time, starts on slice 1, reaches slice 60 via `End`, returns to slice 1 via `Home`, moves one position with the next button and right-arrow key, and accepts intermediate range values such as internal index 24 / visible slice 25. A T1CE switch retained the slice position. The disabled segmentation-opacity control remained independent at 62 while slice navigation changed.

All 60 managed image references were checked after following managed-storage redirects and returned final HTTP 200 responses. The slice 053 URL was specifically repaired and then loaded in the browser as visible slice 53 of 60. The unit suite asserts length, uniqueness, numeric order, expected slice 053 mapping, range bounds, and near-slice preload selection.

Responsive validation used the authenticated browser session at a 375 × 812 mobile viewport. The slice controls resolved to a compact two-column layout (`167.5px 167.5px`) with the full-width slice range placed above the previous and next controls, as intended by the mobile CSS. The browser was restored to its desktop viewport afterward, where the protected viewer continued to render slice 1 of 60 normally.

The supplied compressed reference volumes were inspected as valid little-endian NIfTI-1 float32 data. Each has dimensions **240 × 240 × 155** with 1 mm isotropic spacing. Web-safe axial preview sprites were derived outside the project from the four supplied modalities, while the raw NIfTI files remained outside deployed static assets. Visual inspection of the synchronized 78th axial slice confirmed visible MRI anatomy across T1, T1CE, T2, and FLAIR. The landing-page preview grid renders these four modalities within the existing black editorial composition.

The public demo intake independently detected the supplied four compressed files as T1, T1CE, T2, and FLAIR, then completed its server-side demo-validation path after the safe decompression ceiling was raised to 64 MiB. The demo record stores only 64-character token and network hashes, was marked used atomically, and recorded a four-modality completion audit event. No raw demo upload was stored. The protected viewer now renders the derived volume at slice 78 of 155, and T1CE switching retained that same synchronized slice position.

The anonymous demo allowance now also uses a unique, one-way visitor binding derived on the server from request context. New demo records are therefore bound beyond the HTTP-only cookie, so deleting only that cookie does not reset the allowance. The public demo was browser-tested with an unsupported `.nii` selection: it produced the explicit compressed-NIfTI rejection message and kept **Run AI analysis** disabled. Mobile verification showed the demo intake’s full-width controls at 375 × 812 and the authenticated real-volume viewer’s two-column slice-control grid at the same breakpoint; the viewer was restored to desktop afterward.

**Verification confirmation:** the browser rejection check returned `{"ignored":true,"disabled":true}`. Separate visual checks recorded the responsive public `/demo` intake at 375 × 812 and the authenticated `/studies/30001` slice-control layout at 375 × 812, followed by a successful desktop restoration.

Release record: the public demo’s unsupported-file path was confirmed to retain a disabled submission action; its compact intake and the authenticated derived-volume viewer were separately inspected at the 375 × 812 mobile breakpoint.
