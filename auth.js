
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhCeF2z7VtPggUnWb9u7C-meNhZB-_7h0",
  authDomain: "zorvana-fashion.firebaseapp.com",
  projectId: "zorvana-fashion",
  storageBucket: "zorvana-fashion.firebasestorage.app",
  messagingSenderId: "606256476404",
  appId: "1:606256476404:web:67f46b61efae5e50362ea1",
  measurementId: "G-ML0PLRYQ7J"
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
#zorvanaAuth{padding:12px;text-align:center;background:white}
#zorvanaAuth button{padding:10px 15px;margin:5px;border:0;border-radius:5px;background:#2874f0;color:white;font-weight:bold}
#authModal,#profileModal{display:none;position:fixed;inset:0;background:#000b;z-index:20000;padding:20px;overflow:auto}
.authBox,.profileBox{background:white;color:#222;max-width:400px;margin:40px auto;padding:20px;border-radius:12px}
.authBox button,.profileBox button{width:100%;padding:12px;margin:6px 0;border:0;border-radius:5px;background:#2874f0;color:white}
#profilePhoto{width:90px;height:90px;border-radius:50%;object-fit:cover}
#myOrders{padding:15px;background:white;margin:15px;border-radius:8px}
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
  const box = document.getElementById("savedAddresses");
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
    user ? "Welcome, " + (user.displayName || user.email) : "Please login to order";

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
  if (!currentUser) {
    openLogin();
    return;
  }

  let box = document.getElementById("myOrders");

  if (!box) {
    box = document.createElement("section");
    box.id = "myOrders";
    authUI.after(box);
  }

  box.innerHTML = "<h2>My Orders</h2><p>Loading your orders...</p>";

  try {
    const token = await currentUser.getIdToken();

    const response = await fetch("/api/orders", {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (!response.ok) throw new Error("Could not load orders");

    const orders = await response.json();

    if (!orders.length) {
      box.innerHTML = "<h2>My Orders</h2><p>No orders found.</p>";
      box.scrollIntoView({ behavior: "smooth" });
      return;
    }

    box.innerHTML = "<h2>My Orders</h2>";

    const steps = [
      "Confirmed",
      "Shipped",
      "Out for Delivery",
      "Delivered"
    ];

    orders.forEach(order => {
      const status = order.status || "Pending";
      const history = order.tracking || [];
      const currentIndex = steps.indexOf(status);
      const cancelled = status === "Cancelled";

      const item = document.createElement("div");
      item.className = "customerOrder";

      const orderNumber = document.createElement("p");
      orderNumber.textContent = "Order #" + order.id;
      item.appendChild(orderNumber);

      const productRow = document.createElement("div");
      productRow.className = "orderProduct";

      if (order.product_image) {
        const image = document.createElement("img");
        image.src = order.product_image;
        image.alt = order.product || "Product";
        productRow.appendChild(image);
      }

      const productInfo = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = order.product || "Product";

      const price = document.createElement("p");
      price.textContent = order.product_price || "";

      productInfo.append(name, price);
      productRow.appendChild(productInfo);
      item.appendChild(productRow);

      const statusText = document.createElement("h3");
      statusText.textContent = cancelled
        ? "Order Cancelled"
        : "Order " + status;
      item.appendChild(statusText);

      if (!cancelled) {
        const timeline = document.createElement("div");
        timeline.className = "trackLine";

        steps.forEach((step, index) => {
          const stepBox = document.createElement("div");
          stepBox.className = "trackStep";

          if (currentIndex >= index) {
            stepBox.classList.add("done");
          }

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

      const historyTitle = document.createElement("b");
      historyTitle.textContent = "Order Updates";
      historyBox.appendChild(historyTitle);

      history.forEach(update => {
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
