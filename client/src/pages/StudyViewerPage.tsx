import { LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { useRoute } from "wouter";
import ClinicalShell from "@/components/ClinicalShell";
import NiftiSliceViewer from "@/components/NiftiSliceViewer";
import { trpc } from "@/lib/trpc";

export default function StudyViewerPage() {
  const [, params] = useRoute("/studies/:id");
  const id = Number(params?.id);
  const enabled = Number.isInteger(id) && id > 0;
  const detail = trpc.studies.get.useQuery({ id }, { enabled });
  const viewerSources = trpc.analysis.viewerSources.useQuery({ studyId: id }, { enabled: Boolean(detail.data?.study) });
  if (detail.isLoading) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving study</p></main></ClinicalShell>;
  if (!detail.data?.study) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-empty">This study is unavailable or you do not have access.</p></main></ClinicalShell>;
  const { study, patient, files, results } = detail.data.study;
  const hasAuthoritativeMask = Boolean(results[0]?.analysisResults.segmentationStoragePath);
  const viewer = viewerSources.data?.source ? <NiftiSliceViewer source={viewerSources.data.source} segmentation={viewerSources.data.segmentation} /> : <div className="mri-slice-viewer-error">{viewerSources.isLoading ? "Retrieving the owned NIfTI source volume…" : "The stored NIfTI source cannot be prepared for preview. No reference imagery is shown."}</div>;
  return <ClinicalShell active="/studies"><main className="clinical-main"><a href="/studies" className="workspace-back">Back to MRI studies</a><div className="study-heading"><div><p className="amber-label">MRI STUDY · {patient.patientReference}</p><h1>{patient.displayName} <span>· {new Date(study.studyDate).toLocaleDateString()}</span></h1></div><p>Authenticated NIfTI review workspace. Original MRI volumes and any segmentation mask remain authoritative; browser previews are derived only from those stored 3D NIfTI assets.</p></div><section className="clinical-canvas">{viewer}<aside className="analysis-controls"><p>AI-ASSISTED ANALYSIS</p><div className="analysis-status"><span /> {hasAuthoritativeMask ? "Authoritative NIfTI mask available" : "NIfTI study ready"}</div><label>Files <span>{files.length} uploaded</span></label><label>Segmentation <span>{hasAuthoritativeMask ? "NIfTI mask stored" : "Awaiting NIfTI mask"}</span></label><label>Opacity <input type="range" min="0" max="100" defaultValue="62" aria-label="Segmentation opacity" disabled={!hasAuthoritativeMask} /></label><label>Slice <span>NIfTI navigator active</span></label><button className="primary-action" type="button" onClick={() => toast.info("The NIfTI inference API is not active. This study is ready to accept a validated 3D segmentation .nii.gz mask when the API becomes available.")}><Play size={15} /> NIfTI analysis pending</button></aside></section><section className="analysis-progress"><p>AUTHORITATIVE STUDY ASSETS</p>{files.length ? files.map((file) => <div key={file.id}><span>{file.modality.toUpperCase()} · NIfTI</span>{file.originalFilename}</div>) : <span>No files recorded</span>}{hasAuthoritativeMask ? <div><span>SEGMENTATION · NIfTI</span>Validated 3D mask stored</div> : <div><span>SEGMENTATION</span>Awaiting a compatible `.nii.gz` mask from the inference API</div>}</section></main></ClinicalShell>;
}
