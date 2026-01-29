export type ConnectionsCard = {
  content: string;
  position: number;
};

export type ConnectionsCategory = {
  title: string;
  cards: ConnectionsCard[];
};

export type ConnectionsPuzzle = {
  status: string;
  id: number;
  print_date: string;
  editor?: string;
  categories: ConnectionsCategory[];
};
