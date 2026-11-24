import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. `baseURL` defaults to the current origin. */
export const authClient = createAuthClient();
