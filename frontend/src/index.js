import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Keep backend alive (ping every 10 minutes)
setInterval(() => {
  fetch(`${process.env.REACT_APP_BACKEND_URL}/health`).catch(() => {});
}, 10 * 60 * 1000);
