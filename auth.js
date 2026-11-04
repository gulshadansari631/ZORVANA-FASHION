
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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
let confirmationResult = null;
let recaptchaVerifier = null;

const style = document.createElement("style");
style.textContent = `
#zorvanaAuth{padding:12px;text-align:center;background:#fff}
#zorvanaAuth button{padding:10px 15px;margin:5px;border:0;border-radius:5px;background:#2874f0;color:white;font-weight:bold}
#authModal{display:none;position:fixed;inset:0;background:#000b;z-index:20000;padding:20px;overflow:auto}
.authBox{background:white;color:#222;max-width:400px;margin:40px auto;padding:20px;border-radius:12px}
.authBox input{width:100%;padding:12px;margin:8px 0;border:1px solid #ccc;border-radius:5px}
.authBox button{width:100%;padding:12px;margin:6px 0;border:0;border-radius:5px;background:#2874f0;color:white}
#myOrders{padding:15px;background:white;margin:15px;border-radius:8px}
.orderItem{border:1px solid #ddd;padding:12px;margin:10px 0;border-radius:7px}
`;
document.head.appendChild(style);

const authUI = document.createElement("div");
authUI.id = "zorvanaAuth";
authUI.innerHTML = `
  <div id="authStatus">Checking account...</div>
  <button id="loginOpen">LOGIN / SIGN UP</button>
  <button id="myOrdersBtn">MY ORDERS</button>
  <button id="logoutBtn" style="display:none">LOGOUT</button>
`;
document.querySelector("header").after(authUI);

const modal = document.createElement("div");
modal.id = "authModal";
modal.innerHTML = `
 <div class="authBox">
  <button id="authClose">✕ CLOSE</button>
  <h2>Customer Login</h2>
  <button id="googleLogin">Continue with Google</button>
  <hr>
  <h3>Login with Mobile OTP</h3>
  <input id="authPhone" type="tel" maxlength="10" placeholder="Enter 10 digit mobile number">
  <div id="recaptcha-container"></div>
  <button id="sendOTP">SEND OTP</button>
  <input id="authOTP" placeholder="Enter OTP" inputmode="numeric">
  <button id="verifyOTP">VERIFY OTP</button>
  <p id="authMessage"></p>
 </div>
`;
document.body.appendChild(modal);

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

document.getElementById("sendOTP").onclick = async () => {
  try {
  const mobile = document.getElementById("authPhone").value.trim();

if (!/^[6-9][0-9]{9}$/.test(mobile)) {
  showMessage("Enter a valid 10 digit Indian mobile number");
  return;
}

const phone = "+91" + mobile;

    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "normal" }
      );
    }

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      recaptchaVerifier
    );

    showMessage("OTP sent successfully!");
  } catch (error) {
    showMessage(error.message);
    if (recaptchaVerifier) {
      await recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
  }
};

document.getElementById("verifyOTP").onclick = async () => {
  try {
    if (!confirmationResult) {
      showMessage("Please request OTP first.");
      return;
    }

    const otp = document.getElementById("authOTP").value.trim();
    await confirmationResult.confirm(otp);

    modal.style.display = "none";
    showMessage("Login successful!");
  } catch (error) {
    showMessage("Invalid OTP. Please try again.");
  }
};

onAuthStateChanged(auth, user => {
  currentUser = user;

  document.getElementById("authStatus").textContent =
    user ? "Welcome, " + (user.displayName || user.phoneNumber || user.email) : "Please login to order";

  document.getElementById("loginOpen").style.display =
    user ? "none" : "inline-block";

  document.getElementById("logoutBtn").style.display =
    user ? "inline-block" : "none";
});

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
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

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      },
      body: new FormData(orderForm)
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
