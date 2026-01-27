// Build JSON array from data/5_letter_words (newline-separated)
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '..', 'data', '5_letter_words');
const outputPath = path.resolve(__dirname, '..', 'data', '5_letter_words.json');

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const set = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (/^[a-z]{5}$/.test(w)) set.add(w);
  }
  const words = Array.from(set);
  words.sort();
  fs.writeFileSync(outputPath, JSON.stringify(words, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${words.length} words to ${outputPath}`);
}

main();
