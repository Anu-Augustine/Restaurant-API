import { useEffect, useState } from "react";
import {
  createMenuItem,
  mediaUrl,
  deleteMenuItem,
  getAdminOrders,
  getMenu,
  updateMenuItem,
  updateOrderStatus,
} from "../api";
import { SPICE_LABELS, formatINR, orderIdOf, spiceLabel } from "../format";
import { Empty, ErrorNote, Loading } from "../components/Status";

const STATUSES = ["pending", "preparing", "delivered", "cancelled"];

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "",
  is_vegetarian: false,
  is_vegan: false,
  spice_level: "0",
  ingredients: "",
  allergens: "",
  image: "",
  is_available: true,
};

function blankToNull(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function AdminPage() {
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [dishes, rows] = await Promise.all([getMenu(), getAdminOrders()]);
      setMenu(dishes);
      setOrders(rows);
      setStatusDrafts(
        Object.fromEntries(rows.map((order) => [orderIdOf(order), order.status]))
      );
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setNotice("");
    setForm({
      name: item.name || "",
      description: item.description || "",
      price: item.price ?? "",
      category: item.category || "",
      is_vegetarian: Boolean(item.is_vegetarian),
      is_vegan: Boolean(item.is_vegan),
      spice_level: String(item.spice_level ?? 0),
      ingredients: item.ingredients || "",
      allergens: item.allergens || "",
      image: item.image || "",
      is_available: item.is_available !== false,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function payloadFromForm() {
    return {
      name: form.name.trim(),
      description: blankToNull(form.description),
      price: Number(form.price),
      category: form.category.trim(),
      is_vegetarian: form.is_vegetarian,
      is_vegan: form.is_vegan,
      spice_level: Number(form.spice_level),
      ingredients: blankToNull(form.ingredients),
      allergens: blankToNull(form.allergens),
      image: blankToNull(form.image),
    };
  }

  async function onSubmit(event) {
    event.preventDefault();
    const payload = payloadFromForm();
    if (!payload.name || !payload.category) {
      setError("Name and category are required.");
      return;
    }
    if (!Number.isFinite(payload.price) || payload.price < 0) {
      setError("Enter a price of zero or more.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId) {
        await updateMenuItem(editingId, { ...payload, is_available: form.is_available });
        setNotice(
          form.is_available
            ? "Dish updated."
            : "Dish updated. Unavailable dishes disappear from this list after a refresh."
        );
      } else {
        await createMenuItem(payload);
        setNotice("Dish added.");
      }
      resetForm();
      const dishes = await getMenu();
      setMenu(dishes);
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item) {
    if (!window.confirm(`Remove ${item.name} from the menu?`)) return;
    setError("");
    setNotice("");
    try {
      await deleteMenuItem(item.id);
      if (editingId === item.id) resetForm();
      setMenu(await getMenu());
      setNotice("Dish deleted.");
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    }
  }

  async function onStatus(order) {
    const id = orderIdOf(order);
    const status = statusDrafts[id];
    setUpdatingId(id);
    setError("");
    setNotice("");
    try {
      const result = await updateOrderStatus(id, status);
      setOrders((current) =>
        current.map((row) =>
          orderIdOf(row) === result.order_id ? { ...row, status: result.status } : row
        )
      );
      setNotice(`Order #${result.order_id} is now ${result.status}.`);
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const sortedOrders = [...orders].sort((a, b) => Number(orderIdOf(b)) - Number(orderIdOf(a)));

  return (
    <section>
      <div className="page-intro">
        <h1>Kitchen admin</h1>
        <p>Add and edit available dishes, then move orders through the kitchen.</p>
      </div>
      {loading && <Loading>Loading the kitchen board…</Loading>}
      <ErrorNote>{error}</ErrorNote>
      {notice && <p className="banner success">{notice}</p>}

      {!loading && (
        <div className="admin-layout">
          <form className="form-card" onSubmit={onSubmit}>
            <h2>{editingId ? `Edit dish #${editingId}` : "Add a dish"}</h2>
            <label className="field">
              Name
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>
            <label className="field">
              Description
              <textarea
                rows="2"
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>
            <div className="split">
              <label className="field">
                Price (₹)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                />
              </label>
              <label className="field">
                Category
                <input
                  required
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Spice
              <select
                value={form.spice_level}
                onChange={(event) => updateField("spice_level", event.target.value)}
              >
                {SPICE_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Ingredients
              <input
                value={form.ingredients}
                onChange={(event) => updateField("ingredients", event.target.value)}
              />
            </label>
            <label className="field">
              Allergens
              <input
                value={form.allergens}
                onChange={(event) => updateField("allergens", event.target.value)}
              />
            </label>
            <label className="field">
              Image path
              <input
                placeholder="/public/images/biryani.jpg"
                value={form.image}
                onChange={(event) => updateField("image", event.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.is_vegetarian}
                onChange={(event) => updateField("is_vegetarian", event.target.checked)}
              />
              Vegetarian
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.is_vegan}
                onChange={(event) => updateField("is_vegan", event.target.checked)}
              />
              Vegan
            </label>
            {editingId && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.is_available}
                  onChange={(event) => updateField("is_available", event.target.checked)}
                />
                Available
              </label>
            )}
            <div className="button-row">
              <button type="submit" className="button" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Add dish"}
              </button>
              {editingId && (
                <button type="button" className="button ghost" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div>
            <h2>Available dishes</h2>
            {menu.length === 0 ? (
              <Empty>No available dishes yet.</Empty>
            ) : (
              <ul className="admin-menu">
                {menu.map((item) => (
                  <li key={item.id}>
                    <img className="admin-thumb" src={mediaUrl(item.image)} alt="" />
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">
                        {item.category || "Other"} · {formatINR(item.price)} · {spiceLabel(item.spice_level)}
                      </p>
                    </div>
                    <div className="button-row">
                      <button type="button" className="button ghost" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="button danger" onClick={() => onDelete(item)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <section className="orders-board">
          <h2>All orders</h2>
          {sortedOrders.length === 0 ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
                    const id = orderIdOf(order);
                    return (
                      <tr key={id}>
                        <td>#{id}</td>
                        <td>{order.user_id}</td>
                        <td>{formatINR(order.total_amount)}</td>
                        <td>
                          <select
                            aria-label={`Status for order ${id}`}
                            value={statusDrafts[id] || order.status}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [id]: event.target.value,
                              }))
                            }
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button"
                            disabled={updatingId === id}
                            onClick={() => onStatus(order)}
                          >
                            {updatingId === id ? "Updating…" : "Update"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
