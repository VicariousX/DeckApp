export type Card = {
  id: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: {
    small?: string;
    normal?: string;
  };
};

export function CardResult({ card }: { card: Card }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        padding: "1rem",
        borderBottom: "1px solid #ddd"
      }}
    >
      {card.image_uris?.small && (
        <img
          src={card.image_uris.small}
          alt={card.name}
          style={{ width: "120px", borderRadius: "4px" }}
        />
      )}

      <div>
        <h2 style={{ margin: 0 }}>{card.name}</h2>
        {card.mana_cost && <p>{card.mana_cost}</p>}
        <p>{card.type_line}</p>
        {card.oracle_text && <p>{card.oracle_text}</p>}
      </div>
    </div>
  );
}
