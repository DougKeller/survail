interface CardPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
}

interface CardFace {
  name: string;
  image_uris: { normal: string | null } | null;
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string;
  oracle_text: string | null;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  finishes: string[];
  image_uris: { normal: string | null } | null;
  card_faces: CardFace[];
  legalities: Record<string, string>;
  colors?: string[];
  color_identity?: string[];
  cmc?: number;
  prices?: CardPrices;
  released_at?: string | null;
  border_color?: string | null;
  frame?: string | null;
  frame_effects?: string[];
  universes_beyond?: boolean;
}
