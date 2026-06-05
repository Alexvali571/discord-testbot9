const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const mongoose = require("mongoose");

// =====================
// EXPRESS (Render fix)
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
  .catch(err => console.log(err));

// =====================
// DB
// =====================
const guildSchema = new mongoose.Schema({
  guildId: String,
  allowedRoles: [String],
  botAdminRole: String
});

const GuildConfig = mongoose.model("GuildConfig", guildSchema);

// =====================
// DISCORD CLIENT
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
  if (!config || !config.botAdminRole) return false;

  return interaction.member.roles.cache.has(config.botAdminRole);
}

// =====================
// LOG SYSTEM
// =====================
async function sendLog(guild, message) {
  try {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!channel) return;
    await channel.send(message);
  } catch (err) {
    console.log("Log error:", err);
  }
}

// =====================
// COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("denyrole")
    .setDescription("Deny role in category")
    .addRoleOption(o => o.setName("role").setRequired(true))
    .addChannelOption(o => o.setName("category").setRequired(true)),

  new SlashCommandBuilder()
    .setName("allowbotrole")
    .setDescription("Set bot admin role")
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removebotrole")
    .setDescription("Remove bot admin role")
    .addRoleOption(o => o.setName("role").setRequired(true))
].map(c => c.toJSON());

// register
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
}

// =====================
// READY
// =====================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

// =====================
// COMMAND HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // =====================
  // DENY ROLE (FULL CATEGORY)
  // =====================
  if (commandName === "denyrole") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ Nu ai acces la comanda asta", ephemeral: true });
    }

    const role = interaction.options.getRole("role");
    const category = interaction.options.getChannel("category");

    if (category.type !== 4) {
      return interaction.reply({ content: "❌ Trebuie să alegi o categorie", ephemeral: true });
    }

    const channels = interaction.guild.channels.cache.filter(
      c => c.parentId === category.id
    );

    for (const channel of channels.values()) {
      await channel.permissionOverwrites.edit(role, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      });
    }

    await sendLog(interaction.guild,
      `🚫 DENY ROLE\nUser: ${interaction.user.tag}\nRole: ${role.name}\nCategory: ${category.name}`
    );

    return interaction.reply(`🚫 Rolul ${role.name} a fost blocat în ${category.name}`);
  }

  // =====================
  // SET BOT ADMIN ROLE
  // =====================
  if (commandName === "allowbotrole") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Doar admin poate seta asta", ephemeral: true });
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
      return interaction.reply({ content: "❌ Nu ai acces la comanda asta", ephemeral: true });
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

    return interaction.reply(`🗑 Bot admin role removed: ${role.name}`);
  }
});

// =====================
client.login(TOKEN);
