import { request } from "../../../core/http/client";

import type { CurrentUser } from "../contracts";

export function me(): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/me");
}

export function logout(): Promise<undefined> {
  return request<undefined>("/auth/logout", { method: "POST" });
}
