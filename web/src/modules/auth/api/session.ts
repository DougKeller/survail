import { request } from "../../../core/http/client";

import type { CurrentUser } from "../contracts";

export function me(): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/me");
}

export function logout(): Promise<undefined> {
  return request<undefined>("/auth/logout", { method: "POST" });
}

export function updateSettings(scoringEnabled: boolean): Promise<CurrentUser> {
  return request<CurrentUser>("/auth/me/settings", {
    method: "PATCH",
    body: JSON.stringify({ scoring_enabled: scoringEnabled }),
  });
}
