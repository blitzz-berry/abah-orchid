import api from "@/lib/api";

const PLACEHOLDER_HOSTS = new Set(["orchidmart.example.com"]);
const API_PREFIX = "/api/v1";

export function resolveUploadURL(url: string) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      if (PLACEHOLDER_HOSTS.has(parsed.hostname) && typeof window !== "undefined") {
        return `${window.location.origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  return url.startsWith("/") ? url : `/${url}`;
}

export async function createAuthorizedUploadObjectURL(url: string) {
  const endpoint = protectedAPIEndpoint(url);
  if (!endpoint) return resolveUploadURL(url);

  const response = await api.get(endpoint, { responseType: "blob" });
  return URL.createObjectURL(response.data);
}

export async function openUploadURL(url: string) {
  const objectURL = await createAuthorizedUploadObjectURL(url);
  window.open(objectURL, "_blank", "noopener,noreferrer");
  if (objectURL.startsWith("blob:")) {
    window.setTimeout(() => URL.revokeObjectURL(objectURL), 60_000);
  }
}

function protectedAPIEndpoint(url: string) {
  const resolved = resolveUploadURL(url);
  if (resolved.startsWith(`${API_PREFIX}/`)) {
    return resolved.slice(API_PREFIX.length);
  }

  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    try {
      const parsed = new URL(resolved);
      if (parsed.pathname.startsWith(`${API_PREFIX}/`)) {
        return `${parsed.pathname.slice(API_PREFIX.length)}${parsed.search}`;
      }
    } catch {
      return null;
    }
  }

  return null;
}
