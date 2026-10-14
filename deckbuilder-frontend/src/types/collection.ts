export type CollectionOwnership = "physical" | "digital" | "na";

export type Collection = {
  id: string;
  user_id: string;
  name: string;
  ownership: CollectionOwnership;
  print_specific: boolean;
  quantity_counters: boolean;
  is_public: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionInput = {
  name: string;
  ownership: CollectionOwnership;
  print_specific: boolean;
  quantity_counters: boolean;
  is_public: boolean;
  is_default: boolean;
};
