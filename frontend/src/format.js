export const SPICE_LABELS = ["Not specified", "Mild", "Medium", "Hot"];

export function formatINR(value) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₹${safe.toFixed(2)}`;
}

export function spiceLabel(level) {
  const index = Number(level);
  return SPICE_LABELS[index] ?? "Not specified";
}

export function orderIdOf(order) {
  return order?.order_id ?? order?.id;
}

export const ORDER_POLL_MS = 5000;

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready for delivery pickup", label: "Ready for delivery pickup" },
  { value: "out for delivery", label: "Out for delivery" },
  { value: "ready for customer pickup", label: "Ready for customer pickup" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABELS = Object.fromEntries(
  ORDER_STATUSES.map((status) => [status.value, status.label])
);

export function statusLabel(status) {
  if (!status) return "";
  return STATUS_LABELS[status] ?? status;
}

export function statusClass(status) {
  const token = String(status || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `status-${token || "unknown"}`;
}
