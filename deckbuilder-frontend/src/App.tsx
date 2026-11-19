import { BrowserRouter } from "react-router-dom";
import { RouteStage } from "./layout/RouteStage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <RouteStage />
    </BrowserRouter>
  );
}
