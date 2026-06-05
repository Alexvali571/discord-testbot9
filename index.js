const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
} = require("discord.js");
const mongoose = require("mongoose");

// =====================
// EXPRESS (Render keep alive)
// =====================
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const MONGO_URI = process.env.MONGO_URI;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// =====================
// MONGO
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("Mongo error:", err));

// =====================
// DB
// =====================
const guildSchema = new mongoose.Schema({
  guildId: String,
  botAdminRole: String
});

const GuildConfig = mongoose.model("GuildConfig", guildSchema);

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================
// BOT ADMIN CHECK
// =====================
async function isBotAdmin(interaction) {
  const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!config?.botAdminRole) return false;

  return interaction.member.roles.cache.has(config.botAdminRole);
}

// =====================
// LOG SYSTEM
// =====================
async function sendLog(guild, msg) {
  try {
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!ch) return;
    await ch.send(msg);
  } catch (e) {
    console.log("Log error:", e);
  }
}

// =====================
// SLASH COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("denyrole")
    .setDescription("Deny role access in a category")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Select role")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("category")
        .setDescription("Select category")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("allowbotrole")
    .setDescription("Set bot admin role")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Role allowed to use admin commands")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removebotrole")
    .setDescription("Remove bot admin role")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Role to remove from admin")
        .setRequired(true)
    )
].map(c => c.toJSON());

// =====================
// REGISTER COMMANDS
// =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });
  console.log("Commands registered");
}

// =====================
// READY
// =====================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

// =====================
// COMMAND HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // =====================
  // DENY ROLE (CATEGORY)
  // =====================
  if (commandName === "denyrole") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const role = interaction.options.getRole("role");
    const category = interaction.options.getChannel("category");

    if (category.type !== 4) {
      return interaction.reply({ content: "❌ You must select a category", ephemeral: true });
    }

    const channels = interaction.guild.channels.cache.filter(c => c.parentId === category.id);

    for (const ch of channels.values()) {
      await ch.permissionOverwrites.edit(role, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      });
    }

    await sendLog(interaction.guild,
      `🚫 DENY ROLE\nUser: ${interaction.user.tag}\nRole: ${role.name}\nCategory: ${category.name}`
    );

    return interaction.reply(`🚫 Role ${role.name} denied in ${category.name}`);
  }

  // =====================
  // SET BOT ADMIN ROLE
  // =====================
  if (commandName === "allowbotrole") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Only admin can set this", ephemeral: true });
    }

    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    config.botAdminRole = role.id;
    await config.save();

    await sendLog(interaction.guild,
      `🛡 BOT ADMIN SET\nUser: ${interaction.user.tag}\nRole: ${role.name}`
    );

    return interaction.reply(`🛡 Bot admin role set: ${role.name}`);
  }

  // =====================
  // REMOVE BOT ADMIN ROLE
  // =====================
  if (commandName === "removebotrole") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    if (config.botAdminRole === role.id) {
      config.botAdminRole = null;
      await config.save();
    }

    await sendLog(interaction.guild,
      `🗑 BOT ADMIN REMOVED\nUser: ${interaction.user.tag}\nRole: ${role.name}`
    );

    return interaction.reply(`🗑 Bot admin removed: ${role.name}`);
  }
});

// =====================
client.login(TOKEN);
