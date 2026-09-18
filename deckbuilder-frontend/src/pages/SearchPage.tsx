import { useSearchParams } from "react-router-dom";
import { CardSearch } from "../components/CardSearch";
import { AdvancedSearch } from "../components/search/AdvancedSearch";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";

export function SearchPage() {
  const [params] = useSearchParams();
  const mode = params.get("mode") === "advanced" ? "advanced" : "standard";

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      {mode === "advanced" ? (
        <AdvancedSearch initialQuery={params.get("q") ?? ""} />
      ) : (
        <CardSearch mode="standard" />
      )}
    </div>
  );
}
