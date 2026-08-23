import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileWarning, FolderUp, LoaderCircle, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getInferenceVisualization, getNiftiAxialSliceCount, submitInference, waitForInferenceStatus, type InferenceModality, type InferenceStatus } from "@/lib/inferenceApi";

const modalities = [
  { value: "t1", label: "T1" }, { value: "t1ce", label: "T1CE" },
  { value: "t2", label: "T2" }, { value: "flair", label: "FLAIR" },
] as const;
type Modality = (typeof modalities)[number]["value"];
type Candidate = { file: File; modality: Modality; relativePath?: string };
type InferencePhase = "idle" | "Uploading MRI..." | "AI segmentation queued..." | "AI segmentation running..." | "Generating visualization..." | "Segmentation completed";
const maxClientFileBytes = 8 * 1024 * 1024;

const tokens = (name: string) => name.toLowerCase().replace(/\.nii\.gz$/, "").split(/[^a-z0-9]+/).filter(Boolean);
function modalityFor(name: string): Modality | null {
  const value = tokens(name); const has = (item: string) => value.includes(item);
  if (has("flair")) return "flair";
  if (has("t1ce") || has("t1c") || has("t1gd") || (has("t1") && (has("gd") || has("ce")))) return "t1ce";
  if (has("t1") || has("t1w")) return "t1";
  if (has("t2") || has("t2w")) return "t2";
  return null;
}
function phaseFor(status: InferenceStatus): InferencePhase {
  if (status.status === "queued") return "AI segmentation queued...";
  if (status.status === "running") return "AI segmentation running...";
  return "Generating visualization...";
}
function safeMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror/i.test(error.message))) return "The AI inference service could not be reached. Check your connection and try again.";
  return error instanceof Error ? error.message : "The AI inference service could not complete this request. Please try again.";
}
function readAsBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The selected MRI file could not be read.")); reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || ""); reader.readAsDataURL(file); }); }

export default function DemoPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const visualizationUrlRef = useRef<string | null>(null);
  const lastVisualizationSlice = useRef<number | null>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const visualizationAbortRef = useRef<AbortController | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [selected, setSelected] = useState<Partial<Record<Modality, number>>>({});
  const [phase, setPhase] = useState<InferencePhase>("idle");
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [visualizationUrl, setVisualizationUrl] = useState<string | null>(null);
  const [sliceCount, setSliceCount] = useState<number | null>(null);
  const [slice, setSlice] = useState(0);
  const [completed, setCompleted] = useState<{ notice: string; detected: Array<{ modality: Modality; fileName: string }> } | null>(null);
  const status = trpc.demo.status.useQuery();
  const utils = trpc.useUtils();
  const validateDemo = trpc.demo.validate.useMutation();
  const completeReal = trpc.demo.completeReal.useMutation();

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    folderInput.current?.setAttribute("directory", "");
    return () => { operationAbortRef.current?.abort(); visualizationAbortRef.current?.abort(); if (visualizationUrlRef.current) URL.revokeObjectURL(visualizationUrlRef.current); };
  }, []);

  const grouped = useMemo(() => modalities.reduce((result, modality) => ({ ...result, [modality.value]: candidates.filter((candidate) => candidate.modality === modality.value) }), {} as Record<Modality, Candidate[]>), [candidates]);
  const missing = modalities.filter(({ value }) => !grouped[value].length).map(({ label }) => label);
  const complete = !missing.length && modalities.every(({ value }) => selected[value] !== undefined);
  const selectedFiles = useMemo(() => {
    if (!complete) return null;
    const files = {} as Record<InferenceModality, File>;
    modalities.forEach(({ value }) => { files[value] = grouped[value][selected[value] ?? 0]!.file; });
    return files;
  }, [complete, grouped, selected]);
  const busy = phase !== "idle" && phase !== "Segmentation completed";

  const replaceVisualization = useCallback(async (id: string, requestedSlice: number) => {
    visualizationAbortRef.current?.abort();
    const controller = new AbortController(); visualizationAbortRef.current = controller;
    const nextUrl = await getInferenceVisualization(id, requestedSlice, controller.signal);
    if (controller.signal.aborted) { URL.revokeObjectURL(nextUrl); return; }
    if (visualizationUrlRef.current) URL.revokeObjectURL(visualizationUrlRef.current);
    visualizationUrlRef.current = nextUrl;
    lastVisualizationSlice.current = requestedSlice;
    setVisualizationUrl(nextUrl);
  }, []);

  useEffect(() => {
    if (!completed || !jobId || lastVisualizationSlice.current === slice) return;
    const timer = window.setTimeout(() => {
      setInferenceError(null); setPhase("Generating visualization...");
      void replaceVisualization(jobId, slice).then(() => setPhase("Segmentation completed")).catch((error) => { if (error instanceof DOMException && error.name === "AbortError") return; setInferenceError(safeMessage(error)); setPhase("Segmentation completed"); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [completed, jobId, replaceVisualization, slice]);

  const collect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    const accepted: Candidate[] = []; const skipped: string[] = [];
    Array.from(files).forEach((file) => {
      const modality = file.name.toLowerCase().endsWith(".nii.gz") && file.size <= maxClientFileBytes ? modalityFor(file.name) : null;
      if (!modality) skipped.push(file.name); else accepted.push({ file, modality, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined });
    });
    setCandidates(accepted); setIgnored(skipped);
    setSelected(Object.fromEntries(modalities.filter(({ value }) => accepted.some((candidate) => candidate.modality === value)).map(({ value }) => [value, 0])) as Partial<Record<Modality, number>>);
    setInferenceError(null); setCompleted(null); setVisualizationUrl(null); setJobId(null); setSliceCount(null); setSlice(0); lastVisualizationSlice.current = null; setPhase("idle");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFiles || status.data?.used || busy) return;
    operationAbortRef.current?.abort(); const controller = new AbortController(); operationAbortRef.current = controller;
    setInferenceError(null); setPhase("Uploading MRI...");
    try {
      const validationFiles = await Promise.all(modalities.map(async ({ value }) => ({ modality: value, fileName: selectedFiles[value].name, mimeType: selectedFiles[value].type || "application/gzip", base64: await readAsBase64(selectedFiles[value]) })));
      const validation = await validateDemo.mutateAsync({ files: validationFiles });
      const t1 = validation.detected.find((file) => file.modality === "t1");
      const axialSlices = t1?.metadata.dimensions[2] ?? await getNiftiAxialSliceCount(selectedFiles.t1);
      if (!Number.isInteger(axialSlices) || axialSlices < 1) throw new Error("The selected MRI file does not include valid axial slice metadata.");
      const initialSlice = Math.floor((axialSlices - 1) / 2);
      setSliceCount(axialSlices); setSlice(initialSlice);
      const job = await submitInference(selectedFiles, controller.signal);
      setJobId(job.job_id); setPhase(phaseFor(job as InferenceStatus));
      const finalStatus = await waitForInferenceStatus(job.job_id, (next) => setPhase(phaseFor(next)), controller.signal);
      if (finalStatus.status !== "completed") throw new Error("AI segmentation could not be completed for this MRI study. Please try again.");
      setPhase("Generating visualization...");
      await replaceVisualization(job.job_id, initialSlice);
      const completion = await completeReal.mutateAsync({ jobId: job.job_id, files: modalities.map(({ value }) => ({ modality: value, fileName: selectedFiles[value].name })) });
      setCompleted(completion); setPhase("Segmentation completed"); void utils.demo.status.invalidate();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setInferenceError(safeMessage(error)); setPhase("idle");
    }
  };

  if (status.isLoading) return <main className="demo-page"><p>Preparing secure demo access…</p></main>;
  if (status.data?.used && !completed) return <main className="demo-page"><a href="/" className="workspace-back">Back to NeuroScan AI</a><p className="amber-label">FREE DEMO USED</p><h1>Your free analysis has been used.</h1><p className="app-subtitle">Create an account to continue using NeuroScan AI.</p><div className="demo-actions"><a href="/signup" className="primary-action">Create account</a><a href="/login" className="neuro-text-link">Sign in</a></div></main>;

  return <main className="demo-page">
    <a href="/" className="workspace-back">Back to NeuroScan AI</a><p className="amber-label">ONE FREE ANALYSIS</p><h1>Bring the scan<br /><span>into focus.</span></h1>
    <p className="app-subtitle">Upload a complete compressed NIfTI MRI study once without an account. The browser sends your selected source files directly to the AI inference service. This AI-assisted demonstration does not provide a clinical diagnosis.</p>
    <form className="study-form hardened-study-form demo-study-form" onSubmit={submit}>
      <fieldset className="study-intake"><legend>Upload MRI files</legend><p>Required modalities: T1, T1CE, T2, and FLAIR. Supported: `.nii.gz` only.</p><div className="study-intake-actions"><button type="button" className="upload-choice" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={17} /> Upload MRI files</button><button type="button" className="upload-choice" onClick={() => folderInput.current?.click()} disabled={busy}><FolderUp size={17} /> Upload MRI folder</button></div><input ref={fileInput} className="sr-only" type="file" multiple accept=".nii.gz,application/gzip,application/x-gzip" onChange={collect} /><input ref={folderInput} className="sr-only" type="file" multiple onChange={collect} /></fieldset>
      {ignored.length > 0 && candidates.length === 0 && <p className="auth-error" role="alert">No supported compressed NIfTI MRI files were detected. Files must use the `.nii.gz` extension and include a recognized modality.</p>}
      {candidates.length > 0 && <section className="detected-study" aria-live="polite"><div><p className="amber-label">MRI STUDY READY</p><span>{candidates.length} MRI files detected</span></div>{modalities.map(({ value, label }) => <div className="detected-modality" key={value}><strong>{label}</strong>{grouped[value].length === 1 ? <span><Check size={15} /> {grouped[value][0]?.file.name}</span> : grouped[value].length > 1 ? <label>Multiple possible {label} files detected<select value={selected[value] ?? 0} onChange={(event) => setSelected((current) => ({ ...current, [value]: Number(event.target.value) }))} disabled={busy}>{grouped[value].map((candidate, index) => <option key={`${candidate.file.name}-${index}`} value={index}>{candidate.relativePath || candidate.file.name}</option>)}</select></label> : <span className="missing-modality"><FileWarning size={15} /> {label} file not detected</span>}</div>)}{missing.length > 0 && <p className="incomplete-warning"><FileWarning size={16} /> This MRI study is incomplete. Missing: {missing.join(", ")}.</p>}{ignored.length > 0 && <details className="ignored-files"><summary>{ignored.length} unsupported file{ignored.length === 1 ? " was" : "s were"} ignored</summary><ul>{ignored.map((name) => <li key={name}>{name}</li>)}</ul></details>}</section>}
      {(busy || phase === "Segmentation completed" || inferenceError) && <section className="detected-study inference-status" aria-live="polite"><div><p className="amber-label">AI SEGMENTATION</p><span>{phase === "idle" ? "Inference could not be completed" : phase}</span></div>{jobId && <div className="detected-modality"><strong>GPU JOB</strong><span>{phase === "Segmentation completed" ? "Completed" : "Processing"}</span></div>}{inferenceError && <p className="auth-error" role="alert">{inferenceError}</p>}</section>}
      {!completed && <button className="primary-action" type="submit" disabled={!complete || busy || completeReal.isPending}>{busy ? <><LoaderCircle className="spin-icon" size={16} /> {phase}</> : "Run AI analysis"}</button>}
    </form>
    {completed && visualizationUrl && sliceCount && <section className="detected-study demo-result" aria-live="polite"><div><p className="amber-label">SEGMENTATION COMPLETED</p><span>Whole Tumor, Tumor Core, and Enhancing Tumor overlay</span></div><img src={visualizationUrl} className="demo-result-image" alt={`AI-assisted segmentation visualization for axial slice ${slice + 1}`} /><label className="demo-slice-control">Axial slice <span>Slice {slice + 1} / {sliceCount}</span><input type="range" min="0" max={sliceCount - 1} value={slice} onChange={(event) => setSlice(Number(event.target.value))} aria-label="Segmentation visualization axial slice" /></label>{inferenceError && <p className="auth-error" role="alert">{inferenceError}</p>}<div className="demo-actions"><a href="/signup" className="primary-action">Create account</a><a href="/login" className="neuro-text-link">Sign in</a></div></section>}
  </main>;
}
