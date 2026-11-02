// Queues until pixel.js replaces window.flow. The pixel replays window.flow.q
// as [method, ...args], then later calls go straight to flow.track.

function callFlow(method, args) {
  if (typeof window === "undefined") return;
  const flow = window.flow;
  if (flow && typeof flow[method] === "function") {
    flow[method](...args);
    return;
  }
  const call = [method, ...args];
  if (flow && Array.isArray(flow.q)) {
    flow.q.push(call);
    return;
  }
  window.flow = { q: [call] };
}

function defined(props) {
  const traits = {};
  if (!props) return traits;
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) traits[key] = value;
  }
  return traits;
}

export function trackFlow(name, props) {
  try {
    if (typeof name !== "string" || !name) return;
    callFlow("track", [name, defined(props)]);
  } catch {
    // Analytics must never block ordering.
  }
}

function phoneForFlow(value) {
  if (!value) return undefined;
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

export function setFlowUser(user) {
  try {
    if (typeof window === "undefined" || !user) return;
    const identity = {};
    const phone = phoneForFlow(user.phone ?? user.phone_number);
    const name = user.name ?? user.full_name;
    const email = user.email;
    if (phone) identity.phone = phone;
    if (name) identity.name = String(name);
    if (email) identity.email = String(email);
    if (!identity.phone && !identity.email) return;
    window.flowUser = identity;
  } catch {
    // Identity must never block login.
  }
}

export function resetFlow() {
  try {
    if (typeof window === "undefined") return;
    window.flowUser = null;
    callFlow("reset", []);
  } catch {
    // Logout should still complete.
  }
}

export function trackAddToCart(dish, quantity) {
  const qty = Math.max(1, Number(quantity) || 1);
  trackFlow("add_to_cart", {
    product_id: String(dish.id ?? dish.menu_item_id),
    name: dish.name,
    price: Number(dish.price),
    image: dish.image || undefined,
    quantity: qty,
  });
}

export function trackRemoveFromCart(name) {
  if (!name) return;
  trackFlow("remove_from_cart", { name: String(name) });
}

export function trackBeginCheckout(lineItems, total) {
  const count = (lineItems || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  const revenue = Number(total);
  const amount = Number.isFinite(revenue) ? revenue : 0;
  trackFlow("begin_checkout", {
    cart_value: amount,
    revenue: amount,
    currency: "INR",
    items: count,
  });
}

export function trackOrderPlaced({ name, orderId, status, total, lineItems }) {
  const items = (lineItems || []).map((item) => ({
    product_id: String(item.product_id ?? item.menu_item_id),
    name: String(item.name || "Item"),
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
  }));
  const revenue = Number(total);
  const id = Number(orderId);
  trackFlow("order_place", {
    name: name ? String(name) : "",
    items: items.map((item) => `${item.name} x ${item.quantity}`).join(", "),
    total: Number.isFinite(revenue) ? revenue : 0,
    order_id: Number.isFinite(id) ? id : undefined,
    order_status: status ? String(status) : "",
  });
  trackFlow("purchase", {
    order_id: Number.isFinite(id) ? String(id) : undefined,
    revenue: Number.isFinite(revenue) ? revenue : 0,
    currency: "INR",
    items,
  });
}
