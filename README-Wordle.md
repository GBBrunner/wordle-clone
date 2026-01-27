# Wordle Clone (Daily + Endless)

- Purpose: Cross-platform Wordle with a daily puzzle and an endless mode that continues with random words after you finish the daily.
- Daily word source: By default, the daily word is chosen deterministically from a local open word list based on the date. To match an external source, you can provide your own endpoint.

## Run

```bash
# From the project root
npm install
npm run web   # start in the browser
npm run android  # Android emulator/device
npm run ios      # iOS simulator (macOS required)
```

## Configure Daily Word (Optional)

- Set an environment variable `EXPO_PUBLIC_DAILY_WORD_URL` to a URL that returns the 5-letter daily solution as plain text.
- Example (PowerShell on Windows):

```powershell
$env:EXPO_PUBLIC_DAILY_WORD_URL = "https://your-domain.example/daily-word.txt"; npx expo start --web
```

Notes:
- We do not scrape or bundle any proprietary NYT content. If you have a permitted source that provides the daily word, use the env var above.
- The local daily algorithm uses a base date (2021-06-19) and cycles through the included word list.

## Files

- Main screen: [app/index.tsx](app/index.tsx)
- Game logic: [lib/wordle/engine.ts](lib/wordle/engine.ts)
- Word list: [data/words.ts](data/words.ts)
- UI components: [components/Board.tsx](components/Board.tsx), [components/Keyboard.tsx](components/Keyboard.tsx)

## Next Steps

- Expand `data/words.ts` with a larger open, non-proprietary 5-letter word list.
- Add persistence (e.g., keep daily progress) and share-state if desired.
- Add animations and accessibility improvements.
