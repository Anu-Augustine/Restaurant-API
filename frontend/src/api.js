export const API = "http://127.0.0.1:8000";

export function mediaUrl(path) {
  if (!path) return `${API}/public/images/plated.jpg`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
}

function detailMessage(data) {
  if (!data) return "";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item?.msg || item?.message || "")
      .filter(Boolean)
      .join(" ");
  }
  if (typeof data.message === "string") return data.message;
  return "";
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (!token) {
      window.dispatchEvent(new Event("auth:unauthorized"));
      throw new ApiError("Please log in.", 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the restaurant API. Start it on http://127.0.0.1:8000.",
      0
    );
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
    throw new ApiError(detailMessage(data) || "Please log in again.", 401);
  }

  if (!response.ok) {
    const message = detailMessage(data);
    const friendly =
      message && !message.trim().startsWith("<")
        ? message
        : "Something went wrong. Please try again.";
    throw new ApiError(friendly, response.status);
  }

  return data;
}

export function registerUser(payload) {
  return request("/register", { method: "POST", body: payload });
}

export async function login(email, password) {
  const data = await request("/login", {
    method: "POST",
    body: { email, password },
  });
  if (!data?.access_token) {
    throw new ApiError(data?.message || "Invalid email or password", 200);
  }
  localStorage.setItem("token", data.access_token);
  return data;
}

export function getProfile() {
  return request("/profile", { auth: true });
}

export async function getMenu() {
  const data = await request("/menu");
  return Array.isArray(data) ? data : [];
}

export function createMenuItem(payload) {
  return request("/menu", { method: "POST", auth: true, body: payload });
}

export function updateMenuItem(itemId, payload) {
  return request(`/menu/${itemId}`, { method: "PUT", auth: true, body: payload });
}

export function deleteMenuItem(itemId) {
  return request(`/menu/${itemId}`, { method: "DELETE", auth: true });
}

export function placeOrder(items) {
  return request("/orders", { method: "POST", auth: true, body: { items } });
}

export async function getMyOrders() {
  const data = await request("/orders/my-orders", { auth: true });
  return Array.isArray(data) ? data : [];
}

export function getOrder(orderId) {
  return request(`/orders/${orderId}`, { auth: true });
}

export function cancelOrder(orderId) {
  return request(`/orders/${orderId}/cancel`, { method: "PATCH", auth: true });
}

export async function getAdminOrders() {
  const data = await request("/admin/orders", { auth: true });
  return Array.isArray(data) ? data : [];
}

export function updateOrderStatus(orderId, status) {
  return request(`/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: { status },
  });
}

export function sendChat(question, sessionId) {
  const body = sessionId ? { question, session_id: sessionId } : { question };
  return request("/chat", {
    method: "POST",
    auth: Boolean(getToken()),
    body,
  });
}

export async function getChatHistory(sessionId) {
  const params = new URLSearchParams({ session_id: sessionId });
  const data = await request(`/chat/history?${params.toString()}`, { auth: true });
  return Array.isArray(data) ? data : [];
}

export function confirmChat(payload) {
  return request("/chat/confirm", {
    method: "POST",
    auth: true,
    body: { confirmed: true, ...payload },
  });
}

function itemsFromPythonList(answer) {
  const blob = answer.match(/these items:\s*(\[[\s\S]*?\])/);
  if (!blob) return [];
  try {
    const parsed = JSON.parse(blob[1].replace(/'/g, '"'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.menu_item_id && item.quantity)
      .map((item) => ({
        menu_item_id: Number(item.menu_item_id),
        quantity: Number(item.quantity),
      }));
  } catch {
    return [];
  }
}

function itemsFromPreviewLines(answer, menuItems) {
  if (!menuItems?.length) return [];
  const items = [];
  const lineRe = /^-\s+(.+?)\s+[×x]\s+(\d+)\s*:/gm;
  let match = lineRe.exec(answer);
  while (match) {
    const name = match[1].trim().toLowerCase();
    const found = menuItems.find((item) => item.name?.trim().toLowerCase() === name);
    if (found) {
      items.push({ menu_item_id: found.id, quantity: Number(match[2]) });
    }
    match = lineRe.exec(answer);
  }
  return items;
}

export function parseConfirmation(answer, menuItems = []) {
  if (!answer || typeof answer !== "string") return null;
  const wantsPlace = /place_order/i.test(answer) || /nothing has been placed yet/i.test(answer);
  const wantsCancel = /cancel_order/i.test(answer);

  if (wantsPlace) {
    const fromList = itemsFromPythonList(answer);
    const items = fromList.length ? fromList : itemsFromPreviewLines(answer, menuItems);
    if (items.length) return { action: "place_order", items };
  }

  if (wantsCancel) {
    const idMatch = answer.match(/order_id\s*[=:]\s*(\d+)/i);
    if (idMatch) return { action: "cancel_order", order_id: Number(idMatch[1]) };
  }

  return null;
}
