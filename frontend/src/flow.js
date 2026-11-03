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

// The orders API stores this exact string. The screen label is "Out for delivery".
const OUT_FOR_DELIVERY_STATUS = "out for delivery";

function isOutForDelivery(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return normalized === OUT_FOR_DELIVERY_STATUS;
}

function copyIdentity(source) {
  if (!source || typeof source !== "object") return null;
  const identity = {};
  if (source.phone) identity.phone = String(source.phone);
  if (source.name) identity.name = String(source.name);
  if (source.email) identity.email = String(source.email);
  if (!identity.phone && !identity.email && !identity.name) return null;
  return identity;
}

function customerIdentity(user) {
  if (!user || typeof user !== "object") return null;
  return copyIdentity({
    phone: phoneForFlow(user.phone ?? user.phone_number),
    name: user.name ?? user.full_name,
    email: user.email,
  });
}

// The pixel applies window.flowUser on a timer, and it flushes the queue about
// two seconds after track. Restoring the admin in the same turn puts that
// identify in the same batch and the campaign never stays on the customer.
const RESTORE_IDENTITY_MS = 2500;
let restoreSerial = 0;

function restoreFlowUserLater(previous) {
  const serial = ++restoreSerial;
  setTimeout(() => {
    if (serial !== restoreSerial) return;
    try {
      window.flowUser = previous;
      if (previous) callFlow("identify", [previous]);
    } catch {
      // The customer event has already been queued.
    }
  }, RESTORE_IDENTITY_MS);
}

// Identify as the customer, then track. The admin profile is put back only
// after the pixel has had time to flush this event under the customer.
export function trackForCustomer(identity, eventName, props) {
  if (typeof window === "undefined") return;
  if (typeof eventName !== "string" || !eventName) return;

  const previous = copyIdentity(window.flowUser);
  const customer = customerIdentity(identity);
  const switched = Boolean(customer?.phone);

  try {
    if (switched) {
      window.flowUser = customer;
      callFlow("identify", [customer]);
    }
    const traits = props && typeof props === "object" ? { ...props } : {};
    if (customer?.phone && traits.phone == null) traits.phone = customer.phone;
    trackFlow(eventName, traits);
  } catch {
    // Analytics must never block the admin save.
  }

  if (switched) restoreFlowUserLater(previous);
}

function lineItemsText(order) {
  const rows = Array.isArray(order?.items) ? order.items : [];
  if (!rows.length) return "";
  return rows
    .map((item) => `${String(item?.name || "Item")} x ${Number(item?.quantity) || 1}`)
    .join(", ");
}

function deliveryPartnerText(order) {
  if (!order || typeof order !== "object") return "";
  // The Flow property is spelled delvery_partner. Read a real order field if
  // one is present; otherwise send an empty string.
  const keys = ["delvery_partner", "delivery_partner", "deliveryPartner"];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(order, key) && order[key] != null) {
      return String(order[key]);
    }
  }
  return "";
}

function orderContact(order) {
  const nested = order?.customer && typeof order.customer === "object" ? order.customer : order?.user;
  const source = nested && typeof nested === "object" ? nested : {};
  return {
    phone: order?.phone ?? order?.phone_number ?? source.phone ?? source.phone_number,
    name: order?.name ?? order?.full_name ?? source.name ?? source.full_name,
    email: order?.email ?? source.email,
  };
}

export function trackOutForDeliveryForCustomer(order) {
  try {
    if (!order || !isOutForDelivery(order.status)) return;
    const id = Number(order.order_id ?? order.id);
    if (!Number.isFinite(id)) return;
    const contact = orderContact(order);
    const phone = phoneForFlow(contact.phone);
    if (!phone) return;
    const revenue = Number(order.total_amount ?? order.total);
    trackForCustomer(
      {
        phone: contact.phone,
        name: contact.name,
        email: contact.email,
      },
      "out_for_delivery",
      {
        phone,
        name: contact.name ? String(contact.name) : "",
        order_id: id,
        items: lineItemsText(order),
        total: Number.isFinite(revenue) ? revenue : 0,
        delvery_partner: deliveryPartnerText(order),
      }
    );
  } catch {
    // Analytics must never block the admin save.
  }
}
