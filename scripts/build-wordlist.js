// Build JSON arrays from data word sources for 4/5/6 letters
const fs = require('fs');
const path = require('path');

const sources = [
  { len: 4, input: '4-letter-words-processed-new.txt', output: '4_letter_words.json' },
  { len: 5, input: '5_letter_words', output: '5_letter_words.json' },
  { len: 6, input: 'six-letter-words.txt', output: '6_letter_words.json' },
];

function buildLen({ len, input, output }) {
  const inputPath = path.resolve(__dirname, '..', 'data', input);
  const outputPath = path.resolve(__dirname, '..', 'data', output);
  if (!fs.existsSync(inputPath)) {
    console.warn(`Skip len=${len}: input not found at ${inputPath}`);
    return;
  }
  const raw = fs.readFileSync(inputPath, 'utf8');
  const set = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (new RegExp(`^[a-z]{${len}}$`).test(w)) set.add(w);
  }
  const words = Array.from(set);
  words.sort();
  fs.writeFileSync(outputPath, JSON.stringify(words, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${words.length} ${len}-letter words to ${outputPath}`);
}

function main() {
  for (const cfg of sources) {
    buildLen(cfg);
  }
}

main();
