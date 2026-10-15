import { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addItem(dish, quantity) {
    const qty = Math.max(1, Number(quantity) || 1);
    setItems((current) => {
      const existing = current.find((item) => item.menu_item_id === dish.id);
      if (!existing) {
        return [
          ...current,
          {
            menu_item_id: dish.id,
            name: dish.name,
            price: Number(dish.price),
            image: dish.image || "",
            quantity: qty,
          },
        ];
      }
      return current.map((item) =>
        item.menu_item_id === dish.id
          ? { ...item, quantity: item.quantity + qty }
          : item
      );
    });
  }

  function setQuantity(menuItemId, quantity) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) return;
    setItems((current) =>
      current.map((item) =>
        item.menu_item_id === menuItemId ? { ...item, quantity: qty } : item
      )
    );
  }

  function removeItem(menuItemId) {
    setItems((current) => current.filter((item) => item.menu_item_id !== menuItemId));
  }

  function clearCart() {
    setItems([]);
  }

  const count = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, count, total, addItem, setQuantity, removeItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
