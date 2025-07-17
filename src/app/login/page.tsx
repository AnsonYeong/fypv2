"use client";
import { useState } from "react";
import { ethers } from "ethers";
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

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to connect wallet");
      }
    } else {
      setError("MetaMask is not installed. Please install it to use this app.");
    }
  };

  const logout = () => {
    setAccount(null);
    setError(null);
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
                <button className="pretty-button mt-4" onClick={logout}>
                  Back
                </button>
              </>
            ) : (
              <button className="pretty-button mb-4" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
            {error && <p className="mt-4 text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
