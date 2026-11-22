export function apiRoot(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured !== "string" || configured.trim() === "") {
    return configured === "" ? "" : "http://127.0.0.1:8000";
  }
  return configured.trim().replace("://localhost", "://127.0.0.1").replace(/\/$/, "");
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

function messageFrom(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "The library could not complete that request.";
}

async function request(path: string, token: string, method: string, body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiRoot()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("The library API did not respond. Start it on port 8000, then try again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(messageFrom(payload), response.status);
  }
  return response;
}

export async function apiPublic<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiRoot()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("The library API did not respond. Start it on port 8000, then try again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(messageFrom(payload), response.status);
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await request(path, token, "GET");
  return (await response.json()) as T;
}

export async function apiSend<T = void>(path: string, token: string, method: string, body?: unknown): Promise<T> {
  const response = await request(path, token, method, body);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiUpload<T>(path: string, token: string, form: FormData): Promise<T> {
  const response = await fetch(`${apiRoot()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(messageFrom(payload), response.status);
  }
  return (await response.json()) as T;
}

export async function apiFile(path: string, token: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${apiRoot()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError("The file could not be opened. Try again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(messageFrom(payload), response.status);
  }
  try {
    return await response.blob();
  } catch {
    throw new ApiError("The file could not be opened. Try again.");
  }
}
