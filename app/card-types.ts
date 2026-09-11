export type Card = {
  id: number;
  number: string;
  rarity: string;
  ord: number;
  set_name: string;
  character: string;
  title: string;
  image_path: string | null;
  image_missing?: boolean;
};

export type SetRecord = { name: string; group: string; images: string[] };
export type CardDatabase = { cards: Card[]; sets: SetRecord[] };
