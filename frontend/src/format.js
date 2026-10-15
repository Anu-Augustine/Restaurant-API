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
