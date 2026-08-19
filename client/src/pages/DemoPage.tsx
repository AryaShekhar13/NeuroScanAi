import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileWarning, FolderUp, LoaderCircle, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";

const modalities = [
  { value: "t1", label: "T1" }, { value: "t1ce", label: "T1CE" },
  { value: "t2", label: "T2" }, { value: "flair", label: "FLAIR" },
] as const;
type Modality = (typeof modalities)[number]["value"];
type Candidate = { file: File; modality: Modality; relativePath?: string };
const maxClientFileBytes = 8 * 1024 * 1024;

const asBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("File could not be read."));
  reader.onload = () => {
    const encoded = typeof reader.result === "string" ? reader.result.split(",")[1] : undefined;
    encoded ? resolve(encoded) : reject(new Error("File could not be encoded."));
  };
  reader.readAsDataURL(file);
});
const tokens = (name: string) => name.toLowerCase().replace(/\.nii\.gz$/, "").split(/[^a-z0-9]+/).filter(Boolean);
function modalityFor(name: string): Modality | null {
  const value = tokens(name); const has = (item: string) => value.includes(item);
  if (has("flair")) return "flair";
  if (has("t1ce") || has("t1c") || has("t1gd") || (has("t1") && (has("gd") || has("ce")))) return "t1ce";
  if (has("t1") || has("t1w")) return "t1";
  if (has("t2") || has("t2w")) return "t2";
  return null;
}

export default function DemoPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [selected, setSelected] = useState<Partial<Record<Modality, number>>>({});
  const status = trpc.demo.status.useQuery();
  const utils = trpc.useUtils();
  const run = trpc.demo.run.useMutation({ onSuccess: () => utils.demo.status.invalidate() });

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    folderInput.current?.setAttribute("directory", "");
  }, []);

  const grouped = useMemo(() => modalities.reduce((result, modality) => ({
    ...result, [modality.value]: candidates.filter((candidate) => candidate.modality === modality.value),
  }), {} as Record<Modality, Candidate[]>), [candidates]);
  const missing = modalities.filter(({ value }) => !grouped[value].length).map(({ label }) => label);
  const complete = !missing.length && modalities.every(({ value }) => selected[value] !== undefined);

  const collect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const accepted: Candidate[] = [];
    const skipped: string[] = [];
    Array.from(files).forEach((file) => {
      const modality = file.name.toLowerCase().endsWith(".nii.gz") && file.size <= maxClientFileBytes ? modalityFor(file.name) : null;
      if (!modality) skipped.push(file.name);
      else accepted.push({ file, modality, relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined });
    });
    setCandidates(accepted);
    setIgnored(skipped);
    setSelected(Object.fromEntries(modalities.filter(({ value }) => accepted.some((candidate) => candidate.modality === value)).map(({ value }) => [value, 0])) as Partial<Record<Modality, number>>);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!complete || status.data?.used) return;
    const files = await Promise.all(modalities.map(async ({ value }) => {
      const candidate = grouped[value][selected[value] ?? 0]!;
      return { modality: value, fileName: candidate.file.name, mimeType: candidate.file.type || "application/octet-stream", base64: await asBase64(candidate.file), relativePath: candidate.relativePath };
    }));
    run.mutate({ files });
  };

  if (status.isLoading) return <main className="demo-page"><p>Preparing secure demo access…</p></main>;
  if (status.data?.used || run.data?.used) return <main className="demo-page">
    <a href="/" className="workspace-back">Back to NeuroScan AI</a><p className="amber-label">FREE DEMO USED</p>
    <h1>Your free analysis has been used.</h1><p className="app-subtitle">{run.data?.notice || "Create an account to continue using NeuroScan AI."}</p>
    {run.data?.detected && <section className="detected-study"><div><p className="amber-label">MRI FILES DETECTED</p><span>{run.data.detected.length} verified files</span></div>{run.data.detected.map((file) => <div className="detected-modality" key={file.modality}><strong>{file.modality.toUpperCase()}</strong><span><Check size={15} /> {file.fileName}</span></div>)}</section>}
    <div className="demo-actions"><a href="/signup" className="primary-action">Create account</a><a href="/login" className="neuro-text-link">Sign in</a></div>
  </main>;

  return <main className="demo-page">
    <a href="/" className="workspace-back">Back to NeuroScan AI</a><p className="amber-label">ONE FREE ANALYSIS</p>
    <h1>Bring the scan<br /><span>into focus.</span></h1>
    <p className="app-subtitle">Upload a complete compressed NIfTI MRI study once without an account. The browser and server independently validate `.nii.gz` source files. This AI-assisted demonstration does not provide a clinical diagnosis.</p>
    <form className="study-form hardened-study-form demo-study-form" onSubmit={submit}>
      <fieldset className="study-intake"><legend>Upload MRI files</legend><p>Required modalities: T1, T1CE, T2, and FLAIR. Supported: `.nii.gz` only.</p>
        <div className="study-intake-actions"><button type="button" className="upload-choice" onClick={() => fileInput.current?.click()}><Upload size={17} /> Upload MRI files</button><button type="button" className="upload-choice" onClick={() => folderInput.current?.click()}><FolderUp size={17} /> Upload MRI folder</button></div>
        <input ref={fileInput} className="sr-only" type="file" multiple accept=".nii.gz,application/gzip,application/x-gzip" onChange={collect} />
        <input ref={folderInput} className="sr-only" type="file" multiple onChange={collect} />
      </fieldset>
      {ignored.length > 0 && candidates.length === 0 && <p className="auth-error" role="alert">No supported compressed NIfTI MRI files were detected. Files must use the `.nii.gz` extension and include a recognized modality.</p>}
      {candidates.length > 0 && <section className="detected-study" aria-live="polite">
        <div><p className="amber-label">MRI STUDY READY</p><span>{candidates.length} MRI files detected</span></div>
        {modalities.map(({ value, label }) => <div className="detected-modality" key={value}><strong>{label}</strong>{grouped[value].length === 1 ? <span><Check size={15} /> {grouped[value][0]?.file.name}</span> : grouped[value].length > 1 ? <label>Multiple possible {label} files detected<select value={selected[value] ?? 0} onChange={(event) => setSelected((current) => ({ ...current, [value]: Number(event.target.value) }))}>{grouped[value].map((candidate, index) => <option key={`${candidate.file.name}-${index}`} value={index}>{candidate.relativePath || candidate.file.name}</option>)}</select></label> : <span className="missing-modality"><FileWarning size={15} /> {label} file not detected</span>}</div>)}
        {missing.length > 0 && <p className="incomplete-warning"><FileWarning size={16} /> This MRI study is incomplete. Missing: {missing.join(", ")}.</p>}
        {ignored.length > 0 && <details className="ignored-files"><summary>{ignored.length} unsupported file{ignored.length === 1 ? " was" : "s were"} ignored</summary><ul>{ignored.map((name) => <li key={name}>{name}</li>)}</ul></details>}
      </section>}
      <button className="primary-action" type="submit" disabled={!complete || run.isPending}>{run.isPending ? <LoaderCircle className="spin-icon" size={16} /> : "Run AI analysis"}</button>
      {run.error && <p className="auth-error">{run.error.message}</p>}
    </form>
  </main>;
}
