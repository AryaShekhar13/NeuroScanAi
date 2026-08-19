import { ArrowUpRight, LoaderCircle, Plus } from "lucide-react";
import ClinicalShell from "@/components/ClinicalShell";
import { trpc } from "@/lib/trpc";

function dateLabel(value: Date | string) { return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }

export default function StudiesPage() {
  const studies = trpc.studies.list.useQuery();
  return <ClinicalShell active="/studies"><main className="app-main"><div className="app-title-row"><div><p className="amber-label">CLINICAL RECORDS</p><h1>MRI studies</h1></div><a className="primary-action" href="/studies/new"><Plus size={16} /> New study</a></div><section className="data-list" aria-label="MRI study list">{studies.isLoading ? <p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving studies</p> : studies.data?.length ? studies.data.map(({ study, patient }) => <a key={study.id} href={`/studies/${study.id}`} className="data-row studies-row"><span>{patient.displayName}<em>{patient.patientReference}</em></span><span>{dateLabel(study.studyDate)}</span><span>{study.status.replaceAll("_", " ")}<ArrowUpRight size={15} /></span></a>) : <p className="app-empty">No MRI studies yet. Create a patient record, then upload MRI study files.</p>}</section></main></ClinicalShell>;
}
