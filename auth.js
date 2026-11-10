
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6ljZWr8cDxEtPuziF7DhxQYiykFRocOc",
  authDomain: "zorvana-fashion-new.firebaseapp.com",
  projectId: "zorvana-fashion-new",
  storageBucket: "zorvana-fashion-new.firebasestorage.app",
  messagingSenderId: "328407308597",
  appId: "1:328407308597:web:3a36dbb2e6c80e971ad47c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let savedAddresses = [];

const authUI = document.createElement("div");
authUI.id = "zorvanaAuth";
authUI.innerHTML = `
  <div id="authStatus">Checking account...</div>
  <button id="loginOpen">LOGIN / SIGN UP</button>
  <button id="profileBtn" style="display:none">MY PROFILE</button>
  <button id="myOrdersBtn">MY ORDERS</button>
  <button id="logoutBtn" style="display:none">LOGOUT</button>
`;

const header = document.querySelector("header");
if (header) header.after(authUI);

const style = document.createElement("style");
style.textContent = `
#zorvanaAuth{display:none!important}
#zorvanaAuth button{padding:10px 15px;margin:5px;border:0;border-radius:5px;background:#2874f0;color:white;font-weight:bold}
#authModal,#profileModal{display:none;position:fixed;inset:0;background:#000b;z-index:20000;padding:20px;overflow:auto}
.authBox,.profileBox{background:white;color:#222;max-width:400px;margin:40px auto;padding:20px;border-radius:12px}
.authBox button,.profileBox button{width:100%;padding:12px;margin:6px 0;border:0;border-radius:5px;background:#2874f0;color:white}
#profilePhoto{width:90px;height:90px;border-radius:50%;object-fit:cover}
#myOrders{padding:15px;background:white;margin:15px auto;border-radius:12px;max-width:900px;color:#222;min-height:60vh}
body.orders-view .hero,body.orders-view .quick-cats,body.orders-view #shop,body.orders-view .offer-banner,body.orders-view .service-strip,body.orders-view footer{display:none!important}
body.orders-view #myOrders{display:block!important}
body.orders-view{background:#f6f6f6}
.customerOrder{background:white;border:1px solid #ddd;border-radius:12px;padding:15px;margin:15px 0;color:#222}
.customerOrder img{width:100px;height:100px;object-fit:contain}
.orderProduct{display:flex;gap:15px;align-items:center;margin:15px 0}
.trackLine{display:flex;justify-content:space-between;gap:5px;margin:20px 0}
.trackStep{flex:1;text-align:center;font-size:11px;color:#888}
.trackDot{width:18px;height:18px;border-radius:50%;border:2px solid #aaa;margin:0 auto 7px;background:white}
.trackStep.done .trackDot{background:#16853c;border-color:#16853c}
.trackStep.done{color:#16853c;font-weight:bold}
.trackHistory{background:#f5f6f8;padding:12px;border-radius:8px;margin-top:12px}
#savedAddresses input,#savedAddresses textarea,#checkoutAddressPanel input,#checkoutAddressPanel textarea{width:100%;box-sizing:border-box;padding:11px;margin:6px 0;border:1px solid #ccc;border-radius:6px}
#checkoutAddressPanel{background:#f5f6f8;padding:14px;margin:12px 0;border-radius:12px;text-align:left}
.addressCard{background:white;border:1px solid #ddd;border-radius:9px;padding:12px;margin:10px 0}
`;

document.head.appendChild(style);

const modal = document.createElement("div");
modal.id = "authModal";
modal.innerHTML = `
  <div class="authBox">
    <button id="authClose">✕ CLOSE</button>
    <h2>Customer Login</h2>
    <button id="googleLogin">Continue with Google</button>
    <p id="authMessage"></p>
  </div>
`;
document.body.appendChild(modal);

const profileModal = document.createElement("div");
profileModal.id = "profileModal";
profileModal.innerHTML = `
  <div class="profileBox">
    <button id="profileClose">✕ CLOSE</button>
    <h2>MY PROFILE</h2>
    <img id="profilePhoto" alt="Profile photo">
    <h3 id="profileName"></h3>
    <p id="profileEmail"></p>
    <button id="profileOrders">MY ORDERS</button>
    <div id="savedAddresses"></div>
    <button id="profileLogout" style="background:#d32f2f">LOGOUT</button>
  </div>
`;
document.body.appendChild(profileModal);

function message(text) {
  document.getElementById("authMessage").textContent = text;
}

function openLogin() {
  modal.style.display = "block";
}

document.getElementById("loginOpen").onclick = openLogin;

document.getElementById("authClose").onclick = () => {
  modal.style.display = "none";
};

document.getElementById("googleLogin").onclick = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    modal.style.display = "none";
  } catch (error) {
    message(error.message);
  }
};

document.getElementById("profileBtn").onclick = async () => {
  if (!currentUser) return;

  document.getElementById("profileName").textContent =
    currentUser.displayName || "Customer";

  document.getElementById("profileEmail").textContent =
    currentUser.email || "";

  const photo = document.getElementById("profilePhoto");
  photo.src = currentUser.photoURL || "";
  photo.style.display = currentUser.photoURL ? "block" : "none";

  profileModal.style.display = "block";
  await renderAddresses();
};

document.getElementById("profileClose").onclick = () => {
  profileModal.style.display = "none";
};

document.getElementById("profileLogout").onclick = async () => {
  try {
    await signOut(auth);
    profileModal.style.display = "none";
  } catch (error) {
    alert(error.message);
  }
};

document.getElementById("profileOrders").onclick = () => {
  profileModal.style.display = "none";
  document.getElementById("myOrdersBtn").click();
};

document.getElementById("logoutBtn").onclick = async () => {
  try {
    await signOut(auth);
    profileModal.style.display = "none";
  } catch (error) {
    alert(error.message);
  }
};

// ADDRESS DATABASE API

async function addressRequest(method = "GET", data = null) {
  if (!currentUser) throw new Error("Please login first.");

  const token = await currentUser.getIdToken();

  const response = await fetch("/api/addresses", {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Address request failed");
  }

  return result;
}

// PROFILE ADDRESS MANAGEMENT

async function renderAddresses() {
  const box = document.querySelector("#zvPage #zvSavedAddresses") ||
            document.getElementById("savedAddresses");
  if (!box) return;

  box.innerHTML = "<h3>Saved Delivery Addresses</h3>";

  try {
    savedAddresses = await addressRequest("GET");

    const add = document.createElement("button");
    add.textContent = "+ ADD NEW ADDRESS";
    add.onclick = () => showAddressForm();
    box.appendChild(add);

    const formBox = document.createElement("div");
    formBox.id = "addressFormBox";
    box.appendChild(formBox);

    savedAddresses.forEach((a, index) => {
      const card = document.createElement("div");
      card.className = "addressCard";

      const heading = document.createElement("b");
      heading.textContent = a.name + (a.is_default ? " ✓ DEFAULT" : "");

      const details = document.createElement("p");
      details.textContent =
        a.address + ", " + a.district + ", " + a.state + " - " + a.pincode;

      const phone = document.createElement("p");
      phone.textContent = "Phone: " + a.phone;

      const edit = document.createElement("button");
      edit.textContent = "CHANGE ADDRESS";
      edit.onclick = () => showAddressForm(index);

      const remove = document.createElement("button");
      remove.textContent = "DELETE";
      remove.style.background = "#d32f2f";
      remove.onclick = async () => {
        if (!confirm("Delete this address?")) return;
        try {
          await addressRequest("DELETE", { id: a.id });
          await renderAddresses();
        } catch (e) {
          alert(e.message);
        }
      };

      const makeDefault = document.createElement("button");
      makeDefault.textContent = "SET AS DEFAULT";
      makeDefault.onclick = async () => {
        try {
          await addressRequest("PATCH", { id: a.id });
          await renderAddresses();
        } catch (e) {
          alert(e.message);
        }
      };

      card.append(heading, details, phone, edit, remove, makeDefault);
      box.appendChild(card);
    });
  } catch (e) {
    box.innerHTML += "<p>" + e.message + "</p>";
  }
}

function showAddressForm(editIndex = -1) {
  const box = document.getElementById("addressFormBox");
  if (!box) return;

  const old = editIndex >= 0 ? savedAddresses[editIndex] : {};

  box.innerHTML = `
    <h3>${editIndex >= 0 ? "Change Address" : "Add New Address"}</h3>
    <input id="addrName" placeholder="Full Name">
    <input id="addrPhone" placeholder="10 digit mobile number" maxlength="10">
    <input id="addrPin" placeholder="6 digit PIN code" maxlength="6">
    <input id="addrState" placeholder="State">
    <input id="addrDistrict" placeholder="District / City">
    <textarea id="addrFull" placeholder="House No., Street, Area and Landmark"></textarea>
    <button id="saveAddress">SAVE ADDRESS</button>
    <button id="cancelAddress" style="background:#777">CANCEL</button>
  `;

  const fields = {
    addrName: old.name,
    addrPhone: old.phone,
    addrPin: old.pincode,
    addrState: old.state,
    addrDistrict: old.district,
    addrFull: old.address
  };

  Object.entries(fields).forEach(([id, value]) => {
    document.getElementById(id).value = value || "";
  });

  document.getElementById("cancelAddress").onclick = () => {
    box.innerHTML = "";
  };

  document.getElementById("saveAddress").onclick = async () => {
    const data = {
      name: document.getElementById("addrName").value.trim(),
      phone: document.getElementById("addrPhone").value.trim(),
      pincode: document.getElementById("addrPin").value.trim(),
      state: document.getElementById("addrState").value.trim(),
      district: document.getElementById("addrDistrict").value.trim(),
      address: document.getElementById("addrFull").value.trim(),
      is_default: editIndex < 0 && savedAddresses.length === 0
    };

    if (Object.values(data).some(v => !String(v).trim())) {
      alert("Please fill all address details.");
      return;
    }

    if (!/^[0-9]{10}$/.test(data.phone)) {
      alert("Enter a valid 10 digit mobile number.");
      return;
    }

    if (!/^[0-9]{6}$/.test(data.pincode)) {
      alert("Enter a valid 6 digit PIN code.");
      return;
    }

    try {
      if (editIndex >= 0) {
        data.id = savedAddresses[editIndex].id;
        await addressRequest("PUT", data);
      } else {
        await addressRequest("POST", data);
      }

      await renderAddresses();
    } catch (e) {
      alert(e.message);
    }
  };
}

// CHECKOUT ADDRESS MANAGEMENT

const checkoutForm = document.querySelector('form[name="orders"]');

if (checkoutForm) {
  const addressPanel = document.createElement("div");
  addressPanel.id = "checkoutAddressPanel";
  checkoutForm.before(addressPanel);

  function fillCheckoutAddress(a) {
    const fields = {
      customer_name: a.name,
      phone: a.phone,
      address: a.address,
      state: a.state,
      district: a.district,
      pincode: a.pincode
    };

    Object.entries(fields).forEach(([name, value]) => {
      const field = checkoutForm.querySelector(`[name="${name}"]`);
      if (field) field.value = value || "";
    });
  }

  async function showCheckoutAddresses() {
    addressPanel.innerHTML = "<h3>Delivering to</h3>";

    if (!currentUser) {
      addressPanel.innerHTML += "<p>Please login to manage saved addresses.</p>";
      return;
    }

    try {
      const addresses = await addressRequest("GET");

      const list = document.createElement("div");
      addressPanel.appendChild(list);

      addresses.forEach(a => {
        const card = document.createElement("div");
        card.className = "addressCard";

        const title = document.createElement("b");
        title.textContent = a.name + (a.is_default ? " ✓ DEFAULT" : "");

        const details = document.createElement("p");
        details.textContent =
          a.address + ", " + a.district + ", " + a.state + " - " + a.pincode;

        const phone = document.createElement("p");
        phone.textContent = "Phone: " + a.phone;

        const deliver = document.createElement("button");
        deliver.type = "button";
        deliver.textContent = "DELIVER TO THIS ADDRESS";
        deliver.style.background = "#16853c";
        deliver.onclick = async () => {
          fillCheckoutAddress(a);
          try {
            await addressRequest("PATCH", { id: a.id });
            await showCheckoutAddresses();
          } catch (e) {
            alert(e.message);
          }
        };

        const change = document.createElement("button");
        change.type = "button";
        change.textContent = "CHANGE ADDRESS";
        change.onclick = () => showCheckoutAddressForm(a);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "DELETE";
        remove.style.background = "#d32f2f";
        remove.onclick = async () => {
          if (!confirm("Delete this address?")) return;
          try {
            await addressRequest("DELETE", { id: a.id });
            await showCheckoutAddresses();
          } catch (e) {
            alert(e.message);
          }
        };

        card.append(title, details, phone, deliver, change, remove);
        list.appendChild(card);
      });

      if (!addresses.length) {
        list.innerHTML = "<p>No saved address found. Add a delivery address.</p>";
      } else {
        const selected = addresses.find(a => a.is_default) || addresses[0];
        fillCheckoutAddress(selected);
      }

      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "+ ADD NEW ADDRESS";
      add.onclick = () => showCheckoutAddressForm(null);
      addressPanel.appendChild(add);

      const formBox = document.createElement("div");
      formBox.id = "checkoutNewAddress";
      addressPanel.appendChild(formBox);

    } catch (e) {
      addressPanel.innerHTML += "<p>" + e.message + "</p>";
    }
  }

  function showCheckoutAddressForm(old = null) {
    const box = document.getElementById("checkoutNewAddress");
    if (!box) return;

    box.innerHTML = `
      <h3>${old ? "Change Address" : "Add New Address"}</h3>
      <input id="coName" placeholder="Full Name">
      <input id="coPhone" placeholder="Mobile Number" maxlength="10">
      <input id="coPin" placeholder="PIN Code" maxlength="6">
      <input id="coState" placeholder="State">
      <input id="coDistrict" placeholder="District / City">
      <textarea id="coAddress" placeholder="House No., Street, Area and Landmark"></textarea>
      <button type="button" id="coSave">SAVE ADDRESS</button>
      <button type="button" id="coCancel" style="background:#777">CANCEL</button>
    `;

    const values = {
      coName: old?.name,
      coPhone: old?.phone,
      coPin: old?.pincode,
      coState: old?.state,
      coDistrict: old?.district,
      coAddress: old?.address
    };

    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      field.value = value || "";
    });

    document.getElementById("coCancel").onclick = () => {
      box.innerHTML = "";
    };

    document.getElementById("coSave").onclick = async () => {
      const data = {
        name: document.getElementById("coName").value.trim(),
        phone: document.getElementById("coPhone").value.trim(),
        pincode: document.getElementById("coPin").value.trim(),
        state: document.getElementById("coState").value.trim(),
        district: document.getElementById("coDistrict").value.trim(),
        address: document.getElementById("coAddress").value.trim(),
        is_default: !old
      };

      if (Object.values(data).some(v => !String(v).trim())) {
        alert("Please fill all address details.");
        return;
      }

      if (!/^[0-9]{10}$/.test(data.phone)) {
        alert("Enter a valid 10 digit mobile number.");
        return;
      }

      if (!/^[0-9]{6}$/.test(data.pincode)) {
        alert("Enter a valid 6 digit PIN code.");
        return;
      }

      try {
        if (old) {
          data.id = old.id;
          await addressRequest("PUT", data);
        } else {
          await addressRequest("POST", data);
        }

        await showCheckoutAddresses();
      } catch (e) {
        alert(e.message);
      }
    };
  }

  window.showCheckoutAddresses = showCheckoutAddresses;
}

// LOGIN STATE

function updateLoginUI(user) {
  currentUser = user;

  document.getElementById("authStatus").textContent =
    user ? "Welcome to ZORVANA FASHION" : "Please login to order";

  document.getElementById("loginOpen").style.display =
    user ? "none" : "inline-block";

  document.getElementById("logoutBtn").style.display =
    user ? "inline-block" : "none";

  document.getElementById("profileBtn").style.display =
    user ? "inline-block" : "none";

  if (checkoutForm) {
    showCheckoutAddresses();
  }
}

onAuthStateChanged(auth, updateLoginUI, error => {
  document.getElementById("authStatus").textContent =
    "Login error: " + error.message;
});

// BUY NOW LOGIN CHECK

const originalBuy = window.buy;

window.buy = function(product) {
  if (!currentUser) {
    openLogin();
    message("Login first to place your order.");
    return;
  }

  if (typeof originalBuy === "function") {
    originalBuy(product);
  }
};

// ORDER SUBMISSION

const orderForm = document.querySelector('form[name="orders"]');

if (orderForm) {
  orderForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      openLogin();
      return;
    }

    const button = document.getElementById("orderButton");

    if (button) {
      button.disabled = true;
      button.textContent = "PLEASE WAIT...";
    }

    try {
      const token = await currentUser.getIdToken();
      const productName = document.getElementById("checkoutProduct")?.value || "";

      const normalize = value =>
        (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const productCard = [...document.querySelectorAll(".card")].find(card => {
        const cardName = normalize(
          card.dataset.name || card.querySelector("h3")?.innerText
        );
        const orderName = normalize(productName);

        return cardName === orderName ||
          cardName.includes(orderName) ||
          orderName.includes(cardName);
      });

      const formData = new FormData(orderForm);

      if (productCard) {
        const img = productCard.querySelector("img");
        const price = productCard.querySelector(".price");

        if (img) formData.append("product_image", img.src);
        if (price) formData.append("product_price", price.innerText);
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error("Order could not be saved. Please try again.");
      }

      window.location.href = "/order-success.html";

    } catch (error) {
      alert(error.message);
      if (button) {
        button.disabled = false;
        button.textContent = "PLACE ORDER";
      }
    }
  });
}

// MY ORDERS AND TRACKING

document.getElementById("myOrdersBtn").onclick = async () => {
  document.body.classList.add("orders-view");

  if (!currentUser) {
    openLogin();
    return;
  }

  let box = document.getElementById("myOrders");

  if (!box) {
    box = document.createElement("section");
    box.id = "myOrders";
    document.body.appendChild(box);
  }

  box.innerHTML = "<h2>My Orders</h2><p>Loading...</p>";

  try {
    const token = await currentUser.getIdToken();

    const response = await fetch("/api/orders", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!response.ok) throw new Error("Could not load orders");

    const orders = await response.json();

    box.innerHTML = "<h2>My Orders</h2>";

    if (!orders.length) {
      box.innerHTML += "<p>No orders found.</p>";
      return;
    }

    const steps = [
      "Confirmed",
      "Shipped",
      "Out for Delivery",
      "Delivered"
    ];

    orders.forEach(order => {
      const status = order.status || "Pending";
      const cancelled = status === "Cancelled";

      const item = document.createElement("div");
      item.className = "customerOrder";

      const number = document.createElement("p");
number.textContent = "Order #" + order.id;
item.appendChild(number);

      const productRow = document.createElement("div");
      productRow.className = "orderProduct";

      if (order.product_image) {
        const image = document.createElement("img");
        image.src = order.product_image;
        image.alt = order.product || "Product";
        productRow.appendChild(image);
      }

      const info = document.createElement("div");

      const name = document.createElement("h3");
      name.textContent = order.product || "Product";

      const price = document.createElement("p");
      price.textContent = order.product_price || "";

      if (order.size && order.size !== "Not selected" && order.size !== "Not applicable") {
        const size = document.createElement("p");
        size.textContent = "Size: " + order.size;
        info.appendChild(size);
      }

      info.append(name, price);
      productRow.appendChild(info);
      item.appendChild(productRow);

      const statusText = document.createElement("h3");
      statusText.textContent = cancelled
        ? "Order Cancelled"
        : "Order " + status;
      item.appendChild(statusText);

      if (order.expected_delivery && !cancelled) {
        const delivery = document.createElement("p");
        const date = new Date(order.expected_delivery + "T00:00:00");

        delivery.textContent = "Expected Delivery: " +
          date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
          });

        delivery.style.fontWeight = "bold";
        item.appendChild(delivery);
      }

      if (cancelled && order.cancel_reason) {
        const reason = document.createElement("p");
        reason.textContent = "Cancellation Reason: " + order.cancel_reason;
        item.appendChild(reason);
      }

      if (status === "Confirmed") {
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "CANCEL ORDER";
        cancelButton.style.cssText =
          "background:#d32f2f;color:white;padding:10px;border:0;border-radius:6px";

        const panel = document.createElement("div");
        panel.style.display = "none";

        const select = document.createElement("select");
        select.style.cssText = "width:100%;padding:10px;margin:10px 0";
        select.innerHTML = `
          <option value="">Select reason</option>
          <option value="Ordered by mistake">Ordered by mistake</option>
          <option value="Found a better price">Found a better price</option>
          <option value="Delivery taking too long">Delivery taking too long</option>
          <option value="Want to change product or size">Want to change product or size</option>
          <option value="Other">Other</option>
        `;

        const other = document.createElement("textarea");
        other.placeholder = "Enter your reason";
        other.style.cssText = "width:100%;padding:10px;box-sizing:border-box";

        const confirm = document.createElement("button");
        confirm.textContent = "CONFIRM CANCELLATION";
        confirm.style.cssText =
          "background:#d32f2f;color:white;padding:10px;border:0;border-radius:6px;margin:5px";

        const close = document.createElement("button");
        close.textContent = "KEEP ORDER";
        close.style.cssText =
          "background:#777;color:white;padding:10px;border:0;border-radius:6px;margin:5px";

        cancelButton.onclick = () => {
          panel.style.display =
            panel.style.display === "none" ? "block" : "none";
        };

        close.onclick = () => {
          panel.style.display = "none";
          select.value = "";
          other.value = "";
        };

        confirm.onclick = async () => {
          const reason = select.value === "Other"
            ? other.value.trim()
            : select.value;

          if (!reason) {
            alert("Please select or enter a reason.");
            return;
          }

          confirm.disabled = true;
          confirm.textContent = "PLEASE WAIT...";

          try {
            const cancelToken = await currentUser.getIdToken();

            const result = await fetch("/api/orders", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + cancelToken
              },
              body: JSON.stringify({
                id: order.id,
                cancel_reason: reason
              })
            });

            const data = await result.json();

            if (!result.ok) {
              throw new Error(data.error || "Cancellation failed");
            }

            alert("Order cancelled successfully.");
            document.getElementById("myOrdersBtn").click();

          } catch (error) {
            alert(error.message);
            confirm.disabled = false;
            confirm.textContent = "CONFIRM CANCELLATION";
          }
        };

        panel.append(select, other, confirm, close);
        item.append(cancelButton, panel);
      }

      if (!cancelled) {
        const timeline = document.createElement("div");
        timeline.className = "trackLine";

        const currentIndex = steps.indexOf(status);

        steps.forEach((step, index) => {
          const stepBox = document.createElement("div");
          stepBox.className = "trackStep";

          if (currentIndex >= index) stepBox.classList.add("done");

          const dot = document.createElement("div");
          dot.className = "trackDot";

          const label = document.createElement("span");
          label.textContent = step;

          stepBox.append(dot, label);
          timeline.appendChild(stepBox);
        });

        item.appendChild(timeline);
      }

      const historyBox = document.createElement("div");
      historyBox.className = "trackHistory";

      const heading = document.createElement("b");
      heading.textContent = "Order Updates";
      historyBox.appendChild(heading);

      (order.tracking || []).forEach(update => {
        const line = document.createElement("p");
        const date = update.updated_at
          ? new Date(update.updated_at).toLocaleString("en-IN")
          : "";

        line.textContent = "✓ " + update.status + " " + date;
        historyBox.appendChild(line);
      });

      item.appendChild(historyBox);
      box.appendChild(item);
    });

    box.scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    box.textContent = error.message;
  }
};

// BOTTOM NAVIGATION CONNECTIONS

window.openOrders = function() {
  document.body.classList.add("orders-view");
  document.getElementById("myOrdersBtn").click();
};

window.openProfile = function() {
  document.body.classList.remove("orders-view");

  if (currentUser) {
    document.getElementById("profileBtn").click();
  } else {
    openLogin();
    message("Login to view your profile and saved addresses.");
  }
};

// ===== ZORVANA MEESHO STYLE ACCOUNT + ORDERS + TRACKING =====
(function () {
  const css = document.createElement("style");
  css.textContent = `
  body.zv-page-mode{background:#f5f5f5!important}
  body.zv-page-mode .topbar,
  body.zv-page-mode header,
  body.zv-page-mode .hero,
  body.zv-page-mode .quick-cats,
  body.zv-page-mode #shop,
  body.zv-page-mode .offer-banner,
  body.zv-page-mode .service-strip,
  body.zv-page-mode footer{display:none!important}

  #zvPage{display:none;max-width:760px;min-height:80vh;
    margin:auto;padding:16px 13px 95px;color:#222}
  body.zv-account-view #zvPage,
  body.zv-orders-view #zvPage,
  body.zv-detail-view #zvPage{display:block}

  #zvPage .zv-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  #zvPage .zv-back{border:0;background:white;border-radius:50%;
    width:40px;height:40px;font-size:25px}
  #zvPage h2{font-size:21px;margin:0}
  .zv-panel,.zv-order{background:white;border:1px solid #eee;
    border-radius:12px;padding:16px;margin:12px 0}
  .zv-account-user{display:flex;align-items:center;gap:13px}
  .zv-avatar{width:58px;height:58px;border-radius:50%;
    object-fit:cover;background:#eee;display:flex;align-items:center;
    justify-content:center;font-size:25px}
  .zv-menu{display:flex;align-items:center;gap:14px;padding:17px 5px;
    border-bottom:1px solid #eee;cursor:pointer}
  .zv-menu:last-child{border-bottom:0}
  .zv-menu-icon{width:28px;text-align:center;font-size:23px}
  .zv-menu b{flex:1;font-size:15px}
  .zv-arrow{color:#999;font-size:20px}
  .zv-order-top{display:flex;justify-content:space-between;
    gap:8px;align-items:center;font-size:13px;color:#666}
  .zv-order-product{display:flex;gap:12px;align-items:center;margin:13px 0}
  .zv-order-product img{width:85px;height:95px;object-fit:contain;
    background:#f7f7f7;border-radius:8px}
  .zv-order-product h3{font-size:15px;margin:0 0 7px}
  .zv-status{color:#16853c;font-weight:bold;font-size:14px}
  .zv-primary{width:100%;padding:13px;border:0;border-radius:7px;
    background:#d71936;color:white;font-weight:bold;margin-top:10px}
  .zv-track{display:flex;justify-content:space-between;gap:3px;
    margin:22px 0 15px;position:relative}
  .zv-track:before{content:"";position:absolute;top:11px;
    left:8%;right:8%;height:3px;background:#ddd}
  .zv-track-step{z-index:1;flex:1;text-align:center;font-size:10px;color:#888}
  .zv-track-dot{width:23px;height:23px;border:2px solid #bbb;
    background:white;border-radius:50%;margin:0 auto 8px;
    display:flex;align-items:center;justify-content:center}
  .zv-track-step.done{color:#16853c;font-weight:bold}
  .zv-track-step.done .zv-track-dot{background:#16853c;
    border-color:#16853c;color:white}
  .zv-detail-label{font-size:12px;color:#777;margin-bottom:5px}
  .zv-address{line-height:1.6;font-size:14px}
  .zv-history p{font-size:13px;border-bottom:1px solid #eee;padding:8px 0;margin:0}
  body.zv-page-mode .bottom-nav{z-index:100}
  @media(max-width:480px){
    .zv-track-step{font-size:9px}
    .zv-order-product img{width:75px;height:85px}
  }`;
  document.head.appendChild(css);

  const page=document.createElement("main");
  page.id="zvPage";
  document.body.appendChild(page);

  const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const dateText=v=>{
    if(!v)return "Date not updated";
    const d=new Date(v);
    return isNaN(d)?"Date not updated":
      d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
  };

  const moneyText=v=>{
    if(!v)return "Cash on Delivery";
    return String(v).includes("₹")?String(v):"₹"+v;
  };

  let cachedOrders=[];

  function showPage(mode,title,body){
    document.body.classList.remove(
      "orders-view","zv-account-view","zv-orders-view","zv-detail-view"
    );
    document.body.classList.add("zv-page-mode",mode);
    page.innerHTML=`
      <div class="zv-head">
        <button class="zv-back" id="zvBack">‹</button>
        <h2>${title}</h2>
      </div>${body}`;
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function menuRow(icon,label,action){
    return `<div class="zv-menu" data-action="${action}">
      <span class="zv-menu-icon">${icon}</span>
      <b>${label}</b><span class="zv-arrow">›</span>
    </div>`;
  }

  async function accountPage(){
    if(!currentUser){
      openLogin();
      message("Login to view your account.");
      return;
    }

    const photo=currentUser.photoURL
      ?`<img class="zv-avatar" src="${safe(currentUser.photoURL)}">`
      :`<div class="zv-avatar">👤</div>`;

    showPage("zv-account-view","Account",`
      <section class="zv-panel zv-account-user">
        ${photo}
        <div>
          <b>${safe(currentUser.displayName||"Customer")}</b>
          <div style="font-size:13px;color:#777;margin-top:5px">
            ${safe(currentUser.email||"")}
          </div>
        </div>
      </section>
      <section class="zv-panel">
        ${menuRow("📦","My Orders","orders")}
        ${menuRow("♡","My Wishlist","wishlist")}
        ${menuRow("📍","Saved Addresses","addresses")}
        ${menuRow("🎧","Help & Support","help")}
        ${menuRow("⚙","Settings","settings")}
        ${menuRow("↪","Logout","logout")}
      </section>
    `);

    page.querySelectorAll("[data-action]").forEach(el=>{
      el.onclick=async()=>{
        const action=el.dataset.action;

        if(action==="orders")ordersPage();

        if(action==="wishlist"){
          document.body.classList.remove("zv-page-mode","zv-account-view");
          if(window.showWishlist)window.showWishlist();
        }

        if(action==="addresses"){
          showPage("zv-account-view","Saved Addresses",
            '<section class="zv-panel"><div id="zvSavedAddresses"></div></section>');
          await renderAddresses();
        }

        if(action==="logout"){
          if(confirm("Are you sure you want to logout?")){
            await signOut(auth);
            document.body.classList.remove("zv-page-mode");
          }
        }

        if(action==="help"){
          showPage("zv-account-view","Help & Support",
            '<section class="zv-panel">Contact ZORVANA FASHION customer support for help.</section>');
        }

        if(action==="settings"){
          showPage("zv-account-view","Settings",
            '<section class="zv-panel">Account settings</section>');
        }
      };
    });

    document.getElementById("zvBack").onclick=()=>window.goHome?.();
  }

  function trackingDate(order,status){
    const rows=Array.isArray(order.tracking)?order.tracking:[];
    const found=rows.find(x=>
      String(x.status||"").toLowerCase()===status.toLowerCase()
    );
    return found?.updated_at||found?.created_at||null;
  }

  function statusIndex(status){
    const s=String(status||"Pending").toLowerCase();
    if(s.includes("cancel"))return -1;
    if(s.includes("deliver")&&!s.includes("out"))return 3;
    if(s.includes("out for"))return 2;
    if(s.includes("ship")||s.includes("dispatch"))return 1;
    return 0;
  }

  function orderCard(o,i){
    return `<article class="zv-order">
      <div class="zv-order-top">
        <span>Order #${safe(o.id)}</span>
        <span>${dateText(o.created_at||o.order_date)}</span>
      </div>
      <div class="zv-order-product">
        ${o.product_image?`<img src="${safe(o.product_image)}" alt="Product">`:""}
        <div>
          <h3>${safe(o.product||"Fashion Product")}</h3>
          <div>${moneyText(o.product_price||o.amount)}</div>
          ${o.size?`<small>Size: ${safe(o.size)}</small>`:""}
        </div>
      </div>
      <div class="zv-status">${safe(o.status||"Pending")}</div>
      <button class="zv-primary" data-detail="${i}">
        TRACK ORDER / VIEW DETAILS
      </button>
    </article>`;
  }

  async function ordersPage(){
    if(!currentUser){
      openLogin();
      message("Login to see your orders.");
      return;
    }

    showPage("zv-orders-view","My Orders",
      '<div class="zv-panel">Loading your orders...</div>');

    try{
      const token=await currentUser.getIdToken();
      const res=await fetch("/api/orders",{
        headers:{"Authorization":"Bearer "+token}
      });
      if(!res.ok)throw new Error("Could not load orders.");

      cachedOrders=await res.json();
      if(!Array.isArray(cachedOrders))cachedOrders=[];

      page.innerHTML=`
        <div class="zv-head">
          <button class="zv-back" id="zvBack">‹</button>
          <h2>My Orders</h2>
        </div>
        ${cachedOrders.length
          ?cachedOrders.map(orderCard).join("")
          :'<section class="zv-panel" style="text-align:center;padding:35px 15px"><div style="font-size:42px">📦</div><h3>No orders yet</h3><p style="color:#777">Your orders will appear here.</p><button class="zv-primary" id="zvShop">START SHOPPING</button></section>'
        }`;

      document.getElementById("zvBack").onclick=accountPage;
      document.getElementById("zvShop")?.addEventListener("click",()=>window.goHome?.());

      page.querySelectorAll("[data-detail]").forEach(btn=>{
        btn.onclick=()=>orderDetails(cachedOrders[Number(btn.dataset.detail)]);
      });

    }catch(e){
      showPage("zv-orders-view","My Orders",
        `<section class="zv-panel">${safe(e.message)}</section>`);
    }
  }

  function orderDetails(o){
    if(!o)return;

    const status=o.status||"Pending";
    const idx=statusIndex(status);
    const cancelled=idx===-1;

    const stages=["Order Placed","Shipped","Out for Delivery","Delivered"];
    const statusForDate=["Confirmed","Shipped","Out for Delivery","Delivered"];

    const track=cancelled
      ?'<div class="zv-status" style="color:#c62828">Order Cancelled</div>'
      :`<div class="zv-track">${
        stages.map((stage,i)=>`
          <div class="zv-track-step ${idx>=i?"done":""}">
            <div class="zv-track-dot">${idx>=i?"✓":""}</div>
            ${stage}
            <div style="margin-top:5px;font-weight:400">
              ${dateText(trackingDate(o,statusForDate[i]))}
            </div>
          </div>`).join("")
      }</div>`;

    const address=[o.address,o.district,o.state,o.pincode]
      .filter(Boolean).join(", ");

    const history=(o.tracking||[]).map(t=>`
      <p>✓ ${safe(t.status)} · ${dateText(t.updated_at||t.created_at)}</p>
    `).join("")||"<p>Order updates will appear here when available.</p>";

    showPage("zv-detail-view","Order Details",`
      <section class="zv-panel">
        <div class="zv-order-top">
          <b>Order #${safe(o.id)}</b>
          <span>${dateText(o.created_at||o.order_date)}</span>
        </div>
        <div class="zv-order-product">
          ${o.product_image?`<img src="${safe(o.product_image)}" alt="Product">`:""}
          <div>
            <h3>${safe(o.product||"Fashion Product")}</h3>
            <b>${moneyText(o.product_price||o.amount)}</b>
            <div style="font-size:12px;color:#777;margin-top:5px">
              Payment: Cash on Delivery
            </div>
          </div>
        </div>
        <div class="zv-status">${cancelled?"Order Cancelled":safe(status)}</div>
        ${track}
      </section>

      ${o.expected_delivery&&!cancelled?`
        <section class="zv-panel">
          <div class="zv-detail-label">EXPECTED DELIVERY</div>
          <b>${dateText(o.expected_delivery)}</b>
        </section>`:""}

      <section class="zv-panel">
        <div class="zv-detail-label">DELIVERY ADDRESS</div>
        <div class="zv-address">
          <b>${safe(o.customer_name||o.name||"Customer")}</b><br>
          ${safe(address||"Address details unavailable")}<br>
          ${safe(o.phone||"")}
        </div>
      </section>

      <section class="zv-panel zv-history">
        <b>Order Updates</b>${history}
      </section>
    `);

    document.getElementById("zvBack").onclick=ordersPage;
  }

  window.openOrders=ordersPage;
  window.openProfile=accountPage;
  window.zorvanaShowOrders=ordersPage;
  window.zorvanaShowAccount=accountPage;
})();
