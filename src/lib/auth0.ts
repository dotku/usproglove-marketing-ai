import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  session: {
    rolling: true,
    absoluteDuration: 28800,
    inactivityDuration: 3600,
    cookie: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});
