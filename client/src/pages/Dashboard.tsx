import { ArrowUpRight, ChevronRight, LoaderCircle } from "lucide-react";
import ClinicalShell from "@/components/ClinicalShell";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";
import { trpc } from "@/lib/trpc";

function dateLabel(value: Date | string) { return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
function statusLabel(status: string) { return status.replaceAll("_", " "); }

export default function Dashboard() {
  const { clinician } = useClinicianAuth();
  const summary = trpc.dashboard.summary.useQuery();
  const metrics = summary.data?.metrics;
  return <ClinicalShell active="/app"><main className="dashboard-main">
    <p className="amber-label">CLINICAL WORKSPACE</p><h1>Good morning, <span>Dr. {clinician?.fullName ?? "Clinician"}.</span></h1><p className="dashboard-intro">Review recent MRI studies and AI-assisted analysis activity.</p><p className="dashboard-disclaimer">All records are private to your authenticated clinical workspace. AI output remains assistive and requires clinical review.</p>
    <section className="dashboard-summary" aria-label="Live workspace summary">{summary.isLoading ? <p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Loading workspace data</p> : [[metrics?.patients ?? 0, "Patients"], [metrics?.studies ?? 0, "MRI studies"], [metrics?.completed ?? 0, "Completed analyses"], [metrics?.needsReview ?? 0, "Needs review"]].map(([value, label]) => <div key={label as string}><strong>{value}</strong><span>{label}</span></div>)}</section>
    <section className="recent-studies" aria-labelledby="recent-studies-title"><div className="recent-heading"><div><p className="amber-label">MRI STUDIES</p><h2 id="recent-studies-title">Recent studies</h2></div><a href="/studies">View all studies <ArrowUpRight size={16} strokeWidth={1.5} /></a></div><div className="study-table" role="table" aria-label="Recent MRI studies"><div className="study-table-head" role="row"><span role="columnheader">Patient</span><span role="columnheader">Acquired</span><span role="columnheader">Modalities</span><span role="columnheader">Status</span></div>{summary.data?.recentStudies.length ? summary.data.recentStudies.map(({ study, patient }) => <a href={`/studies/${study.id}`} className="study-row" role="row" key={study.id}><span role="cell">{patient.displayName}</span><span role="cell">{dateLabel(study.studyDate)}</span><span role="cell">MRI study</span><span role="cell" className={study.status === "processing" ? "status-processing" : ""}>{statusLabel(study.status)}<ChevronRight size={15} strokeWidth={1.4} /></span></a>) : <p className="app-empty">No MRI studies yet. <a href="/patients">Add a patient</a>, then create the first study.</p>}</div></section>
    <section className="dashboard-analysis"><p>AI-ASSISTED ANALYSIS</p><span>Analysis activity remains assistive. Final clinical judgment stays with the clinician.</span></section>
  </main></ClinicalShell>;
}
