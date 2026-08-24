/** NeuroScan AI is an immersive clinical-AI research introduction, not a conventional SaaS landing page. */
import { ArrowDownRight, ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { MriReferenceSlice } from "@/components/MriReferenceSlice";
import { NeuroLogo } from "@/components/NeuroLogo";
import ParticleConstellation from "@/components/ParticleConstellation";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const navigation = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#workflow" },
  { label: "For clinicians", href: "#clinicians" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const revealRootRef = useScrollReveal<HTMLElement>();
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="neuro-page">
      <header className="neuro-header">
        <a href="#top" className="neuro-brand" onClick={closeMenu}><NeuroLogo /></a>
        <nav className="neuro-nav" aria-label="Primary navigation">
          {navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          <a href="/login">Sign in</a>
          <a href="/demo" className="neuro-get-started">Try one free analysis <ArrowUpRight size={14} strokeWidth={1.6} /></a>
        </nav>
        <button type="button" className="neuro-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} strokeWidth={1.5} /> : <Menu size={21} strokeWidth={1.5} />}
        </button>
        {menuOpen && <nav className="neuro-mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>)}
          <a href="/login" onClick={closeMenu}>Sign in</a>
          <a href="/demo" onClick={closeMenu} className="primary-action">Try one free analysis <ArrowUpRight size={14} strokeWidth={1.6} /></a>
        </nav>}
      </header>

      <main id="top" ref={revealRootRef} className="scroll-reveal">
        <section className="neuro-hero" aria-labelledby="hero-title">
          <div className="neuro-hero-copy reveal-up">
            <h1 id="hero-title">Understand <span>what lies</span><span>beneath the scan.</span></h1>
            <p className="amber-label">AI-ASSISTED MRI ANALYSIS</p>
            <p className="neuro-hero-body">A clinical workspace for reviewing brain MRI studies and exploring AI-assisted tumor segmentation.</p>
            <div className="neuro-hero-actions">
              <a href="/demo" className="primary-action">Try one free analysis <ArrowRight size={16} strokeWidth={1.6} /></a>
              <a href="/login" className="neuro-text-link">Sign in</a>
            </div>
          </div>
          <div className="neuro-hero-visual" role="img" aria-label="A brain-like structure built from floating outlined triangular particles">
            <ParticleConstellation />
            <p>mri data / neural computation / clinical insight</p>
          </div>
          <div className="neuro-scroll-cue" aria-hidden="true">Enter the field <ArrowDownRight size={16} strokeWidth={1.3} /></div>
        </section>

        <section className="neuro-problem neuro-section" aria-labelledby="problem-title" data-scroll-reveal>
          <p className="amber-label">THE PROBLEM</p>
          <h2 id="problem-title">MRI studies contain enormous amounts of information.</h2>
          <p>Finding the relevant patterns shouldn’t mean fighting through complexity.</p>
        </section>

        <section className="neuro-idea neuro-section" aria-labelledby="idea-title" data-scroll-reveal>
          <div><p className="amber-label">THE IDEA</p><h2 id="idea-title">From scan<br />to insight.</h2></div>
          <p>NeuroScan AI brings MRI studies, segmentation, and review into one focused clinical workspace.</p>
        </section>

        <section className="neuro-data neuro-section" aria-labelledby="data-title">
          <div className="data-copy" data-scroll-reveal><p className="amber-label">MULTI-MODAL MRI</p><h2 id="data-title">One brain.<br />Four perspectives.</h2><p>NeuroScan AI brings complementary MRI modalities together for AI-assisted analysis and clinical review.</p></div>
          <div className="mri-reference-grid" aria-label="Reference MRI previews from one multi-modal study" data-scroll-reveal data-reveal-delay="100">{(["t1", "t1ce", "t2", "flair"] as const).map((modality) => <figure key={modality}><MriReferenceSlice modality={modality} sliceIndex={77} labelPrefix="Demo MRI" /><figcaption>{modality.toUpperCase()}</figcaption></figure>)}</div>
          <a href="/demo" className="neuro-text-link mri-workspace-link" data-scroll-reveal data-reveal-delay="160">Explore the MRI workspace <ArrowRight size={16} strokeWidth={1.5} /></a>
        </section>

        <section className="neuro-segmentation neuro-section" aria-labelledby="segmentation-title">
          <div className="segmentation-brain" aria-hidden="true" data-scroll-reveal><ParticleConstellation /></div>
          <div className="segmentation-copy" data-scroll-reveal data-reveal-delay="100"><p className="amber-label">AI-ASSISTED SEGMENTATION</p><h2 id="segmentation-title">Find the pattern.</h2><p>AI-generated segmentation helps clinicians inspect regions of interest within the MRI study. It supports review; it does not replace clinical judgment.</p></div>
        </section>

        <section className="neuro-review neuro-section" id="clinicians" aria-labelledby="review-title">
          <div data-scroll-reveal><p className="amber-label">CLINICAL REVIEW</p><h2 id="review-title">The clinician stays<br />in control.</h2><p>Review the original MRI, inspect segmentation overlays, move through slices, and make the final clinical judgment.</p></div>
          <div className="review-orbit" aria-label="Clinical review controls illustration" data-scroll-reveal data-reveal-delay="100"><span>T1</span><span>T1CE</span><span>T2</span><span>FLAIR</span><span>SEGMENTATION</span><span>OPACITY</span><i /></div>
        </section>

        <section className="neuro-product neuro-section" id="product" aria-labelledby="product-title">
          <div className="product-heading" data-scroll-reveal><p className="amber-label">THE WORKSPACE</p><h2 id="product-title">One quiet place to look deeper.</h2><a href="/login" className="neuro-text-link">Open clinical workspace <ArrowUpRight size={16} strokeWidth={1.5} /></a></div>
          <figure className="product-mockup product-overlay-preview" data-scroll-reveal data-reveal-delay="100"><img src="/manus-storage/neuroscan-nifti-intensity-overlay_4ffd2fac.png" alt="Single axial T1CE MRI slice with a gold source-derived intensity overlay" /><figcaption><span>NIFTI-DERIVED INTENSITY OVERLAY</span><span>AXIAL · T1CE · PREVIEW ONLY</span></figcaption><p>Source-derived display preview only. This overlay is not an authoritative segmentation or clinical finding.</p></figure>
        </section>

        <section className="neuro-workflow neuro-section" id="workflow" aria-labelledby="workflow-title" data-scroll-reveal>
          <p className="amber-label">SIMPLE WORKFLOW</p><h2 id="workflow-title">From image to clinical review.</h2>
          <ol>{[["01", "Upload MRI"], ["02", "AI analysis"], ["03", "Segmentation"], ["04", "Clinical review"]].map(([number, label]) => <li key={number}><span>{number}</span><p>{label}</p></li>)}</ol>
        </section>

        <section className="neuro-final-cta neuro-section" aria-labelledby="final-title" data-scroll-reveal>
          <p className="amber-label">NEUROSCAN AI</p><h2 id="final-title">Ready to see<br />what the scan reveals?</h2><p>Create your clinical workspace and explore AI-assisted MRI analysis.</p><div><a href="/signup" className="primary-action">Create account <ArrowRight size={16} strokeWidth={1.6} /></a><a href="/login" className="neuro-text-link">Sign in</a></div>
        </section>
      </main>

      <footer className="neuro-footer"><a href="#top"><NeuroLogo /></a><p>AI-assisted MRI analysis for focused clinical review.</p><p>© 2026 NeuroScan AI</p></footer>
    </div>
  );
}
