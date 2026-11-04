
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhCeF2z7VtPggUnwB9u7C-meNhZB-_7h0",
  authDomain: "zorvana-fashion.firebaseapp.com",
  projectId: "zorvana-fashion",
  storageBucket: "zorvana-fashion.firebasestorage.app",
  messagingSenderId: "606256476404",
  appId: "1:606256476404:web:67f46b61efae5e50362ea1",
  measurementId: "G-ML0PLRYQ7J"
};

const authUI = document.createElement("div");
authUI.id = "zorvanaAuth";
authUI.innerHTML = `
  <div id="authStatus">Checking account...</div>
  <button id="loginOpen">LOGIN / SIGN UP</button>
  <button id="profileBtn" style="display:none">MY PROFILE</button>
  <button id="myOrdersBtn">MY ORDERS</button>
  <button id="logoutBtn" style="display:none">LOGOUT</button>
`;
document.querySelector("header").after(authUI);

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
  <button id="savedAddressBtn">SAVED ADDRESSES</button>
  <div id="savedAddresses"></div>
 </div>
`;
document.body.appendChild(profileModal);

let currentUser = null;
let auth;

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

document.getElementById("profileBtn").onclick = () => {
  if (!currentUser) return;

  document.getElementById("profileName").textContent =
    currentUser.displayName || "Customer";

  document.getElementById("profileEmail").textContent =
    currentUser.email || "";

  const photo = document.getElementById("profilePhoto");
  photo.src = currentUser.photoURL || "";
  photo.style.display = currentUser.photoURL ? "block" : "none";

  profileModal.style.display = "block";
};

document.getElementById("profileClose").onclick = () => {
  profileModal.style.display = "none";
};

document.getElementById("profileOrders").onclick = () => {
  profileModal.style.display = "none";
  document.getElementById("myOrdersBtn").click();
};

document.getElementById("savedAddressBtn").onclick = () => {
  const box = document.getElementById("savedAddresses");
  const addresses = JSON.parse(
    localStorage.getItem("zorvanaAddresses") || "[]"
  );

  const address = prompt("Enter your full address:");

  if (address && address.trim()) {
    addresses.push(address.trim());
    localStorage.setItem("zorvanaAddresses", JSON.stringify(addresses));
  }

  box.innerHTML = "<h3>Saved Addresses</h3>";

  addresses.forEach((item, index) => {
    const p = document.createElement("p");
    p.textContent = (index + 1) + ". " + item;
    box.appendChild(p);
  });
};

document.getElementById("logoutBtn").onclick = async () => {
  try {
    await signOut(auth);
    profileModal.style.display = "none";
  } catch (error) {
    alert(error.message);
  }
};

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
}

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  onAuthStateChanged(auth, updateLoginUI, error => {
    document.getElementById("authStatus").textContent =
      "Login error: " + error.message;
  });
} catch (error) {
  document.getElementById("authStatus").textContent =
    "Firebase error: " + error.message;
}

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

const orderForm = document.querySelector('form[name="orders"]');

if (orderForm) {
  orderForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser) {
      openLogin();
      return;
    }

    const button = document.getElementById("orderButton");
    button.disabled = true;
    button.textContent = "PLEASE WAIT...";

    try {
      const token = await currentUser.getIdToken();
      const productName = document.getElementById("checkoutProduct").value;

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
      button.disabled = false;
      button.textContent = "PLACE ORDER";
    }
  });
}

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
