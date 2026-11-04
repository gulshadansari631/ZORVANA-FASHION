
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;

const style = document.createElement("style");
style.textContent = `
#zorvanaAuth{padding:12px;text-align:center;background:#fff}
#zorvanaAuth button{padding:10px 15px;margin:5px;border:0;border-radius:5px;background:#2874f0;color:white;font-weight:bold}
#authModal,#profileModal{display:none;position:fixed;inset:0;background:#000b;z-index:20000;padding:20px;overflow:auto}
.authBox,.profileBox{background:white;color:#222;max-width:400px;margin:40px auto;padding:20px;border-radius:12px}
.authBox button,.profileBox button{width:100%;padding:12px;margin:6px 0;border:0;border-radius:5px;background:#2874f0;color:white}
#myOrders{padding:15px;background:white;margin:15px;border-radius:8px}
.orderItem{border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:7px}
#profilePhoto{width:90px;height:90px;border-radius:50%;object-fit:cover}
`;
document.head.appendChild(style);

// Login buttons
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

// Login modal
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

// Profile modal
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
 </div>
`;
document.body.appendChild(profileModal);

function showMessage(message) {
  document.getElementById("authMessage").textContent = message;
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
    showMessage(error.message);
  }
};

// Profile button
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

// Login state
onAuthStateChanged(auth, user => {
  currentUser = user;

  document.getElementById("authStatus").textContent =
    user ? "Welcome, " + (user.displayName || user.email) : "Please login to order";

  document.getElementById("loginOpen").style.display =
    user ? "none" : "inline-block";

  document.getElementById("logoutBtn").style.display =
    user ? "inline-block" : "none";

  document.getElementById("profileBtn").style.display =
    user ? "inline-block" : "none";
});

// Logout
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  profileModal.style.display = "none";
};

const originalBuy = window.buy;

window.buy = function(product) {
  if (!currentUser) {
    openLogin();
    showMessage("Login first to place your order.");
    return;
  }

  originalBuy(product);
};

// Save order with Firebase login token
const orderForm = document.querySelector('form[name="orders"]');

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
  const cardName = normalize(card.dataset.name || card.querySelector("h3")?.innerText);
  const orderName = normalize(productName);
  return cardName === orderName ||
  cardName.replace(/^mens/, "men") === orderName.replace(/^mens/, "men") ||
  cardName.includes(orderName) ||
  orderName.includes(cardName);
});

const formData = new FormData(orderForm);

if (productCard) {
  formData.append("product_image", productCard.querySelector("img").src);
  formData.append("product_price", productCard.querySelector(".price").innerText);
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

// Customer My Orders
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

  box.innerHTML = `
    <h2>My Orders</h2>
    <p>Loading your orders...</p>
  `;

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

    box.innerHTML = `
      <h2>My Orders</h2>
      <style>
        .customerOrder {
          background:white;
          border:1px solid #ddd;
          border-radius:12px;
          padding:15px;
          margin:15px 0;
          color:#222;
        }
        .customerOrder img {
          width:100px;
          height:100px;
          object-fit:contain;
          border:1px solid #eee;
          border-radius:8px;
        }
        .orderProduct {
          display:flex;
          gap:15px;
          align-items:center;
          margin:15px 0;
        }
        .trackLine {
          display:flex;
          justify-content:space-between;
          gap:5px;
          margin:20px 0;
        }
        .trackStep {
          flex:1;
          text-align:center;
          font-size:11px;
          color:#888;
        }
        .trackDot {
          width:18px;
          height:18px;
          border-radius:50%;
          border:2px solid #aaa;
          margin:0 auto 7px;
          background:white;
        }
        .trackStep.done .trackDot {
          background:#16853c;
          border-color:#16853c;
        }
        .trackStep.done {
          color:#16853c;
          font-weight:bold;
        }
        .trackHistory {
          background:#f5f6f8;
          padding:12px;
          border-radius:8px;
          margin-top:12px;
        }
      </style>
    `;

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

      const image = document.createElement("img");
      image.src = order.product_image || "";
      image.alt = order.product || "Product";

      const productInfo = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = order.product || "Product";
      const price = document.createElement("p");
      price.textContent = order.product_price || "";

      productInfo.append(name, price);

      const productRow = document.createElement("div");
      productRow.className = "orderProduct";

      if (order.product_image) productRow.appendChild(image);
      productRow.appendChild(productInfo);

      const orderNumber = document.createElement("p");
      orderNumber.textContent = "Order #" + order.id;

      const statusText = document.createElement("h3");
      statusText.textContent = cancelled
        ? "Order Cancelled"
        : "Order " + status;

      item.append(orderNumber, productRow, statusText);

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
        line.style.marginTop = "8px";
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
