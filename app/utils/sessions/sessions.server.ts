import { createMemorySessionStorage } from "@remix-run/node";

// Use memory storage instead of cookie storage
// Todo : Enhance the session management 
const { getSession, commitSession, destroySession } = createMemorySessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60, // 1 hour
    path: "/",
    sameSite: "lax",
    secrets: ["42"], // Use environment variable in production
    secure: process.env.NODE_ENV === "production",
  },
});

export { getSession, commitSession, destroySession };
