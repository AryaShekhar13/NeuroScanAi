import { LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { useRoute } from "wouter";
import ClinicalShell from "@/components/ClinicalShell";
import MriSliceNavigator from "@/components/MriSliceNavigator";
import { trpc } from "@/lib/trpc";

export default function StudyViewerPage() {
  const [, params] = useRoute("/studies/:id"); const id = Number(params?.id); const detail = trpc.studies.get.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 }); const utils = trpc.useUtils();
  const submit = trpc.analysis.submitMock.useMutation({ onSuccess: async (data) => { await utils.studies.get.invalidate({ id }); await utils.analysis.list.invalidate(); toast.success(data.notice); } });
  if (detail.isLoading) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving study</p></main></ClinicalShell>;
  if (!detail.data?.study) return <ClinicalShell active="/studies"><main className="app-main"><p className="app-empty">This study is unavailable or you do not have access.</p></main></ClinicalShell>;
  const { study, patient, files, jobs } = detail.data.study;
  return <ClinicalShell active="/studies"><main className="clinical-main"><a href="/studies" className="workspace-back">Back to MRI studies</a><div className="study-heading"><div><p className="amber-label">MRI STUDY · {patient.patientReference}</p><h1>{patient.displayName} <span>· {new Date(study.studyDate).toLocaleDateString()}</span></h1></div><p>Authenticated clinical review workspace. The reference preview is derived from a supplied NIfTI study and supports interface review only; it is not a diagnostic MRI viewer.</p></div><section className="clinical-canvas"><MriSliceNavigator /><aside className="analysis-controls"><p>AI-ASSISTED ANALYSIS</p><div className="analysis-status"><span /> {jobs[0] ? jobs[0].status.replaceAll("_", " ") : "No analysis submitted"}</div><label>Files <span>{files.length} uploaded</span></label><label>Segmentation <span>Not available</span></label><label>Opacity <input type="range" min="0" max="100" defaultValue="62" aria-label="Segmentation opacity" disabled /></label><label>Slice <span>Navigator active</span></label><button className="primary-action" type="button" onClick={() => submit.mutate({ studyId: study.id })} disabled={submit.isPending}>{submit.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <><Play size={15} /> Run demo analysis</>}</button></aside></section><section className="analysis-progress"><p>STUDY FILES</p>{files.length ? files.map((file) => <div key={file.id}><span>{file.modality.toUpperCase()}</span>{file.originalFilename}</div>) : <span>No files recorded</span>}</section></main></ClinicalShell>;
}
