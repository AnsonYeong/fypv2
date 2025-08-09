import Link from "next/link";
import Image from "next/image";
import "./app.css";

export default function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-header">
        <div className="landing-header-logo-row">
          <Link href="#" className="landing-header-logo-link">
            {/* Placeholder for icon */}
            <span className="landing-header-logo-icon" />
            <span className="landing-header-logo-text">BlockShare</span>
          </Link>
          <nav className="landing-header-nav">
            <Link href="#features" className="landing-header-link">
              Features
            </Link>
            <Link href="/login" className="landing-header-link">
              Sign In
            </Link>
            <Link href="/login" className="landing-header-cta-btn">
              Get Started
            </Link>
          </nav>
        </div>
      </header>
      <main className="landing-main">
        <section className="landing-hero-section">
          <div className="landing-hero-container">
            <div className="landing-hero-content">
              <h1 className="landing-hero-title">
                Secure, Decentralized File Sharing
              </h1>
              <p className="landing-hero-subtitle">
                BlockShare provides a robust platform for uploading, managing,
                and sharing your files with the power of decentralized storage.
              </p>
              <Link href="/login" className="landing-hero-btn">
                Upload Your First File
              </Link>
            </div>
            <div className="landing-hero-image-wrapper">
              <Image
                src="/newlogo.png"
                width={400}
                height={400}
                alt="Hero"
                className="landing-hero-image"
              />
            </div>
          </div>
        </section>
        <section id="features" className="landing-features-section">
          <div className="landing-features-header">
            <span className="landing-features-badge">Key Features</span>
            <h2 className="landing-features-title">Why Choose BlockShare?</h2>
            <p className="landing-features-desc">
              Our platform is built with security, collaboration, and control in
              mind.
            </p>
          </div>
          <div className="landing-features-cards">
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-secure" />
              <h3 className="landing-feature-title">Secure Storage</h3>
              <p className="landing-feature-text">
                Your files are encrypted and stored on a decentralized network,
                ensuring maximum security and privacy.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-access" />
              <h3 className="landing-feature-title">Access Control</h3>
              <p className="landing-feature-text">
                Easily manage who can view, edit, or share your files with
                granular permission settings.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-version" />
              <h3 className="landing-feature-title">Version History</h3>
              <p className="landing-feature-text">
                Track changes and revert to previous versions of your files with
                our intuitive version control system.
              </p>
            </div>
          </div>
        </section>
        {/* Tech Stack Section */}
        <section id="tech-stack" className="landing-tech-section">
          <div className="landing-features-header">
            <span className="landing-features-badge">Tech Stack</span>
            <h2 className="landing-features-title">What Powers BlockShare?</h2>
            <p className="landing-features-desc">
              BlockShare is built on a modern, secure, and scalable technology
              stack.
            </p>
          </div>
          <div className="landing-features-cards">
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-nextjs" />
              <h3 className="landing-feature-title">Next.js</h3>
              <p className="landing-feature-text">
                The React framework for production, enabling fast, scalable, and
                SEO-friendly web apps.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-react" />
              <h3 className="landing-feature-title">React</h3>
              <p className="landing-feature-text">
                A powerful JavaScript library for building user interfaces with
                reusable components.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-typescript" />
              <h3 className="landing-feature-title">TypeScript</h3>
              <p className="landing-feature-text">
                Strongly typed JavaScript for safer, more maintainable code and
                developer productivity.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-ethereum" />
              <h3 className="landing-feature-title">Ethereum & Ethers.js</h3>
              <p className="landing-feature-text">
                Decentralized blockchain platform and library for secure,
                trustless transactions and wallet integration.
              </p>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-contracts" />
              <h3 className="landing-feature-title">Smart Contracts</h3>
              <p className="landing-feature-text">
                Custom blockchain contracts for secure, automated, and
                transparent file management.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <p className="landing-footer-text">
          &copy; {new Date().getFullYear()} BlockShare. All rights reserved.
        </p>
        <nav className="landing-footer-nav">
          <Link href="#" className="landing-footer-link">
            Terms of Service
          </Link>
          <Link href="#" className="landing-footer-link">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
