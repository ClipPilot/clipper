import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Since we're using localStorage for auth tokens (client-side only),
  // we can't check authentication in middleware (server-side).
  // Auth checks are handled in the page components themselves.
  return NextResponse.next();
}

export const config = {
  // Exclude static assets, API routes, and public files from middleware
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|voices|images|fonts|.*\\.(?:png|jpg|jpeg|gif|svg|ico|mp3|mp4|webm|wav|ogg)).*)"],
};
