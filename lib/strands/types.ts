export type StrandsPuzzle = {
  status: string;
  id: number;
  printDate: string;
  clue: string;
  startingBoard: string[];
  rows: number;
  cols: number;
  themeWordCount: number;
};

export type StrandsSubmitResult = {
  kind: "theme" | "spangram" | "other";
  word: string;
};
