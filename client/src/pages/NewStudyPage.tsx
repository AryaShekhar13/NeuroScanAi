import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, FileWarning, FolderUp, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import ClinicalShell from "@/components/ClinicalShell";
import { trpc } from "@/lib/trpc";

const modalities = [{ value: "t1", label: "T1" }, { value: "t1ce", label: "T1CE" }, { value: "t2", label: "T2" }, { value: "flair", label: "FLAIR" }] as const;
type Modality = typeof modalities[number]["value"];
type Candidate = { file: File; modality: Modality; relativePath?: string };
const maxClientFileBytes = 8 * 1024 * 1024;

function asBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("File could not be read.")); reader.onload = () => { const result = typeof reader.result === "string" ? reader.result.split(",")[1] : undefined; result ? resolve(result) : reject(new Error("File could not be encoded.")); }; reader.readAsDataURL(file); }); }
function filenameTokens(fileName: string) { return fileName.toLowerCase().replace(/\.nii\.gz$/, "").split(/[^a-z0-9]+/).filter(Boolean); }
function detectModality(fileName: string): Modality | null { const tokens = filenameTokens(fileName); const has = (value: string) => tokens.includes(value); if (has("flair") || (has("t2") && has("flair"))) return "flair"; if (has("t1ce") || has("t1c") || has("t1gd") || (has("t1") && (has("gd") || has("ce")))) return "t1ce"; if (has("t2") || has("t2w") || (has("t2") && has("weighted"))) return "t2"; if (has("t1") || has("t1w") || (has("t1") && has("weighted"))) return "t1"; return null; }
function isNiftiName(name: string) { return name.toLowerCase().endsWith(".nii.gz"); }
function relativePath(file: File) { return (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined; }

export default function NewStudyPage() {
  const [, setLocation] = useLocation(); const patients = trpc.patients.list.useQuery(); const fileInput = useRef<HTMLInputElement>(null); const folderInput = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState(""); const [studyDate, setStudyDate] = useState(new Date().toISOString().slice(0, 10)); const [description, setDescription] = useState(""); const [candidates, setCandidates] = useState<Candidate[]>([]); const [ignored, setIgnored] = useState<string[]>([]); const [selected, setSelected] = useState<Partial<Record<Modality, number>>>({});
  useEffect(() => { folderInput.current?.setAttribute("webkitdirectory", ""); folderInput.current?.setAttribute("directory", ""); }, []);
  const grouped = useMemo(() => modalities.reduce((result, modality) => ({ ...result, [modality.value]: candidates.filter((candidate) => candidate.modality === modality.value) }), {} as Record<Modality, Candidate[]>), [candidates]);
  const missing = modalities.filter(({ value }) => !grouped[value].length).map(({ label }) => label);
  const duplicates = modalities.filter(({ value }) => grouped[value].length > 1).map(({ label }) => label);
  const complete = !missing.length && modalities.every(({ value }) => selected[value] !== undefined);
  const create = trpc.studies.create.useMutation({ onSuccess: ({ study }) => { toast.success("MRI study created. The source files were validated and stored privately."); setLocation(`/studies/${study?.study.id}`); } });

  const collectFiles = (fileList: FileList | null) => {
    if (!fileList) return; const accepted: Candidate[] = []; const skipped: string[] = [];
    Array.from(fileList).forEach((file) => {
      if (!isNiftiName(file.name) || file.size > maxClientFileBytes) { skipped.push(file.name); return; }
      const modality = detectModality(file.name); if (!modality) { skipped.push(file.name); return; }
      accepted.push({ file, modality, relativePath: relativePath(file) });
    });
    if (!accepted.length) { toast.error("No supported NIfTI MRI files were detected."); return; }
    setCandidates(accepted); setIgnored(skipped); setSelected(Object.fromEntries(modalities.filter(({ value }) => accepted.some((candidate) => candidate.modality === value)).map(({ value }) => [value, 0])) as Partial<Record<Modality, number>>);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!patientId) { toast.error("Select a patient."); return; } if (!complete) { toast.error("This study is incomplete. Add missing modalities and resolve duplicate selections before confirming."); return; }
    try {
      const files = await Promise.all(modalities.map(async ({ value }) => { const candidate = grouped[value][selected[value] ?? 0]!; return { modality: value, fileName: candidate.file.name, mimeType: candidate.file.type || "application/octet-stream", base64: await asBase64(candidate.file), relativePath: candidate.relativePath }; }));
      create.mutate({ patientId: Number(patientId), studyDate: new Date(`${studyDate}T12:00:00Z`), description: description || undefined, files });
    } catch (error) { toast.error(error instanceof Error ? error.message : "MRI files could not be prepared."); }
  };
  return <ClinicalShell active="/studies"><main className="app-main"><a href="/studies" className="workspace-back">Back to MRI studies</a><p className="amber-label">ADD MRI STUDY</p><h1>Bring the scan into focus.</h1><p className="app-subtitle">Select a patient, then upload compressed NIfTI MRI files or a complete study folder. Only `.nii.gz` files are considered; validation and storage remain server-side.</p><form className="study-form hardened-study-form" onSubmit={submit}><label>Patient<select value={patientId} onChange={(event) => setPatientId(event.target.value)} required><option value="">Select patient</option>{patients.data?.map((patient) => <option key={patient.id} value={patient.id}>{patient.displayName} · {patient.patientReference}</option>)}</select></label><label>Study date<input type="date" value={studyDate} onChange={(event) => setStudyDate(event.target.value)} required /></label><label className="study-description">Description <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /></label><fieldset className="study-intake"><legend>Upload MRI source files</legend><p>Supported: compressed NIfTI (.nii.gz) only. Up to 8 MiB per selected file before final server validation.</p><div className="study-intake-actions"><button type="button" className="upload-choice" onClick={() => fileInput.current?.click()}><Upload size={17} /> Upload MRI files</button><button type="button" className="upload-choice" onClick={() => folderInput.current?.click()}><FolderUp size={17} /> Upload MRI folder</button></div><input ref={fileInput} className="sr-only" type="file" multiple accept=".nii.gz,application/gzip,application/x-gzip" onChange={(event) => collectFiles(event.target.files)} /><input ref={folderInput} className="sr-only" type="file" multiple onChange={(event) => collectFiles(event.target.files)} /></fieldset>{candidates.length > 0 && <section className="detected-study" aria-live="polite"><div><p className="amber-label">MRI STUDY READY</p><span>{candidates.length} MRI files detected</span></div>{modalities.map(({ value, label }) => <div className="detected-modality" key={value}><strong>{label}</strong>{grouped[value].length ? <div>{grouped[value].length === 1 ? <span><Check size={15} /> {grouped[value][0]?.file.name}</span> : <label>Multiple possible {label} files detected<select value={selected[value] ?? 0} onChange={(event) => setSelected((current) => ({ ...current, [value]: Number(event.target.value) }))}>{grouped[value].map((candidate, index) => <option key={`${candidate.file.name}-${index}`} value={index}>{candidate.relativePath || candidate.file.name}</option>)}</select></label>}</div> : <span className="missing-modality">✕ Add missing file</span>}</div>)}{missing.length > 0 && <p className="incomplete-warning"><FileWarning size={16} /> This MRI study is incomplete. Missing: {missing.join(", ")}. Add missing files before confirmation.</p>}{duplicates.length > 0 && <p className="incomplete-warning"><ChevronDown size={16} /> Select one candidate for each duplicate modality before confirmation.</p>}{ignored.length > 0 && <details className="ignored-files"><summary>{ignored.length} unsupported file{ignored.length === 1 ? " was" : "s were"} ignored</summary><ul>{ignored.map((name) => <li key={name}>{name}</li>)}</ul></details>}</section>}<button className="primary-action" type="submit" disabled={create.isPending || !complete}>{create.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <>Confirm study <ArrowRight size={16} /></>}</button>{create.error && <p className="auth-error">{create.error.message}</p>}</form>{!patients.data?.length && <p className="app-empty">Create a <a href="/patients">patient record</a> before adding a study.</p>}</main></ClinicalShell>;
}
