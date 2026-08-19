import { ArrowLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import MriModalityTabs from "@/components/MriModalityTabs";

export default function ClinicalWorkspace() {
  return (
    <div className="clinical-page">
      <header className="clinical-header">
        <a href="/" className="clinical-brand"><NeuroLogo /></a>
        <nav aria-label="Clinical workspace navigation">
          <a href="/dashboard">Dashboard</a>
          <a href="#study">Patients</a>
          <a href="/workspace" aria-current="page">MRI studies</a>
          <a href="#analysis">Analysis</a>
          <a href="#settings">Settings</a>
        </nav>
      </header>
      <main className="clinical-main" id="study">
        <a href="/" className="workspace-back"><ArrowLeft size={15} strokeWidth={1.5} /> Back to NeuroScan AI</a>
        <div className="study-heading">
          <div>
            <p className="amber-label">DEMONSTRATION STUDY 001</p>
            <h1>MRI Study <span>· 18 Aug 2026</span></h1>
          </div>
          <p>AI-assisted review environment. This illustration is not a diagnostic result.</p>
        </div>
        <section className="clinical-canvas" aria-label="MRI study workspace">
          <MriModalityTabs />
          <aside className="analysis-controls" id="analysis">
            <p>AI-ASSISTED SEGMENTATION</p>
            <div className="analysis-status"><span /> Ready for clinical review</div>
            <label>Segmentation <button type="button" aria-pressed="true">Visible</button></label>
            <label>Opacity <input type="range" min="0" max="100" defaultValue="62" aria-label="Segmentation opacity" /></label>
            <label>Slice <span>082 / 156</span></label>
            <label>Tools <span className="tool-icons"><SlidersHorizontal size={15} /> Zoom · Pan</span></label>
          </aside>
        </section>
        <section className="analysis-progress" aria-label="Analysis status">
          <p>ANALYSIS IN PROGRESS</p>
          {['Preparing MRI', 'Running segmentation', 'Preparing results', 'Ready for review'].map((step, index) => (
            <div key={step}><span>0{index + 1}</span>{step}{index < 3 && <ChevronRight size={15} strokeWidth={1.4} />}</div>
          ))}
        </section>
      </main>
    </div>
  );
}
