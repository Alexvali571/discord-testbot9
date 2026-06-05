const express = require("express");
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const mongoose = require("mongoose");

// =====================
// EXPRESS (IMPORTANT pentru Render)
// =====================
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server is running");
});

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const MONGO_URI = process.env.MONGO_URI;

// =====================
// MONGO DB
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log("MongoDB error:", err));

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// =====================
// COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("syncrole")
    .setDescription("Save role for user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("denyrole")
    .setDescription("Remove role from user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("copyrolemember")
    .setDescription("Copy roles from one user to another")
    .addUserOption(o => o.setName("from").setDescription("From").setRequired(true))
    .addUserOption(o => o.setName("to").setDescription("To").setRequired(true)),

  new SlashCommandBuilder()
    .setName("allowbotrole")
    .setDescription("Enable bot role actions"),

  new SlashCommandBuilder()
    .setName("removebotrole")
    .setDescription("Disable bot role actions")
].map(c => c.toJSON());

// register commands
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands
    });
    console.log("Slash commands registered");
  } catch (err) {
    console.log(err);
  }
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

  // syncrole
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

  // denyrole
  if (commandName === "denyrole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    const member = await interaction.guild.members.fetch(user.id);
    await member.roles.remove(role);

    return interaction.reply(`❌ Removed role from ${user.tag}`);
  }

  // copy roles
  if (commandName === "copyrolemember") {
    const from = interaction.options.getUser("from");
    const to = interaction.options.getUser("to");

    const fromMember = await interaction.guild.members.fetch(from.id);
    const toMember = await interaction.guild.members.fetch(to.id);

    await toMember.roles.set(fromMember.roles.cache);

    return interaction.reply(`📋 Copied roles from ${from.tag} to ${to.tag}`);
  }

  // allow bot role
  if (commandName === "allowbotrole") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    return interaction.reply("✅ Bot role actions enabled");
  }

  // remove bot role
  if (commandName === "removebotrole") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    return interaction.reply("🗑 Bot role actions disabled");
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);