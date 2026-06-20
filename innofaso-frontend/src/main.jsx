import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.jsx";

console.log("main.jsx loaded");
console.log("Root element:", document.getElementById("root"));

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found!");
  document.body.innerHTML = '<div style="color:red; font-size:24px; padding:20px;">ERROR: Root element not found!</div>';
} else {
  console.log("Root element found, mounting React");
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error("Error mounting React:", error);
    document.body.innerHTML = '<div style="color:red; font-size:24px; padding:20px;">ERROR: ' + error.message + '</div>';
  }
}
