import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileWarning, FolderUp, LoaderCircle, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { submitInference, type InferenceModality, type PredictResult } from "@/lib/inferenceApi";

const modalities = [
  { value: "t1", label: "T1" }, { value: "t1ce", label: "T1CE" },
  { value: "t2", label: "T2" }, { value: "flair", label: "FLAIR" },
] as const;
type Modality = (typeof modalities)[number]["value"];
type Candidate = { file: File; modality: Modality; relativePath?: string };
type InferencePhase = "idle" | "Uploading MRI..." | "AI segmentation running..." | "Segmentation completed";
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
function safeMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror/i.test(error.message))) return "The AI inference service could not be reached. Check your connection and try again.";
  return error instanceof Error ? error.message : "The AI inference service could not complete this request. Please try again.";
}
function readAsBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The selected MRI file could not be read.")); reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || ""); reader.readAsDataURL(file); }); }
function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) { return new Promise<T>((resolve, reject) => { const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds); promise.then((value) => { window.clearTimeout(timeout); resolve(value); }, (error) => { window.clearTimeout(timeout); reject(error); }); }); }

export default function DemoPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [selected, setSelected] = useState<Partial<Record<Modality, number>>>({});
  const [phase, setPhase] = useState<InferencePhase>("idle");
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictResult | null>(null);
  const [completed, setCompleted] = useState<{ notice: string; detected: Array<{ modality: Modality; fileName: string }> } | null>(null);
  const status = trpc.demo.status.useQuery();
  const utils = trpc.useUtils();
  const validateDemo = trpc.demo.validate.useMutation();
  const completeReal = trpc.demo.completeReal.useMutation();

  useEffect(() => { folderInput.current?.setAttribute("webkitdirectory", ""); folderInput.current?.setAttribute("directory", ""); return () => operationAbortRef.current?.abort(); }, []);

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

  const collect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    const accepted: Candidate[] = []; const skipped: string[] = [];
    Array.from(files).forEach((file) => {
      const modality = file.name.toLowerCase().endsWith(".nii.gz") && file.size <= maxClientFileBytes ? modalityFor(file.name) : null;
      if (!modality) skipped.push(file.name); else accepted.push({ file, modality, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined });
    });
    setCandidates(accepted); setIgnored(skipped);
    setSelected(Object.fromEntries(modalities.filter(({ value }) => accepted.some((candidate) => candidate.modality === value)).map(({ value }) => [value, 0])) as Partial<Record<Modality, number>>);
    setInferenceError(null); setCompleted(null); setPrediction(null); setPhase("idle");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFiles || status.data?.used || busy) return;
    operationAbortRef.current?.abort(); const controller = new AbortController(); operationAbortRef.current = controller;
    setInferenceError(null); setPhase("Uploading MRI...");
    try {
      const validationFiles = await Promise.all(modalities.map(async ({ value }) => ({ modality: value, fileName: selectedFiles[value].name, mimeType: selectedFiles[value].type || "application/gzip", base64: await readAsBase64(selectedFiles[value]) })));
      await withTimeout(validateDemo.mutateAsync({ files: validationFiles }), 120_000, "Secure MRI validation is taking longer than expected. Please try again.");
      setPhase("AI segmentation running...");
      const result = await submitInference(selectedFiles, controller.signal);
      const completion = await completeReal.mutateAsync({ files: modalities.map(({ value }) => ({ modality: value, fileName: selectedFiles[value].name })) });
      setPrediction(result); setCompleted(completion); setPhase("Segmentation completed"); void utils.demo.status.invalidate();
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
      {(busy || phase === "Segmentation completed" || inferenceError) && <section className="detected-study inference-status" aria-live="polite"><div><p className="amber-label">AI SEGMENTATION</p><span>{phase === "idle" ? "Inference could not be completed" : phase}</span></div>{inferenceError && <p className="auth-error" role="alert">{inferenceError}</p>}</section>}
      {!completed && <button className="primary-action" type="submit" disabled={!complete || busy || completeReal.isPending}>{busy ? <><LoaderCircle className="spin-icon" size={16} /> {phase}</> : "Run AI analysis"}</button>}
    </form>
    {completed && prediction && <section className="detected-study demo-result" aria-live="polite"><div><p className="amber-label">SEGMENTATION COMPLETED</p><span>AI-assisted segmentation visualization and volumetric summary</span></div><img src={prediction.visualization.data_url} className="demo-result-image" alt="AI-assisted tumor segmentation visualization generated from the submitted MRI study" /><div className="prediction-summary" aria-label="Segmentation volume summary"><div><strong>Whole Tumor</strong><span>{prediction.tumor_voxels.WT.toLocaleString()} voxels</span></div><div><strong>Tumor Core</strong><span>{prediction.tumor_voxels.TC.toLocaleString()} voxels</span></div><div><strong>Enhancing Tumor</strong><span>{prediction.tumor_voxels.ET.toLocaleString()} voxels</span></div></div><p className="prediction-note">Input volume: {prediction.input_shape.join(" × ")}. This AI-assisted segmentation summary supports clinical review and does not provide a diagnosis.</p><div className="demo-actions"><a href="/signup" className="primary-action">Create account</a><a href="/login" className="neuro-text-link">Sign in</a></div></section>}
  </main>;
}
