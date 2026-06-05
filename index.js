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

// =====================
// MONGO CONNECT
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// =====================
// DATABASE
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

// sync roles (optional tracking)
const roleSchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  roleId: String
});

const RoleData = mongoose.model("RoleData", roleSchema);

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
// SLASH COMMANDS
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
    .setDescription("Add role to whitelist")
    .addRoleOption(o => o.setName("role").setRequired(true)),

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
// AUTO SYNC SYSTEM (IMPORTANT)
// =====================
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));

  const config = await GuildConfig.findOne({ guildId: newMember.guild.id });
  if (!config) return;

  for (const role of addedRoles.values()) {

    // ❌ DENY CHECK
    const denied = config.deniedRoles.find(d => d.roleId === role.id);
    if (denied) {
      const channel = newMember.guild.channels.cache.get(denied.categoryId);
      if (channel) {
        await channel.permissionOverwrites.edit(role, {
          ViewChannel: false,
          SendMessages: false
        });
      }
    }

    // ❌ WHITELIST CHECK
    if (config.allowedRoles.length > 0 && !config.allowedRoles.includes(role.id)) {
      console.log(`Role ${role.name} is not allowed but still added`);
    }
  }
});

// =====================
// COMMAND HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ---------------- SYNC ROLE ----------------
  if (commandName === "syncrole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    await RoleData.create({
      guildId: interaction.guild.id,
      userId: user.id,
      roleId: role.id
    });

    return interaction.reply(`✅ Saved role for ${user.tag}`);
  }

  // ---------------- DENY ROLE ----------------
  if (commandName === "denyrole") {
    const role = interaction.options.getRole("role");
    const category = interaction.options.getChannel("category");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    config.deniedRoles.push({
      roleId: role.id,
      categoryId: category.id
    });

    await config.save();

    await category.permissionOverwrites.edit(role, {
      ViewChannel: false,
      SendMessages: false
    });

    return interaction.reply(`🚫 Role ${role.name} denied in ${category.name}`);
  }

  // ---------------- ALLOW ROLE ----------------
  if (commandName === "allowrole") {
    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    if (!config.allowedRoles.includes(role.id)) {
      config.allowedRoles.push(role.id);
    }

    await config.save();

    return interaction.reply(`✅ Role ${role.name} added to whitelist`);
  }

  // ---------------- BOT ADMIN ROLE ----------------
  if (commandName === "allowbotrole") {
    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    config.botAdminRole = role.id;
    await config.save();

    return interaction.reply(`🛡 Bot admin role set: ${role.name}`);
  }

  if (commandName === "removebotrole") {
    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    if (config.botAdminRole === role.id) {
      config.botAdminRole = null;
    }

    await config.save();

    return interaction.reply(`🗑 Bot admin role removed: ${role.name}`);
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
