
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

const aliases = {
  "Men Classic T Shirt": "Men's Classic T-Shirt",
  "Womens Fashion Dress": "Women's Fashion Dress",
  "Sports Sneakers": "Premium Sports Sneakers"
};

const actualName = aliases[productName] || productName;

const productCard = [...document.querySelectorAll(".card")].find(card =>
  (card.dataset.name || "").toLowerCase() === actualName.toLowerCase()
);

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

  box.innerHTML = "<h2>My Orders</h2><p>Loading...</p>";

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
      return;
    }

    box.innerHTML = "<h2>My Orders</h2>";

    orders.forEach(order => {
      const item = document.createElement("div");
      item.className = "orderItem";

      const details = document.createElement("p");
      details.textContent =
        "Order #" + order.id +
        " | " + order.product +
        " | Status: " + (order.status || "Pending");

      item.appendChild(details);
      box.appendChild(item);
    });

    box.scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    box.textContent = error.message;
  }
};
