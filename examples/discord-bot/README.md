# GZW Data Discord Bot Example

A small Discord slash-command bot built on the official `@zoniboy/gzw-data-client` package and the public GZW Data API.

The SDK handles the API base URL, request retries, response parsing and typed error behavior. Discord.js is used only for commands and embeds.

It provides:

- `/gzw weapon <id>` — fetch one weapon through the single-record API route
- `/gzw search <query>` — search across the public datasets

No GZW API key is required. The Discord bot token stays local in `.env` and is never sent to the API.

## Setup

Requirements: Node.js 18+ and a Discord application with a bot user.

```bash
cp .env.example .env
npm install
```

Fill in `.env`:

- `DISCORD_TOKEN`: bot token
- `DISCORD_CLIENT_ID`: Discord application ID
- `DISCORD_GUILD_ID`: optional development guild ID; guild commands register immediately
- `GZW_API_BASE_URL`: optional API override

Start the bot:

```bash
npm start
```

Without `DISCORD_GUILD_ID`, commands are registered globally and can take time to propagate. Use a guild ID during development.

## Example API calls

```bash
curl https://gzw-data.vercel.app/api/v1/weapons/ak-12
curl "https://gzw-data.vercel.app/api/v1/search?q=ak-12"
```

## Security

Never commit `.env` or paste the Discord bot token into source code. The example only requires the `Guilds` intent and does not expose credentials in Discord messages.
