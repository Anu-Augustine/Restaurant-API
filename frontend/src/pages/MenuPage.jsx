import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMenu, mediaUrl } from "../api";
import { useCart } from "../context/CartContext";
import { formatINR } from "../format";
import { Empty, ErrorNote, Loading } from "../components/Status";

function matchesShelf(item, shelf) {
  if (shelf === "meat") return !item.is_vegetarian && !item.is_vegan;
  if (shelf === "healthy") return Boolean(item.is_vegetarian || item.is_vegan);
  return true;
}

export function MenuPage() {
  const { addItem } = useCart();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedId, setAddedId] = useState(null);
  const rowRef = useRef(null);
  const addedTimer = useRef(null);
  const shelf = params.get("shelf") || "popular";
  const query = (params.get("q") || "").trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getMenu()
      .then((menu) => {
        if (!cancelled) setItems(menu);
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
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!matchesShelf(item, shelf)) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description || ""} ${item.category || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, shelf, query]);

  const featured = filtered[0] || items[0];
  const fans = (filtered.length > 4 ? filtered.slice(0, 4) : items.slice(0, 4));
  const sidePhotos = (filtered.length > 2 ? filtered.slice(1, 3) : items.slice(0, 2));
  const count = filtered.length;

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  function add(dish) {
    addItem(dish, 1);
    setAddedId(dish.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), 2500);
  }

  function scrollRow(direction) {
    const row = rowRef.current;
    if (!row) return;
    const card = row.querySelector(".dish-tile");
    const distance = card ? card.getBoundingClientRect().width + 16 : 300;
    row.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  function seeAll() {
    const next = new URLSearchParams(params);
    next.delete("shelf");
    next.delete("q");
    setParams(next);
    document.getElementById("dishes")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="home">
      <section className="hero">
        <h1>
          <span>{count || "—"} All-Time</span> Best Dinner
          <br />
          Dishes to Savor
        </h1>
        <p className="hero-copy">
          Explore {count} all-time best dinner dishes packed with flavor, perfect for
          family meals and special occasions.
        </p>
        <button type="button" className="pill" onClick={seeAll}>
          See Them All <span aria-hidden="true">→</span>
        </button>
        <img
          className="hero-photo"
          src={mediaUrl(featured?.image || "/public/images/plated.jpg")}
          alt={featured?.name || "Plated dinner"}
        />
      </section>

      {loading && <Loading>Loading the menu…</Loading>}
      <ErrorNote>{error}</ErrorNote>
      {!loading && !error && count === 0 && (
        <Empty>No dishes match this shelf. Try another category.</Empty>
      )}

      <section className="block" id="dishes">
        <div className="block-head">
          <h2>
            Crave-Worthy Dishes
            <br />
            You'll Love
          </h2>
          <p>
            Discover crave-worthy dishes you'll love—easy to order, full of flavor, and always satisfying.
          </p>
          <div className="arrow-pair">
            <button type="button" className="arrow" aria-label="Previous dishes" onClick={() => scrollRow(-1)}>
              ←
            </button>
            <button type="button" className="arrow orange" aria-label="Next dishes" onClick={() => scrollRow(1)}>
              →
            </button>
          </div>
        </div>
        <div className="dish-row" ref={rowRef}>
          {filtered.map((dish) => (
            <article key={dish.id} className="dish-tile">
              <img src={mediaUrl(dish.image)} alt="" />
              <div className="tile-bar">
                <div>
                  <strong>{dish.name}</strong>
                  <small>{formatINR(dish.price)}</small>
                  {addedId === dish.id && <span className="added-note" role="status">Added to cart</span>}
                </div>
                <button type="button" className="mini-go" aria-label={`Add ${dish.name}`} onClick={() => add(dish)}>
                  →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {featured && (
        <section className="feature">
          <div>
            <h2>{featured.name}</h2>
            <p>{featured.description || "A house favorite, ready when you are."}</p>
            <p className="feature-price">{formatINR(featured.price)}</p>
            <div className="feature-actions">
              <button type="button" className="pill" onClick={() => add(featured)}>
                Add to cart <span aria-hidden="true">→</span>
              </button>
              {addedId === featured.id && <span className="added-note" role="status">Added to cart</span>}
            </div>
          </div>
          <div className="feature-stack">
            {(sidePhotos.length ? sidePhotos : [featured]).map((dish) => (
              <img key={dish.id} src={mediaUrl(dish.image)} alt={dish.name} />
            ))}
          </div>
        </section>
      )}

      {fans.length > 0 && (
        <section className="block">
          <h2 className="center-title">Fan Favorites</h2>
          <div className="fan-grid">
            {fans.map((dish) => (
              <article key={dish.id} className="fan-card">
                <img src={mediaUrl(dish.image)} alt="" />
                <div className="tile-bar">
                  <div>
                    <strong>{dish.name}</strong>
                    <small>{formatINR(dish.price)}</small>
                    {addedId === dish.id && <span className="added-note" role="status">Added to cart</span>}
                  </div>
                  <button type="button" className="mini-go" aria-label={`Add ${dish.name}`} onClick={() => add(dish)}>
                    →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="again">
        <div>
          <h2>
            Dinner Favorites You'll Crave
            <br />
            Again and Again
          </h2>
          <p>
            Discover {count} delicious dinner dishes that are easy to order, full of flavor, and kitchen-approved.
          </p>
          <button type="button" className="pill" onClick={seeAll}>
            View Dishes Now <span aria-hidden="true">→</span>
          </button>
        </div>
        <img src={mediaUrl("/public/images/bowls.jpg")} alt="Dinner bowls" />
      </section>
    </div>
  );
}
