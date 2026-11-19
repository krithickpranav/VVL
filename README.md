# Lorry Trip Accounts Manager

Responsive React app for creating trip sheets, recording freight and expenses, reviewing saved trips, and calculating driver settlements.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Create and saved trip sheets are stored in the browser's local storage.

## Production build

```sh
npm run build
npm run preview
```

PDF reports download as `<transporter name> <trip sheet number>.pdf`; the default trip sheet number is `NOV 26-001`.
