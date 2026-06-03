export const USE_DUMMY_DATA = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export const dummySession = {
  user: {
    id: "mock-user-001",
    name: "Demo User",
    email: "demo@marktech.ai",
  },
  session: {
    token: "mock_jwt_token_for_ui_dev",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
};
