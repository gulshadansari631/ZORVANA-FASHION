
(function () {
  let backStack = [];
  let restoring = false;

  function currentView() {
    const body = document.body;
    const title = document.getElementById("sectionTitle")?.textContent || "";

    if (body.classList.contains("zv-detail-view")) return "orderDetails";
    if (body.classList.contains("zv-orders-view") ||
        body.classList.contains("orders-view")) return "orders";
    if (body.classList.contains("zv-account-view")) return "account";
    if (document.getElementById("productModal")?.classList.contains("show")) return "product";
    if (document.getElementById("checkoutPanel")?.classList.contains("show")) return "checkout";
    if (title.includes("Wishlist")) return "wishlist";
    if (title.includes("Cart")) return "cart";
    if (title.includes("Search")) return "search";
    if (title.includes("Collection")) return "categories";
    if (document.querySelector('[data-nav="account"].active')) return "account";
    if (document.querySelector('[data-nav="orders"].active')) return "orders";
    if (document.querySelector('[data-nav="wishlist"].active')) return "wishlist";
    if (document.querySelector('[data-nav="categories"].active')) return "categories";

    return "home";
  }

  function savePage() {
    if (restoring) return;

    backStack.push({
      view: currentView(),
      scroll: window.scrollY,
      title: document.getElementById("sectionTitle")?.textContent || "",
      query: document.getElementById("searchInput")?.value || "",
      productId: window.currentProduct?.id || null
    });

    history.pushState({ zorvana: true }, "", location.href);
  }

  function restorePage(item) {
    if (!item) {
      window.goHome?.();
      return;
    }

    restoring = true;

    switch (item.view) {
      case "orders":
        window.openOrders?.();
        break;

      case "account":
        window.openProfile?.();
        break;

      case "wishlist":
        window.showWishlist?.();
        break;

      case "cart":
        window.showCart?.();
        break;

      case "categories":
        window.goCategories?.();
        break;

      case "search":
        document.getElementById("searchInput").value = item.query;
        window.searchProducts?.();
        break;

      case "product":
        if (item.productId != null) {
          window.openProduct?.(item.productId, false);
        }
        break;

      case "checkout":
        document.getElementById("checkoutPanel")?.classList.add("show");
        break;

      case "orderDetails":
        window.openOrders?.();
        break;

      default:
        window.goHome?.();
    }

    setTimeout(() => {
      window.scrollTo({
        top: item.scroll || 0,
        behavior: "auto"
      });
      restoring = false;
    }, 350);
  }

  function wrapFunction(name) {
    const original = window[name];
    if (typeof original !== "function") return;

    window[name] = function (...args) {
      savePage();
      return original.apply(this, args);
    };
  }

  [
    "goHome",
    "goCategories",
    "showWishlist",
    "showCart",
    "openOrders",
    "openProfile",
    "filterCategory",
    "selectCategory",
    "searchProducts",
    "showAllProducts",
    "openProduct"
  ].forEach(wrapFunction);

  document.addEventListener("click", function (event) {
    const back = event.target.closest("#zvBack");

    if (back) {
      event.preventDefault();
      event.stopImmediatePropagation();
      history.back();
      return;
    }

    if (
      event.target.closest("[data-action]") ||
      event.target.closest("[data-detail]")
    ) {
      savePage();
    }
  }, true);

  window.addEventListener("popstate", function () {
    const previous = backStack.pop();
    restorePage(previous);
  });

})();
