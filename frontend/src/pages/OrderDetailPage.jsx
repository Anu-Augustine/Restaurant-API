import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelOrder, getOrder } from "../api";
import { formatINR } from "../format";
import { ErrorNote, Loading } from "../components/Status";

export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getOrder(id)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err) => {
        if (!cancelled && err.status !== 401) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onCancel() {
    setCancelling(true);
    setError("");
    setNotice("");
    try {
      await cancelOrder(id);
      const fresh = await getOrder(id);
      setOrder(fresh);
      setNotice("Order cancelled.");
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section>
      <p className="back-link">
        <Link to="/orders">Back to your orders</Link>
      </p>
      {loading && <Loading>Loading this order…</Loading>}
      <ErrorNote>{error}</ErrorNote>
      {notice && <p className="banner success">{notice}</p>}
      {order && (
        <>
          <div className="page-intro">
            <h1>Order #{order.order_id}</h1>
            <p>
              <span className={`status-pill status-${order.status}`}>{order.status}</span>
            </p>
          </div>
          <ul className="line-items">
            {(order.items || []).map((item, index) => (
              <li key={`${item.menu_item_id}-${index}`}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatINR(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="total-row">
            <span>Total</span>
            <strong>{formatINR(order.total_amount)}</strong>
          </div>
          {order.status === "pending" && (
            <button type="button" className="button danger" disabled={cancelling} onClick={onCancel}>
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
