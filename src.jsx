import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components.jsx";
import { Students, Groups } from "./legacy.jsx";
import "./style.css";
createRoot(document.getElementById("root")).render(
  <App Students={Students} Groups={Groups} />,
);
