import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Anonymous visitors fill in SetupForm here; auth is only required at the
  // final "Start Interview" submit (POST /api/sessions stays protected).
  "/dashboard",
  // Unauthenticated landing-page "try it" preview — rate-limited and input-capped
  // in the route itself (see app/api/preview-analysis/route.ts), not gated by auth.
  "/api/preview-analysis",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
