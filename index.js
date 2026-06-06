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

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error(err);
  process.exit(1);
});

// ===================== EXPRESS =====================
const app = express();

app.get("/", (req, res) => res.send("Bot is running"));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    discord: client?.ws?.status === 0 ? "online" : "offline",
    uptime: process.uptime()
  });
});

app.get("/health", (req, res) => {
  if (!client.isReady()) {
    return res.status(500).send("Discord Offline");
  }

  res.status(200).send("Discord Online");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Express running on port", PORT);
});
// ===================== ENV =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const MONGO_URI = process.env.MONGO_URI;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ===================== MONGO =====================
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

mongoose.connection.on("disconnected", () => {
  console.log("❌ MongoDB disconnected");
});

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected");
});

// ===================== DB =====================
const guildSchema = new mongoose.Schema({
  guildId: String,
  botAdminRole: String
});

const GuildConfig = mongoose.model("GuildConfig", guildSchema);

// ===================== CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.on("shardDisconnect", () => {
  console.log("⚠️ Shard disconnected → restart");
  process.exit(1);
});

client.on("shardReconnecting", () => {
  console.log("🔄 Shard reconnecting...");
});

client.on("shardResume", () => {
  console.log("✅ Shard resumed");
  heartbeat();
});

client.on("disconnect", () => {
  console.log("⚠️ Disconnected, reconnecting...");
  startBot();
});

client.on("shardDisconnect", () => {
  console.log("⚠️ Shard disconnected");
});

client.on("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

client.on("shardDisconnect", (event, id) => {
  console.log("❌ Shard disconnected", id, event?.code);
});

client.on("shardReconnecting", (id) => {
  console.log("🔄 Shard reconnecting", id);
});

client.on("shardResume", (id, replayed) => {
  console.log("✅ Shard resumed", id, replayed);
});

setInterval(() => {
  console.log(
    "Status:",
    client.ws.status,
    "Ping:",
    client.ws.ping
  );

  if (client.ws.status !== 0) {
    console.log("❌ Discord gateway lost. Restarting process...");
    process.exit(1);
  }
}, 60000);

setInterval(() => {
  if (client?.user) {
    console.log(`🟢 Alive as ${client.user.tag}`);
  } else {
    console.log("🟡 Bot not ready yet");
  }
}, 60000);

setInterval(() => {
  if (!client.isReady()) {
    console.log("❌ Bot dead → restart");
    process.exit(1);
  }
}, 120000);

let lastHeartbeat = Date.now();

function heartbeat() {
  lastHeartbeat = Date.now();
}

// ================🔧 SAFE HANDLERS====================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.on("error", console.error);
client.on("warn", console.warn);

// ===================== BOT ADMIN CHECK =====================
async function isBotAdmin(interaction) {
  const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!config?.botAdminRole) return false;

  return interaction.member.roles.cache.has(config.botAdminRole);
}

// ===================== LOG =====================
async function sendLog(guild, msg) {
  try {
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!ch) return;
    await ch.send(msg);
  } catch {}
}

// ===================== COMMANDS =====================
const commands = [

  new SlashCommandBuilder()
    .setName("syncrole")
    .setDescription("Sync role permissions from category to all categories")
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
    .setName("denyrole")
    .setDescription("Deny role in channel or category")
    .addRoleOption(o =>
      o.setName("role")
      .setDescription("Select role")
      .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("target")
      .setDescription("Select channel or category")
      .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("allowbotrole")
    .setDescription("Set bot admin role")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Select role")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removebotrole")
    .setDescription("Remove bot admin role")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Select role")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("copyrolemember")
    .setDescription("Copy role permissions to member (category or all)")
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("Select role")
        .setRequired(true)
    )
    .addUserOption(o =>
      o.setName("member")
        .setDescription("Select member")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("category")
        .setDescription("Select category")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("category or alls")
        .setRequired(true)
        .addChoices(
          { name: "category", value: "category" },
          { name: "alls", value: "alls" }
        )
    ),

  new SlashCommandBuilder()
    .setName("syncchannel")
    .setDescription("Sync channel permissions with its category")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Select channel")
        .setRequired(true)
  ),

  new SlashCommandBuilder()
    .setName("synccategory")
    .setDescription("Sync all channels in a category with category permissions")
    .addChannelOption(o =>
      o.setName("category")
        .setDescription("Select category")
        .setRequired(true)
  ),

  new SlashCommandBuilder()
    .setName("copychannelp")
    .setDescription("Copy all permissions from one channel to another")
    .addChannelOption(o =>
      o.setName("source")
        .setDescription("Channel with permissions")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("target")
        .setDescription("Channel to receive permissions")
        .setRequired(true)
  )

].map(c => c.toJSON());

// ===================== REGISTER =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Commands registered");
}

// ===================== READY =====================
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  heartbeat();

  await register();

  // heartbeat la fiecare 30 sec
  setInterval(() => {
    heartbeat();
    console.log("💓 heartbeat OK");
  }, 30000);
});
// ===================== COMMAND HANDLER =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "syncchannel") {

  if (!(await isBotAdmin(interaction))) {
    return interaction.reply({
      content: "❌ No permission",
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel("channel");

  if (!channel.parentId) {
    return interaction.reply({
      content: "❌ Channel is not inside a category",
      ephemeral: true
    });
  }

  try {
    const category = await interaction.guild.channels.fetch(channel.parentId);

    if (!category) {
      return interaction.reply({
        content: "❌ Category not found",
        ephemeral: true
      });
    }

    // 🔥 aici se face sync-ul REAL
    await channel.lockPermissions();

    await sendLog(
      interaction.guild,
      `🔄 SYNC CHANNEL\nChannel: ${channel.name}\nCategory: ${category.name}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply({
      content: `✅ Synced ${channel.name} with ${category.name}`,
      ephemeral: false
    });

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Failed to sync channel",
      ephemeral: true
    });
  }
}

  if (commandName === "synccategory") {

  if (!(await isBotAdmin(interaction))) {
    return interaction.reply({
      content: "❌ No permission",
      ephemeral: true
    });
  }

  const category = interaction.options.getChannel("category");

  if (!category || category.type !== 4) { // 4 = Category
    return interaction.reply({
      content: "❌ Please select a valid category",
      ephemeral: true
    });
  }

  try {
    const channels = interaction.guild.channels.cache.filter(
      c => c.parentId === category.id
    );

    let count = 0;

    for (const ch of channels.values()) {
      await ch.permissionOverwrites.set(category.permissionOverwrites.cache);
      count++;
    }

    await sendLog(
      interaction.guild,
      `🔄 SYNC CATEGORY\nCategory: ${category.name}\nChannels: ${count}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply({
      content: `✅ Synced ${count} channels in ${category.name}`,
      ephemeral: false
    });

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Failed to sync category",
      ephemeral: true
    });
  }
}

if (commandName === "syncchannel") {

  if (!(await isBotAdmin(interaction))) {
    return interaction.reply({
      content: "❌ No permission",
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel("channel");

  if (!channel || !channel.parentId) {
    return interaction.reply({
      content: "❌ Channel is not inside a category",
      ephemeral: true
    });
  }

  try {
    const category = await interaction.guild.channels.fetch(channel.parentId);

    const categoryPerms = category.permissionOverwrites.cache;

    // reset channel to category perms
    await channel.permissionOverwrites.set(categoryPerms);

    await sendLog(
      interaction.guild,
      `🔄 SYNC CHANNEL\nChannel: ${channel.name}\nCategory: ${category.name}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply({
      content: `✅ ${channel.name} synced with ${category.name}`,
      ephemeral: false
    });

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Failed to sync channel",
      ephemeral: true
    });
  }
}

// ===================== SYNCROLE =====================
if (commandName === "syncrole") {

  if (!(await isBotAdmin(interaction))) {
    return interaction.reply({
      content: "❌ No permission",
      ephemeral: true
    });
  }

  const role = interaction.options.getRole("role");
  const category = interaction.options.getChannel("category");

  const sourceOverwrite =
    category.permissionOverwrites.cache.get(role.id);

  if (!sourceOverwrite) {
    return interaction.reply({
      content: "❌ Role has no permissions in selected category",
      ephemeral: true
    });
  }

  try {

    const permissions = {};

    for (const perm of PermissionsBitField.FlagsKeys ?? Object.keys(PermissionsBitField.Flags)) {

      const flag = PermissionsBitField.Flags[perm];

      if (sourceOverwrite.allow.has(flag)) {
        permissions[perm] = true;
      }
      else if (sourceOverwrite.deny.has(flag)) {
        permissions[perm] = false;
      }

    }

    const categories =
      interaction.guild.channels.cache.filter(
        c => c.type === 4
      );

    for (const cat of categories.values()) {
      await cat.permissionOverwrites.edit(role, permissions);
    }

    await sendLog(
      interaction.guild,
      `🔁 SYNC ROLE
Role: ${role.name}
Source: ${category.name}
User: ${interaction.user.tag}`
    );

    return interaction.reply(
      `✅ Copied all role permissions from ${category.name}`
    );

  } catch (err) {
    console.error(err);

    return interaction.reply({
      content: "❌ Failed to sync role",
      ephemeral: true
    });
  }
}

// ===================== DENYROLE =====================
if (commandName === "denyrole") {

  if (!(await isBotAdmin(interaction))) {
    return interaction.reply({
      content: "❌ No permission",
      ephemeral: true
    });
  }

  const role = interaction.options.getRole("role");
  const target = interaction.options.getChannel("target");

  const denyAll = {};

  for (const perm of Object.keys(PermissionsBitField.Flags)) {
    denyAll[perm] = false;
  }

  try {

    // pune toate permisiunile pe X
    await target.permissionOverwrites.edit(role, denyAll);

    // dacă este categorie sincronizează toate canalele
    if (target.type === 4) {

      const channels = interaction.guild.channels.cache.filter(
        c => c.parentId === target.id
      );

      for (const ch of channels.values()) {
        await ch.lockPermissions();
      }

    }

    await sendLog(
      interaction.guild,
      `🚫 DENY ROLE\nRole: ${role.name}\nTarget: ${target.name}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply(`🚫 ${role.name} denied in ${target.name}`);

  } catch (err) {

    console.error(err);

    return interaction.reply({
      content: "❌ Error",
      ephemeral: true
    });

  }

}

  // ===================== ALLOW BOT ROLE =====================
  if (commandName === "allowbotrole") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Only admin", ephemeral: true });
    }

    const role = interaction.options.getRole("role");

    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });

    config.botAdminRole = role.id;
    await config.save();

    await sendLog(interaction.guild,
      `🛡 BOT ADMIN SET\nRole: ${role.name}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply(`🛡 Bot admin set`);
  }

  // ===================== REMOVE BOT ROLE =====================
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
      `🗑 BOT ADMIN REMOVED\nRole: ${role.name}\nUser: ${interaction.user.tag}`
    );

    return interaction.reply(`🗑 Removed bot admin role`);
  }

  // ===================== COPYROLEMEMBER =====================
  if (commandName === "copyrolemember") {
    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    const role = interaction.options.getRole("role");
    const memberUser = interaction.options.getUser("member");
    const category = interaction.options.getChannel("category");
    const mode = interaction.options.getString("mode");

    const member = await interaction.guild.members.fetch(memberUser.id);

const applyPerms = async (ch) => {

  const perms = ch.permissionOverwrites.cache.get(role.id);
  if (!perms) return;

  const allowData = {};
  const denyData = {};

  for (const perm of Object.keys(PermissionsBitField.Flags)) {

    if (perms.allow.has(perm)) {
      allowData[perm] = true;
    }

    if (perms.deny.has(perm)) {
      denyData[perm] = false;
    }

  }

  await ch.permissionOverwrites.edit(member, {
    ...allowData,
    ...denyData
  });

};

    const categoryChannels = interaction.guild.channels.cache.filter(
      c => c.parentId === category.id
    );

    if (mode === "category") {

      // categoria însăși
      await applyPerms(category);

      // toate canalele din categorie
      for (const ch of categoryChannels.values()) {
        await applyPerms(ch);
      }

    }

    if (mode === "alls") {
      const all = interaction.guild.channels.cache.filter(c => c.parentId);
      for (const ch of all.values()) {
        await applyPerms(ch);
      }
    }

    await sendLog(interaction.guild,
      `📋 COPY ROLE MEMBER\nRole: ${role.name}\nMember: ${member.user.tag}\nMode: ${mode}`
    );

    return interaction.reply(`✅ Copied permissions`);
  }

  // ===================== COPYCHANNELP =====================
  if (commandName === "copychannelp") {

    if (!(await isBotAdmin(interaction))) {
      return interaction.reply({
        content: "❌ No permission",
        ephemeral: true
      });
    }

    const source = interaction.options.getChannel("source");
    const target = interaction.options.getChannel("target");

    try {

    // copiază toate permisiunile tuturor rolurilor și membrilor
      await target.permissionOverwrites.set(
        source.permissionOverwrites.cache
      );

      await sendLog(
        interaction.guild,
        `📋 COPY CHANNEL PERMISSIONS\nSource: ${source.name}\nTarget: ${target.name}\nUser: ${interaction.user.tag}`
      );

      return interaction.reply({
        content: `✅ Copied permissions from ${source.name} to ${target.name}`
      });

    } catch (err) {

      console.error(err);

      return interaction.reply({
        content: "❌ Failed to copy permissions",
        ephemeral: true
      });

    }

  }
});

// =====================
console.log("Starting bot...");

function startBot() {
  client.login(TOKEN)
    .then(() => console.log("✅ Logged in successfully"))
    .catch(err => {
      console.error("❌ Login error:", err);
      setTimeout(startBot, 5000); // retry după 5 sec
    });
}

startBot();

setInterval(() => {
  const diff = Date.now() - lastHeartbeat;

  console.log("⏱ watchdog check:", diff, "ms");

  // 2 minute fără semnal = restart
  if (diff > 120000) {
    console.log("💀 Bot frozen → restarting process...");
    process.exit(1);
  }
}, 30000);
