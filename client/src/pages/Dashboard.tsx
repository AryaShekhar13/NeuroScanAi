import { ArrowUpRight, ChevronRight } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";

const studyRows = [
  { patient: "Patient 001", date: "18 Aug 2026", modalities: "T1 · T1CE · T2 · FLAIR", status: "Ready for review" },
  { patient: "Patient 002", date: "17 Aug 2026", modalities: "T1 · T2 · FLAIR", status: "Processing" },
];

export default function Dashboard() {
  return (
    <div className="clinical-page dashboard-page">
      <header className="clinical-header">
        <a href="/" className="clinical-brand"><NeuroLogo /></a>
        <nav aria-label="Clinical workspace navigation">
          <a href="/dashboard" aria-current="page">Dashboard</a>
          <a href="#patients">Patients</a>
          <a href="/workspace">MRI studies</a>
          <a href="#analysis">Analysis</a>
          <a href="#settings">Settings</a>
        </nav>
      </header>
      <main className="dashboard-main">
        <p className="amber-label">CLINICAL WORKSPACE / DEMONSTRATION</p>
        <h1>Good morning, <span>Dr. Riley.</span></h1>
        <p className="dashboard-intro">Review recent studies and AI-assisted analysis activity.</p>
        <p className="dashboard-disclaimer">All entries shown are illustrative demonstration data and require clinical review.</p>

        <section className="dashboard-summary" aria-label="Study summary">
          {[['12', 'Patients'], ['28', 'Studies'], ['21', 'Completed'], ['3', 'Needs review']].map(([value, label]) => (
            <div key={label}><strong>{value}</strong><span>{label}</span></div>
          ))}
        </section>

        <section className="recent-studies" id="patients" aria-labelledby="recent-studies-title">
          <div className="recent-heading"><div><p className="amber-label">MRI STUDIES</p><h2 id="recent-studies-title">Recent studies</h2></div><a href="/workspace">Open study view <ArrowUpRight size={16} strokeWidth={1.5} /></a></div>
          <div className="study-table" role="table" aria-label="Recent demonstration studies">
            <div className="study-table-head" role="row"><span role="columnheader">Patient</span><span role="columnheader">Acquired</span><span role="columnheader">Modalities</span><span role="columnheader">Status</span></div>
            {studyRows.map((study) => <a href="/workspace" className="study-row" role="row" key={study.patient}>
              <span role="cell">{study.patient}</span><span role="cell">{study.date}</span><span role="cell">{study.modalities}</span><span role="cell" className={study.status === 'Processing' ? 'status-processing' : ''}>{study.status}<ChevronRight size={15} strokeWidth={1.4} /></span>
            </a>)}
          </div>
        </section>
        <section className="dashboard-analysis" id="analysis"><p>AI-ASSISTED ANALYSIS</p><span>Analysis activity remains assistive. Final clinical judgment stays with the clinician.</span></section>
      </main>
    </div>
  );
}
