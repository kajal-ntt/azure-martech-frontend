// import { createAuthClient } from "better-auth/react";
// import { jwtClient } from "better-auth/client/plugins";

// export const authClient = createAuthClient({
//   baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
//   fetchOptions: {
//     credentials: "include",
//   },
//   plugins: [jwtClient()],
// });

// export async function getAgentToken(): Promise<string | null> {
//   const { data, error } = await authClient.token();
//   if (error || !data) return null;
//   return data.token ?? null;
// }

