"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import LetterGlitch from "../../animation/letter_glitch";
import BlurText from "../../animation/blur_text";
import "../app.css";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsConnecting(true);
        setError(null);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);

        // Store wallet address in localStorage
        localStorage.setItem("walletAddress", accounts[0]);

        // Show success message briefly before redirecting
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } catch (err: any) {
        setError(err.message || "Failed to connect wallet");
        setIsConnecting(false);
      }
    } else {
      setError("MetaMask is not installed. Please install it to use this app.");
    }
  };

  const logout = () => {
    setAccount(null);
    setError(null);
  };

  const handleBackToLanding = () => {
    router.push("/");
  };

  return (
    <div className="centered-bg">
      <div className="glitch-bg">
        <LetterGlitch
          glitchColors={["#2b4539", "#61dca3", "#61b3dc"]}
          glitchSpeed={50}
          centerVignette={true}
          outerVignette={false}
          smooth={true}
        />
      </div>
      <button
        className="pretty-button"
        onClick={handleBackToLanding}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 1000,
        }}
      >
        Back
      </button>
      <div className="main-content">
        <div className="fancy-border">
          <div className="centered-content bordered-inner">
            <BlurText
              text="Blocksecure"
              className="big-bold-white bitcount-grid-single"
              animateBy="words"
              direction="top"
              delay={80}
            />
            {account ? (
              <>
                <p className="wallet-address">Connected wallet: {account}</p>
                <p className="text-green-500 mt-2">
                  Redirecting to dashboard...
                </p>
              </>
            ) : (
              <>
                <button
                  className="pretty-button mb-4"
                  onClick={connectWallet}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </>
            )}
            {error && <p className="mt-4 text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
