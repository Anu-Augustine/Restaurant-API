function findImage(node) {
  if (!node) return null;
  if (node.tagName === "IMG") return node;
  const image = node.querySelector?.("img");
  if (image) return image;
  return findImage(node.parentElement);
}

function popCart(cart) {
  cart.classList.remove("cart-pop");
  void cart.offsetWidth;
  cart.classList.add("cart-pop");
}

export function flyToCart(origin) {
  const image = findImage(origin);
  const cart = document.querySelector("[data-cart-target]");
  if (!image || !cart) return;

  const start = image.getBoundingClientRect();
  const end = cart.getBoundingClientRect();
  if (start.width < 8 || start.height < 8) {
    popCart(cart);
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    popCart(cart);
    return;
  }

  const flyer = document.createElement("img");
  flyer.src = image.currentSrc || image.src;
  flyer.alt = "";
  flyer.className = "cart-flyer";
  flyer.style.left = `${start.left}px`;
  flyer.style.top = `${start.top}px`;
  flyer.style.width = `${start.width}px`;
  flyer.style.height = `${start.height}px`;
  document.body.appendChild(flyer);

  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);
  const endScale = Math.min(0.2, 34 / start.width);

  const animation = flyer.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate3d(${dx * 0.62}px, ${dy * 0.35 - 28}px, 0) scale(${Math.max(endScale, 0.42)})`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(${endScale})`,
        opacity: 0.35,
      },
    ],
    { duration: 720, easing: "cubic-bezier(0.22, 0.75, 0.2, 1)", fill: "forwards" }
  );

  const finish = () => flyer.remove();
  animation.onfinish = () => {
    finish();
    popCart(cart);
  };
  animation.oncancel = finish;
}
