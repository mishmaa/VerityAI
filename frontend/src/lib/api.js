const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export async function request(path, options = {}) {
  const token = localStorage.getItem("verity_token");
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg || "Invalid value").join(". ")
      : body.detail;
    const error = new Error(typeof detail === "string" ? detail : "Something went wrong");
    error.status = response.status;
    throw error;
  }
  return body;
}

export const api = {
  register: (payload) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (email, password) => {
    const form = new URLSearchParams({ username: email, password });
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  },
  me: () => request("/auth/me"),
  documents: () => request("/documents"),
  organization: () => request("/organization/overview"),
  members: () => request("/organization/members"),
  activity: () => request("/organization/activity"),
  invitations: () => request("/organization/invitations"),
  invite: (payload) =>
    request("/organization/invitations", { method: "POST", body: JSON.stringify(payload) }),
  revokeInvitation: (id) => request(`/organization/invitations/${id}`, { method: "DELETE" }),
  updateOrganization: (name) =>
    request("/organization", { method: "PATCH", body: JSON.stringify({ name }) }),
  updateProfile: (full_name) =>
    request("/auth/me", { method: "PATCH", body: JSON.stringify({ full_name }) }),
  changePassword: (current_password, new_password) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  collections: () => request("/collections"),
  createCollection: (payload) =>
    request("/collections", { method: "POST", body: JSON.stringify(payload) }),
  updateCollection: (id, payload) =>
    request(`/collections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCollection: (id) => request(`/collections/${id}`, { method: "DELETE" }),
  addCollectionDocument: (collectionId, documentId) =>
    request(`/collections/${collectionId}/documents/${documentId}`, { method: "PUT" }),
  removeCollectionDocument: (collectionId, documentId) =>
    request(`/collections/${collectionId}/documents/${documentId}`, { method: "DELETE" }),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/documents", { method: "POST", body: form });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  ask: (query) =>
    request("/documents/ask/query", {
      method: "POST",
      body: JSON.stringify({ query, limit: 5 }),
    }),
  search: (query, limit = 8) =>
    request("/documents/search/query", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
};
