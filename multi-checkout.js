
(function () {
  const form = document.getElementById("orderForm");
  if (!form) return;

  let multiCheckoutActive = false;

  function getCartItems() {
    return cart.map(item => {
      const product = allProducts.find(
        p => String(p.id) === String(item.id)
      );

      if (!product) return null;

      const qty = Math.max(1, Number(item.qty) || 1);
      const unitPrice = Number(product.selling_price) || 0;

      return {
        product: product.name + (qty > 1 ? " (Qty: " + qty + ")" : ""),
        size: item.size || "Not applicable",
        image: productImage(product),
        price: "₹" + (unitPrice * qty).toFixed(2)
      };
    }).filter(Boolean);
  }

  window.checkoutCart = function () {
    if (!cart.length) {
      alert("Cart is empty.");
      return;
    }

    const items = getCartItems();

    if (!items.length) {
      alert("Cart products could not be found. Please refresh the page.");
      return;
    }

    if (items.length > 30) {
      alert("Maximum 30 different cart items allowed.");
      return;
    }

    multiCheckoutActive = true;

    let hidden = form.querySelector('[name="items"]');

    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "items";
      form.appendChild(hidden);
    }

    hidden.value = JSON.stringify(items);

    document.getElementById("checkoutProduct").value =
      items.length + " products in this order";

    document.getElementById("checkoutSize").value =
      "Multiple sizes";

    document.getElementById("checkoutPanel").classList.add("show");
  };

  form.addEventListener("submit", function () {
    if (!multiCheckoutActive) return;

    const items = getCartItems();
    const hidden = form.querySelector('[name="items"]');

    if (hidden) {
      hidden.value = JSON.stringify(items);
    }
  }, true);

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    const requestUrl = String(
      typeof args[0] === "string" ? args[0] : args[0]?.url || ""
    );

    const options = args[1] || {};
    const method = String(options.method || "GET").toUpperCase();

    if (
      multiCheckoutActive &&
      requestUrl.includes("/api/orders") &&
      method === "POST" &&
      response.ok
    ) {
      try {
        const result = await response.clone().json();

        if (result.success) {
          cart = [];
          localStorage.setItem("zorvana_cart", "[]");

          const count = document.getElementById("cartCount");
          if (count) count.textContent = "0";

          multiCheckoutActive = false;
        }
      } catch (error) {
        console.error("Cart cleanup error:", error);
      }
    }

    return response;
  };
})();
