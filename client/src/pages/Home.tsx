/**
/**
 * Dala design reminder: editorial asymmetry, giant regular-weight typography, a black-void canvas,
 * and the constellation as the sole hero image. Never introduce cards, shadows, or UI gradients.
 */
import { ArrowDownRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import AccessRequestForm from "@/components/AccessRequestForm";
import ParticleConstellation from "@/components/ParticleConstellation";

const logoUrl = "/manus-storage/dala-logo-mark_e0a5fb13.png";
const heroUrl = "/manus-storage/dala-constellation-hero_f9405f97.png";
const fieldUrl = "/manus-storage/dala-constellation-field_7059d0bf.png";
const knowledgeUrl = "/manus-storage/dala-constellation-knowledge_113578bb.png";

const navigation = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Notes", href: "#notes" },
  { label: "Workspace", href: "/library" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="dala-page">
      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="Dala home" onClick={closeMenu}>
          <img src={logoUrl} alt="" className="brand-mark" />
          <span>Dala</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <a href="#access" className="request-link desktop-cta">
          Request access <ArrowUpRight size={15} strokeWidth={1.6} />
        </a>

        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} strokeWidth={1.5} /> : <Menu size={21} strokeWidth={1.5} />}
        </button>

        {menuOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
            <a href="#access" onClick={closeMenu} className="request-link">
              Request access <ArrowUpRight size={15} strokeWidth={1.6} />
            </a>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy reveal-up">
            <p className="eyebrow">COLLECTIVE INTELLIGENCE, ON DEMAND</p>
            <h1 id="hero-title">
              Your workplace has the answer.
              <span>Just ask Dala for it.</span>
            </h1>
            <p className="hero-body">
              Dala turns scattered expertise into a conversation your team can actually use. Find
              the context, the decisions, and the people behind the work—without changing how you
              work.
            </p>
            <a href="#access" className="primary-action">
              Request access <ArrowUpRight size={16} strokeWidth={1.7} />
            </a>
          </div>

          <div className="hero-visual" role="img" aria-label="A constellation of colorful triangular particles forming a neural cloud">
            <img src={heroUrl} alt="" className="hero-art" fetchPriority="high" decoding="async" />
            <ParticleConstellation />
            <p className="visual-caption">a field of shared intelligence</p>
          </div>

          <div className="hero-scroll-cue" aria-hidden="true">
            <span>SCROLL TO FIND THE THREAD</span>
            <ArrowDownRight size={17} strokeWidth={1.3} />
          </div>
        </section>

        <section id="manifesto" className="statement-section section-shell" aria-labelledby="manifesto-title">
          <div className="section-index">01 / THE MANIFESTO</div>
          <div className="statement-grid">
            <h2 id="manifesto-title" className="statement-title">
              Knowing more should not mean searching harder.
            </h2>
            <div className="statement-copy-wrap">
              <p className="amber-label">THE WORK IS ALREADY HERE</p>
              <p className="statement-copy">
                Your company has a memory. It lives in launch plans, meeting notes, code reviews,
                messages, and the people who made the calls. Dala makes that memory present.
              </p>
              <a href="#how-it-works" className="text-action">
                See the system at work <ArrowDownRight size={18} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="knowledge-section section-shell" aria-labelledby="knowledge-title">
          <div className="knowledge-art-wrap" aria-hidden="true">
            <img src={knowledgeUrl} alt="" className="knowledge-art" loading="lazy" decoding="async" />
            <div className="art-note art-note-top">source signals</div>
            <div className="art-note art-note-bottom">context, not just content</div>
          </div>
          <div className="knowledge-copy">
            <p className="amber-label">02 / THE CONNECTION</p>
            <h2 id="knowledge-title">Every answer keeps its point of origin.</h2>
            <p>
              Dala holds on to the detail that turns a plausible reply into a trusted one: where
              it came from, when it changed, and who can take the conversation further.
            </p>
            <dl className="principles-list">
              <div>
                <dt>Context stays attached</dt>
                <dd>Follow ideas back to the moment they were made.</dd>
              </div>
              <div>
                <dt>Expertise remains human</dt>
                <dd>Know who understands the work—and why.</dd>
              </div>
              <div>
                <dt>Learning compounds</dt>
                <dd>Let each answer create a clearer next question.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="notes" className="notes-section section-shell" aria-labelledby="notes-title">
          <div className="notes-head">
            <p className="amber-label">03 / NOTES FROM THE FIELD</p>
            <h2 id="notes-title">The best work is a relay, not a reset.</h2>
          </div>
          <div className="notes-visual">
            <img src={fieldUrl} alt="Colorful outlined triangular particles crossing a black field" loading="lazy" decoding="async" />
            <p>
              Intelligence is not a single answer. It is the trace of decisions, questions, and
              people learning from one another.
            </p>
          </div>
        </section>

        <section id="access" className="access-section section-shell" aria-labelledby="access-title">
          <p className="section-index">04 / COME BUILD THE MEMORY</p>
          <div className="access-layout">
            <h2 id="access-title">A clearer workplace begins with a better question.</h2>
            <div className="access-aside">
              <p>
                Dala is being shaped with teams who want their accumulated knowledge to feel
                alive, shared, and useful.
              </p>
              <AccessRequestForm />
              <p className="access-footnote">Early access is opening in small cohorts.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <a className="brand-lockup" href="#top" aria-label="Back to top">
          <img src={logoUrl} alt="" className="brand-mark" />
          <span>Dala</span>
        </a>
        <p>Knowledge moves when people can find one another.</p>
        <p>© 2026 Dala</p>
      </footer>
    </div>
  );
}
