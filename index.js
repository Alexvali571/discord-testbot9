const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
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

// =====================
// MONGO
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// =====================
// DB SCHEMA
// =====================
const guildSchema = new mongoose.Schema({
  guildId: String,
  allowedRoles: [String],
  deniedRoles: [
    {
      roleId: String,
      categoryId: String
    }
  ],
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
// CHECK ADMIN ROLE FUNCTION
// =====================
async function isBotAdmin(interaction) {
  const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!config || !config.botAdminRole) return false;

  return interaction.member.roles.cache.has(config.botAdminRole);
}

// =====================
// COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("syncrole")
    .setDescription("Save role for user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("denyrole")
    .setDescription("Block role in category")
    .addRoleOption(o => o.setName("role").setRequired(true))
    .addChannelOption(o => o.setName("category").setRequired(true)),

  new SlashCommandBuilder()
    .setName("allowrole")
    .setDescription("Whitelist role"),

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
  // SYNC ROLE
  // =====================
  if (commandName === "syncrole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    return interaction.reply(`✅ Saved role ${role.name} for ${user.tag}`);
  }

  // =====================
  // DENY ROLE (ADMIN ONLY)
  // =====================
  if (commandName === "denyrole") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ Nu ai acces la comanda asta", ephemeral: true });
    }

    const role = interaction.options.getRole("role");
    const category = interaction.options.getChannel("category");

    await category.permissionOverwrites.edit(role, {
      ViewChannel: false,
      SendMessages: false
    });

    return interaction.reply(`🚫 Role ${role.name} denied in ${category.name}`);
  }

  // =====================
  // ALLOW ROLE (ADMIN ONLY)
  // =====================
  if (commandName === "allowrole") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ Nu ai acces la comanda asta", ephemeral: true });
    }

    const role = interaction.options.getRole("role");

    return interaction.reply(`✅ Role ${role.name} added to system`);
  }

  // =====================
  // SET BOT ADMIN ROLE (OWNER ONLY)
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

    return interaction.reply(`🗑 Bot admin role removed: ${role.name}`);
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
