"use client";

import Script from "next/script";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(env: "sandbox" | "production"): void };
      Initialize(opts: { token: string; eventCallback?: (e: { name?: string; data?: { transaction_id?: string } }) => void }): void;
    };
  }
}

export function PaddleCheckout({ token, sandbox }: { token: string; sandbox: boolean }) {
  return (
    <Script
      src="https://cdn.paddle.com/paddle/v2/paddle.js"
      strategy="afterInteractive"
      onLoad={() => {
        const P = window.Paddle;
        if (!P) return;
        if (sandbox) P.Environment.set("sandbox");
        // With ?_ptxn= in the URL, Paddle.js opens the checkout for that transaction automatically.
        P.Initialize({
          token,
          eventCallback: (e) => {
            if (e.name === "checkout.completed") window.location.href = "/account?purchased=paddle";
          },
        });
      }}
    />
  );
}
