import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, request } from "./api";

describe("API client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("submits login credentials as URL-encoded form data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "token", token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.login("owner@example.com", "strong-password-123");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(options.headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(options.body).toBeInstanceOf(URLSearchParams);
    expect(options.body.get("username")).toBe("owner@example.com");
  });

  it("converts validation arrays into a readable error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "Password is required" }] }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(request("/auth/login", { method: "POST" })).rejects.toThrow(
      "Password is required",
    );
  });

  it("attaches the stored bearer token", async () => {
    localStorage.setItem("verity_token", "workspace-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api.me();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.get("Authorization")).toBe("Bearer workspace-token");
  });
});
