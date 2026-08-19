import { LoaderCircle } from "lucide-react";
import { useRoute } from "wouter";
import ClinicalShell from "@/components/ClinicalShell";
import { trpc } from "@/lib/trpc";

export default function PatientDetailPage() {
  const [, params] = useRoute("/patients/:id"); const id = Number(params?.id); const record = trpc.patients.get.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  return <ClinicalShell active="/patients"><main className="app-main">{record.isLoading ? <p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving patient record</p> : record.data ? <><a className="workspace-back" href="/patients">Back to patients</a><p className="amber-label">PATIENT RECORD</p><h1>{record.data.patient.displayName}</h1><p className="app-subtitle">Reference {record.data.patient.patientReference}</p><a className="primary-action" href="/studies/new">Create MRI study</a></> : <p className="app-empty">This patient record is unavailable.</p>}</main></ClinicalShell>;
}
