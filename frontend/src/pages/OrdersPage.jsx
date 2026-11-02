import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../api";
import { ORDER_POLL_MS, formatINR, orderIdOf, statusClass, statusLabel } from "../format";
import { Empty, ErrorNote, Loading } from "../components/Status";

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loaded = false;

    async function load() {
      try {
        const rows = await getMyOrders();
        if (cancelled) return;
        loaded = true;
        setOrders(rows);
        setError("");
      } catch (err) {
        if (!cancelled && err.status !== 401 && !loaded) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, ORDER_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const sorted = [...orders].sort((a, b) => Number(orderIdOf(b)) - Number(orderIdOf(a)));

  return (
    <section>
      <div className="page-intro">
        <h1>Your orders</h1>
        <p>Open an order to see the dishes and cancel it while it is still pending.</p>
      </div>
      {loading && <Loading>Loading your orders…</Loading>}
      <ErrorNote>{error}</ErrorNote>
      {!loading && !error && sorted.length === 0 && (
        <Empty>You have no orders yet.</Empty>
      )}
      {sorted.length > 0 && (
        <ul className="order-list">
          {sorted.map((order) => {
            const id = orderIdOf(order);
            return (
              <li key={id}>
                <Link to={`/orders/${id}`}>
                  <strong>Order #{id}</strong>
                  <span className={`status-pill ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                  <span className="price">{formatINR(order.total_amount)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
