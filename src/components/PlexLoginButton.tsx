"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";

export default function PlexLoginButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "polling" | "success" | "error">("idle");

  const startLoginFlow = async () => {
    try {
      setLoading(true);
      setStatus("idle");
      
      // 1. Request a PIN
      const res = await axios.get("/api/auth/plex/pin");
      const { pinId, authUrl } = res.data;

      // 2. Open Plex Auth in a popup window
      const popup = window.open(authUrl, "PlexLogin", "width=600,height=700");

      if (!popup) {
        alert("Please allow popups for this site to log in with Plex.");
        setLoading(false);
        return;
      }

      setStatus("polling");

      // 3. Poll the backend to check if the PIN has been authenticated
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await axios.post("/api/auth/plex/poll", { pinId });
          
          if (pollRes.data.status === "success") {
            clearInterval(pollInterval);
            popup.close();
            setStatus("success");
            setLoading(false);
            
            // Reload the page to reflect the new authenticated state
            window.location.reload();
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
          clearInterval(pollInterval);
          setStatus("error");
          setLoading(false);
        }
      }, 2000); // Poll every 2 seconds

      // Optional: Stop polling if popup is closed manually
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          if (status !== "success") {
            clearInterval(pollInterval);
            setStatus("idle");
            setLoading(false);
          }
        }
      }, 1000);

    } catch (err) {
      console.error("Failed to start login flow", err);
      setStatus("error");
      setLoading(false);
    }
  };

  if (status === "success") {
    return <span style={{ color: "#10b981", fontSize: "0.875rem" }}>Authenticated!</span>;
  }

  return (
    <button 
      onClick={startLoginFlow} 
      disabled={loading}
      style={{
        background: "none",
        border: "none",
        color: "var(--accent-primary)",
        fontWeight: 600,
        fontSize: "0.875rem",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem"
      }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {status === "polling" ? "Waiting for Plex..." : "Login to Plex \u2192"}
    </button>
  );
}
