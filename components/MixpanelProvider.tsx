"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { identifyClient } from "@/lib/analytics-client";

// Mounted once in the root layout, alongside <Analytics />. Its only job is
// continuous identity linking: call identify() on every page load where a
// user is signed in, not just at the moment they first sign up — otherwise
// client-side events from a normal already-signed-in visit would stay
// attached to an anonymous device id instead of the real Clerk user.
export default function MixpanelProvider() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      identifyClient(userId);
    }
  }, [isLoaded, isSignedIn, userId]);

  return null;
}
