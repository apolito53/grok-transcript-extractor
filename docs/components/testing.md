# Testing and verification

```bash
npm test
npm run test:live -- https://grok.com/share/<id>
```

Offline tests cover URL rules, payload parsing, transcript formatting, the local server, the Vercel adapter, and theme bootstrap.

The live smoke script hits the current public share API and prints the title plus readable message count. Do not add live network calls to the default `npm test` suite.
