import Link from "next/link";
import "./app.css";

export default function LandingPage() {
  return (
    <div className="landing-root">
      <div className="landing-brand-stack">
        <div className="landing-brand">Blocksecure</div>
        <div className="landing-brand-tagline">
          Empowering Secure Blockchain Authentication
        </div>
      </div>
      {/* Hero Section */}
      <section className="landing-hero">
        <Link href="/login" className="landing-cta">
          Get Started
        </Link>
      </section>
      {/* About Section */}
      <section className="landing-section">
        <h2 className="landing-section-title">About Blocksecure</h2>
        <p className="landing-section-text">
          Blocksecure is a next-generation authentication platform leveraging
          blockchain technology to provide secure, decentralized, and
          user-friendly access to your digital world. Say goodbye to passwords
          and hello to seamless, trustless login experiences.
        </p>
      </section>
      {/* How It Works */}
      <section className="landing-section alt-bg">
        <h2 className="landing-section-title">How It Works</h2>
        <ol className="landing-steps">
          <li>Connect your crypto wallet</li>
          <li>Sign a secure message</li>
          <li>Access your account instantly</li>
        </ol>
      </section>
      {/* Tech Stack */}
      <section className="landing-section">
        <h2 className="landing-section-title">Tech Stack</h2>
        <ul className="landing-tech-list">
          <li>Next.js</li>
          <li>React</li>
          <li>TypeScript</li>
          <li>Ethereum & Ethers.js</li>
          <li>Custom Blockchain Smart Contracts</li>
        </ul>
      </section>
      {/* Footer */}
      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} Blocksecure. All rights reserved.
        </span>
        <a href="https://github.com/" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
