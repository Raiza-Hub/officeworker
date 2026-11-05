import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isLoginPage = createRouteMatcher(["/login"]);
const isProtectedRoute = createRouteMatcher([
  "/create-workspace(.*)",
  "/dashboard(.*)",
  "/documents(.*)",
  "/agent(.*)",
  "/activity(.*)",
  "/profile(.*)",
  "/billing(.*)",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isLogin = isLoginPage(request);
  const isProtected = isProtectedRoute(request);

  // Proxy runs for every matched request, including RSC navigations and
  // prefetches. Use the session cookie as a fast optimistic check here;
  // Convex functions remain responsible for real authorization.
  if (!isLogin && !isProtected) return;

  const hasSession = Boolean(await convexAuth.getToken());

  if (isLogin && hasSession) {
    return nextjsMiddlewareRedirect(request, "/create-workspace");
  }

  if (isProtected && !hasSession) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
