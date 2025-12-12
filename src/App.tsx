import React, { useState, useEffect, useRef } from "react";
import GameCanvas from "./components/GameCanvas";
import UIOverlay from "./components/UIOverlay";
import { WeaponType, ThoughtBubbleState } from "./types";
import { GoogleGenAI } from "@google/genai";
import emailjs from "@emailjs/browser"; // Import EmailJS

const App: React.FC = () => {
  const [health, setHealth] = useState(1000);
  const [weapon, setWeapon] = useState<WeaponType>(WeaponType.BAT);
  const [thought, setThought] = useState<ThoughtBubbleState | null>(null);
  const [isDead, setIsDead] = useState(false);

  // Rate limiter for emails
  const lastEmailSentTime = useRef<number>(0);

  // Handle thought bubble timeouts
  useEffect(() => {
    if (thought) {
      const timer = setTimeout(() => {
        setThought(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [thought]);

  const sendDeathEmail = async (damageLog: string[]) => {
    const now = Date.now();
    // 1 Minute Rate Limit (60,000 ms)
    if (now - lastEmailSentTime.current < 60000) {
      console.log("Email skipped due to rate limit (1 per minute).");
      return;
    }

    lastEmailSentTime.current = now;

    try {
      // 1. Generate the content using Gemini
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY }); // Ensure this env var is set
      const recentDamage = damageLog.slice(-10).join(", ");
      const prompt = `You are a sarcastic coroner. A cardboard ragdoll named "Buddy" has just died. The cause of death was cumulative damage, specifically: [${recentDamage}]. Write a short, funny, 30-word email body describing how he met his demise.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Updated model name (2.5 doesn't exist yet publicly)
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const emailBody = response.text || "He died of natural cardboard causes.";
      const subject = "Ak Killed You Again!";

      // 2. Send the email automatically via EmailJS
      // Replace these strings with your actual EmailJS IDs
      const serviceID = "service_aw8e4ge";
      const templateID = "template_nlmxl3q";
      const publicKey = "V5Rhhl5fo9uwrgcct";

      const templateParams = {
        subject: subject,
        message: emailBody,
        to_email: "zondyinc@gmail.com", // If your template uses a variable for 'to_email'
      };

      await emailjs.send(serviceID, templateID, templateParams, publicKey);

      console.log("Death notification sent successfully!");
    } catch (error) {
      console.error("Error generating or sending death email:", error);
    }
  };

  const handleDeath = (damageLog: string[]) => {
    setIsDead(true);
    setHealth(0);

    // Trigger the email logic
    sendDeathEmail(damageLog);

    // Respawn timer
    setTimeout(() => {
      setIsDead(false);
      setHealth(1000);
    }, 2000);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden cardboard-bg">
      {/* Background Floor Area */}
      <div className="absolute bottom-0 left-0 w-full h-[100px] cardboard-floor z-0 pointer-events-none" />

      <GameCanvas
        weapon={weapon}
        onHealthChange={setHealth}
        onThought={setThought}
        onDeath={handleDeath}
        isDead={isDead}
      />

      <UIOverlay
        health={health}
        weapon={weapon}
        setWeapon={setWeapon}
        thought={thought}
      />

      {/* Interaction Block on Death */}
      {isDead && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-pulse pointer-events-auto">
          <h1 className="text-6xl font-black text-red-600 tracking-tighter rotate-[-5deg] border-4 border-red-600 px-8 py-4 rounded-xl bg-white/90">
            KO!
          </h1>
        </div>
      )}
    </div>
  );
};

export default App;

//service_aw8e4ge
//template_q3480qv
//V5Rhhl5fo9uwrgcct
