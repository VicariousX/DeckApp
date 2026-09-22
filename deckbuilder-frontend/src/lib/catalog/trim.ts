/** Keep fields we render. Cuts bulk objects roughly in half. */
export function trimCard(raw: Record<string, unknown>): Record<string, unknown> {
  const faces = Array.isArray(raw.card_faces)
    ? (raw.card_faces as Record<string, unknown>[]).map((f) => ({
        name: f.name,
        mana_cost: f.mana_cost,
        type_line: f.type_line,
        oracle_text: f.oracle_text,
        flavor_text: f.flavor_text,
        artist: f.artist,
        power: f.power,
        toughness: f.toughness,
        loyalty: f.loyalty,
        image_uris: pickUris(f.image_uris),
        colors: f.colors,
        color_indicator: f.color_indicator,
      }))
    : undefined;

  return {
    object: "card",
    id: raw.id,
    oracle_id: raw.oracle_id,
    name: raw.name,
    lang: raw.lang,
    released_at: raw.released_at,
    uri: raw.uri,
    scryfall_uri: raw.scryfall_uri,
    layout: raw.layout,
    image_uris: pickUris(raw.image_uris),
    mana_cost: raw.mana_cost,
    cmc: raw.cmc,
    type_line: raw.type_line,
    oracle_text: raw.oracle_text,
    colors: raw.colors,
    color_identity: raw.color_identity,
    keywords: raw.keywords,
    legalities: raw.legalities,
    set: raw.set,
    set_name: raw.set_name,
    set_type: raw.set_type,
    collector_number: raw.collector_number,
    rarity: raw.rarity,
    artist: raw.artist,
    frame: raw.frame,
    full_art: raw.full_art,
    digital: raw.digital,
    reprint: raw.reprint,
    variation: raw.variation,
    card_faces: faces,
    power: raw.power,
    toughness: raw.toughness,
    loyalty: raw.loyalty,
  };
}

function pickUris(uris: unknown) {
  if (!uris || typeof uris !== "object") return null;
  const u = uris as Record<string, string>;
  return {
    small: u.small,
    normal: u.normal,
    large: u.large,
    art_crop: u.art_crop,
  };
}

export function nameKey(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}
