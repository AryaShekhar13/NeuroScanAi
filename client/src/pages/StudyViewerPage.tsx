import { LoaderCircle, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRoute } from "wouter";
import ClinicalShell from "@/components/ClinicalShell";
import MriSliceNavigator from "@/components/MriSliceNavigator";
import { submitInference, type InferenceModality, type PredictResult } from "@/lib/inferenceApi";
import { trpc } from "@/lib/trpc";

type ClinicalPhase = "idle" | "Preparing original MRI..." | "AI segmentation running..." | "Segmentation completed";

function safeMessage(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|networkerror/i.test(error.message))) return "The MRI source files or AI inference service could not be reached. Please try again.";
  return error instanceof Error ? error.message : "The AI inference service could not complete this study. Please try again.";
}

export default function StudyViewerPage() {
  const [, params] = useRoute("/studies/:id");
  const id = Number(params?.id);
  const detail = trpc.studies.get.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  const prepareReal = trpc.analysis.prepareReal.useMutation();
  const operationAbortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<ClinicalPhase>("idle");
  const [prediction, setPrediction] = useState<PredictResult | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const busy = phase !== "idle" && phase !== "Segmentation completed";

  useEffect(() => () => operationAbortRef.current?.abort(), []);

  const runRealAnalysis = async () => {
    if (!detail.data?.study || busy) return;
    operationAbortRef.current?.abort(); const controller = new AbortController(); operationAbortRef.current = controller;
    setInferenceError(null); setPrediction(null); setPhase("Preparing original MRI...");
    try {
      const prepared = await prepareReal.mutateAsync({ studyId: detail.data.study.study.id });
      const entries = await Promise.all(prepared.files.map(async (source) => {
        const response = await fetch(source.url, { signal: controller.signal });
        if (!response.ok) throw new Error("A stored MRI source file could not be retrieved for analysis.");
        const blob = await response.blob();
        if (!blob.size) throw new Error("A stored MRI source file could not be retrieved for analysis.");
        return [source.modality as InferenceModality, new File([blob], source.fileName, { type: source.mimeType || "application/gzip" })] as const;
      }));
      const sourceFiles = Object.fromEntries(entries) as Record<InferenceModality, File>;
      setPhase("AI segmentation running...");
      const result = await submitInference(sourceFiles, controller.signal);
      setPrediction(result); setPhase("Segmentation completed");
      toast.success("Real MRI segmentation completed.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setInferenceError(safeMessage(error)); setPhase("idle");
    }
  };

  if (detail.isLoading) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving study</p></main></ClinicalShell>;
  if (!detail.data?.study) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-empty">This study is unavailable or you do not have access.</p></main></ClinicalShell>;
  const { study, patient, files } = detail.data.study;
  return <ClinicalShell active="/studies"><main className="clinical-main"><a href="/studies" className="workspace-back">Back to MRI studies</a><div className="study-heading"><div><p className="amber-label">MRI STUDY · {patient.patientReference}</p><h1>{patient.displayName} <span>· {new Date(study.studyDate).toLocaleDateString()}</span></h1></div><p>Authenticated clinical review workspace. The reference preview supports interface review only and is not a diagnostic MRI viewer.</p></div><section className="clinical-canvas"><MriSliceNavigator /><aside className="analysis-controls"><p>AI-ASSISTED ANALYSIS</p><div className="analysis-status"><span /> {phase === "idle" ? "Ready to run" : phase}</div><label>Files <span>{files.length} uploaded</span></label><label>Segmentation <span>{prediction ? "Available" : "Not available"}</span></label><label>Opacity <input type="range" min="0" max="100" defaultValue="62" aria-label="Segmentation opacity" disabled /></label><label>Slice <span>Navigator active</span></label><button className="primary-action" type="button" onClick={() => void runRealAnalysis()} disabled={busy || prepareReal.isPending}>{busy ? <><LoaderCircle className="spin-icon" size={16} /> {phase}</> : <><Play size={15} /> Run AI analysis</>}</button>{inferenceError && <p className="auth-error" role="alert">{inferenceError}</p>}</aside></section>{prediction && <section className="detected-study demo-result clinical-result" aria-live="polite"><div><p className="amber-label">SEGMENTATION COMPLETED</p><span>AI-assisted segmentation visualization and volumetric summary</span></div><img src={prediction.visualization.data_url} className="demo-result-image" alt="AI-assisted tumor segmentation visualization generated from this study’s MRI volumes" /><div className="prediction-summary" aria-label="Segmentation volume summary"><div><strong>Whole Tumor</strong><span>{prediction.tumor_voxels.WT.toLocaleString()} voxels</span></div><div><strong>Tumor Core</strong><span>{prediction.tumor_voxels.TC.toLocaleString()} voxels</span></div><div><strong>Enhancing Tumor</strong><span>{prediction.tumor_voxels.ET.toLocaleString()} voxels</span></div></div><p className="prediction-note">Input volume: {prediction.input_shape.join(" × ")}. This AI-assisted segmentation summary supports clinical review and does not provide a diagnosis.</p></section>}<section className="analysis-progress"><p>STUDY FILES</p>{files.length ? files.map((file) => <div key={file.id}><span>{file.modality.toUpperCase()}</span>{file.originalFilename}</div>) : <span>No files recorded</span>}</section></main></ClinicalShell>;
}
