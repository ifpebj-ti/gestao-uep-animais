const API_URL = window.API_URL || "http://localhost:3000";

async function checkApiStatus() {
  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    console.log("API status:", data);
  } catch (err) {
    console.error("Não foi possível conectar à API:", err);
  }
}

document.addEventListener("DOMContentLoaded", checkApiStatus);
