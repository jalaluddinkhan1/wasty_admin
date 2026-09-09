"use client";

import { useEffect } from "react";

import { onIdTokenChanged } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { refreshIdTokenCookie } from "@/server/auth-actions";

/**
 * Keeps the short-lived Firebase ID token cookie fresh so AWS API Bearer
 * calls keep working while the longer session cookie is still valid.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onIdTokenChanged(auth, (user) => {
      if (!user) return;
      void user
        .getIdToken(true)
        .then((token) => refreshIdTokenCookie(token))
        .catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const tick = () => {
      const user = auth.currentUser;
      if (!user) return;
      void user
        .getIdToken(true)
        .then((token) => refreshIdTokenCookie(token))
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 45 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
