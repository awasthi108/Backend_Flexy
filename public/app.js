const API_BASE = "window.location.origin";

// State
let currentReservation = null;
let countdownInterval = null;
let products = [];

// Generate a simple user ID (in production, this would come from auth)
const userId = `user_${Math.random().toString(36).substr(2, 9)}`;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();

  // Setup button handlers
  document
    .getElementById("confirm-btn")
    ?.addEventListener("click", confirmReservation);
  document
    .getElementById("cancel-btn")
    ?.addEventListener("click", cancelReservation);
});

/**
 * Load all products and display them
 */
async function loadProducts() {
  try {
    const skus = ["IPHONE_15", "AIRPODS_PRO", "PIXEL_8", "SAMSUNG_S23"];
    const productPromises = skus.map((sku) =>
      fetch(`${API_BASE}/inventory/${sku}`).then((r) => r.json())
    );
    const results = await Promise.all(productPromises);

    products = results.map((result) => result.data).filter(Boolean);
    renderProducts();
  } catch (error) {
    showMessage("Failed to load products", "error");
    console.error("Error loading products:", error);
  }
}

/**
 * Render product cards
 */
function renderProducts() {
  const container = document.getElementById("products");
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div class="loading">Loading products...</div>';
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
        <div class="product-card">
            <h3>${formatProductName(product.sku)}</h3>
            <div class="sku">SKU: ${product.sku}</div>
            <div class="quantity ${getQuantityClass(
              product.availableQuantity
            )}">
                Available: ${product.availableQuantity}
            </div>
            <div class="stock-indicator ${getStockClass(
              product.availableQuantity
            )}">
                ${getStockMessage(product.availableQuantity)}
            </div>
            <button 
                class="btn btn-primary" 
                onclick="reserveProduct('${product.sku}', 1)"
                ${product.availableQuantity === 0 ? "disabled" : ""}
            >
                ${
                  product.availableQuantity === 0
                    ? "Out of Stock"
                    : "Reserve Now"
                }
            </button>
        </div>
    `
    )
    .join("");
}

/**
 * Format product name for display
 */
function formatProductName(sku) {
  return sku
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get CSS class for quantity display
 */
function getQuantityClass(quantity) {
  if (quantity === 0) return "out";
  if (quantity <= 2) return "low";
  return "available";
}

/**
 * Get CSS class for stock indicator
 */
function getStockClass(quantity) {
  if (quantity === 0) return "out-of-stock";
  if (quantity <= 2) return "low-stock";
  return "in-stock";
}

/**
 * Get stock message
 */
function getStockMessage(quantity) {
  if (quantity === 0) return "Out of Stock";
  if (quantity === 1) return "Only 1 item left!";
  if (quantity <= 2) return `Only ${quantity} items left!`;
  return "In Stock";
}

/**
 * Reserve a product
 */
async function reserveProduct(sku, quantity) {
  try {
    showMessage("Reserving item...", "info");

    const response = await fetch(`${API_BASE}/inventory/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        sku,
        quantity,
      }),
    });

    const result = await response.json();

    if (result.success) {
      currentReservation = {
        reservationId: result.reservationId,
        sku,
        quantity,
        expiresAt: new Date(result.expiresAt),
      };

      showMessage(
        `Reservation successful! You have 5 minutes to confirm.`,
        "success"
      );
      showReservationInfo();
      startCountdown();
      loadProducts(); // Refresh product list
    } else {
      showMessage(result.error || "Failed to reserve item", "error");
    }
  } catch (error) {
    showMessage("Network error. Please try again.", "error");
    console.error("Error reserving product:", error);
  }
}

/**
 * Show reservation info panel
 */
function showReservationInfo() {
  const panel = document.getElementById("reservation-info");
  const details = document.getElementById("reservation-details");

  if (!panel || !details || !currentReservation) return;

  panel.classList.remove("hidden");
  details.innerHTML = `
        <p><strong>Product:</strong> ${formatProductName(
          currentReservation.sku
        )}</p>
        <p><strong>SKU:</strong> ${currentReservation.sku}</p>
        <p><strong>Quantity:</strong> ${currentReservation.quantity}</p>
        <p><strong>Reservation ID:</strong> ${
          currentReservation.reservationId
        }</p>
    `;
}

/**
 * Start countdown timer
 */
function startCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const countdownEl = document.getElementById("countdown");
  if (!countdownEl || !currentReservation) return;

  function updateCountdown() {
    if (!currentReservation) return;

    const now = new Date();
    const expiresAt = currentReservation.expiresAt;
    const diff = expiresAt - now;

    if (diff <= 0) {
      countdownEl.textContent = "Reservation Expired";
      countdownEl.className = "countdown expired";
      clearInterval(countdownInterval);
      showMessage(
        "Your reservation has expired. Please reserve again.",
        "error"
      );
      currentReservation = null;
      document.getElementById("reservation-info")?.classList.add("hidden");
      loadProducts();
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    countdownEl.textContent = `Time remaining: ${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;

    if (minutes < 1) {
      countdownEl.className = "countdown warning";
    } else {
      countdownEl.className = "countdown";
    }
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Confirm reservation
 */
async function confirmReservation() {
  if (!currentReservation) return;

  try {
    showMessage("Confirming reservation...", "info");

    const response = await fetch(`${API_BASE}/checkout/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reservationId: currentReservation.reservationId,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showMessage("Purchase confirmed! Thank you for your order.", "success");
      currentReservation = null;
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      document.getElementById("reservation-info")?.classList.add("hidden");
      loadProducts();
    } else {
      showMessage(result.error || "Failed to confirm reservation", "error");
      if (result.error === "Reservation expired") {
        currentReservation = null;
        document.getElementById("reservation-info")?.classList.add("hidden");
        loadProducts();
      }
    }
  } catch (error) {
    showMessage("Network error. Please try again.", "error");
    console.error("Error confirming reservation:", error);
  }
}

/**
 * Cancel reservation
 */
async function cancelReservation() {
  if (!currentReservation) return;

  try {
    showMessage("Cancelling reservation...", "info");

    const response = await fetch(`${API_BASE}/checkout/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reservationId: currentReservation.reservationId,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showMessage("Reservation cancelled. Inventory released.", "info");
      currentReservation = null;
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      document.getElementById("reservation-info")?.classList.add("hidden");
      loadProducts();
    } else {
      showMessage(result.error || "Failed to cancel reservation", "error");
    }
  } catch (error) {
    showMessage("Network error. Please try again.", "error");
    console.error("Error cancelling reservation:", error);
  }
}

/**
 * Show message to user
 */
function showMessage(text, type = "info") {
  const messageEl = document.getElementById("message");
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;

  // Auto-hide after 5 seconds for success/info messages
  if (type !== "error") {
    setTimeout(() => {
      messageEl.classList.remove("show");
    }, 5000);
  }
}
