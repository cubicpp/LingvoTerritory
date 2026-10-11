import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Restore theme
const saved = localStorage.getItem("dialect-viz-theme") || "dark";
document.documentElement.setAttribute("data-theme", saved);

root.render(<App />);
