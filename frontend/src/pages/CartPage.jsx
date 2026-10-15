import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { mediaUrl, placeOrder } from "../api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatINR } from "../format";
import { Empty, ErrorNote } from "../components/Status";

export function CartPage() {
  const { items, total, setQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await placeOrder(
        items.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        }))
      );
      clearCart();
      navigate(`/orders/${order.order_id}`);
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="page-intro">
        <h1>Your cart</h1>
        <p>The kitchen calculates the final total when the order is placed.</p>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {items.length === 0 ? (
        <Empty>
          Your cart is empty. <Link to="/">Browse the menu</Link> to add a dish.
        </Empty>
      ) : (
        <div className="stack">
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.menu_item_id}>
                <img className="cart-thumb" src={mediaUrl(item.image)} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">{formatINR(item.price)} each</p>
                </div>
                <label className="field inline">
                  Qty
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.menu_item_id, event.target.value)}
                  />
                </label>
                <p className="price">{formatINR(item.price * item.quantity)}</p>
                <button type="button" className="button ghost" onClick={() => removeItem(item.menu_item_id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="total-row">
            <span>Estimated total</span>
            <strong>{formatINR(total)}</strong>
          </div>
          <button type="button" className="button" disabled={submitting} onClick={checkout}>
            {submitting ? "Placing order…" : user ? "Place order" : "Log in to check out"}
          </button>
        </div>
      )}
    </section>
  );
}
