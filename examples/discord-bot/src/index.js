import "dotenv/config";
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  GZW_API_BASE_URL = "https://gzw-data.vercel.app/api",
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
}

const commands = [
  new SlashCommandBuilder()
    .setName("gzw")
    .setDescription("Look up Gray Zone Warfare data")
    .addSubcommand((command) =>
      command
        .setName("weapon")
        .setDescription("Look up a weapon by its exact API ID")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("For example: ak-12")
            .setRequired(true),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName("search")
        .setDescription("Search across the GZW datasets")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("For example: ak-12")
            .setRequired(true),
        ),
    )
    .toJSON(),
];

const apiUrl = (path) => `${GZW_API_BASE_URL.replace(/\/$/, "")}${path}`;

async function fetchJson(path) {
  const response = await fetch(apiUrl(path));
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `GZW API returned HTTP ${response.status}`);
  }
  return payload;
}

function trimValue(value, maxLength = 1024) {
  const text = String(value ?? "—");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function recordEmbed(record, title = record.name || record.id || "GZW record") {
  const embed = new EmbedBuilder()
    .setTitle(trimValue(title, 256))
    .setColor(0xd9775f)
    .setFooter({ text: "GZW Data API · gzw-data.vercel.app" });

  for (const [key, value] of Object.entries(record)) {
    if (["id", "name", "image"].includes(key) || value === null || value === undefined) continue;
    if (embed.data.fields?.length >= 8) break;
    embed.addFields({
      name: trimValue(key.replaceAll("_", " "), 256),
      value: trimValue(Array.isArray(value) ? value.join(", ") : value),
      inline: true,
    });
  }

  if (record.image && /^https?:\/\//.test(record.image)) embed.setThumbnail(record.image);
  return embed;
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Registered commands (${DISCORD_GUILD_ID ? "guild" : "global"})`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "gzw") return;

  await interaction.deferReply();
  try {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "weapon") {
      const id = interaction.options.getString("id", true);
      const payload = await fetchJson(`/weapons/${encodeURIComponent(id)}`);
      await interaction.editReply({ embeds: [recordEmbed(payload.data)] });
      return;
    }

    const query = interaction.options.getString("query", true);
    const payload = await fetchJson(`/search?q=${encodeURIComponent(query)}`);
    const results = payload.data?.results ?? {};
    const records = Object.entries(results).flatMap(([dataset, items]) =>
      items.slice(0, 3).map((record) => ({ dataset, record })),
    );

    if (!records.length) {
      await interaction.editReply(`No GZW records found for **${query}**.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`GZW search: ${query}`)
      .setColor(0xd9775f)
      .setDescription(records.map(({ dataset, record }) => `**${dataset}** · ${record.name || record.id}`).join("\n"))
      .setFooter({ text: "GZW Data API · gzw-data.vercel.app" });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply(`Could not load GZW data: ${error.message}`);
  }
});

await registerCommands();
await client.login(DISCORD_TOKEN);
