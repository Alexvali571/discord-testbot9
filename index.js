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

// ===================== DB MODELS =====================

// GUILD CONFIG
const guildSchema = new mongoose.Schema({
  guildId: String,
  botAdminRole: String
});

const GuildConfig = mongoose.model("GuildConfig", guildSchema);

// STAFF CONFIG (IMPORTANT - UN SINGUR MODEL)
const staffConfigSchema = new mongoose.Schema({
  guildId: String,
  logChannelId: String,
  freezeRoleId: String,
  suspendRoleId: String,
  demoteRoleId: String,
  staffRoleId: String,
  memberRoleId: String
});

const staffSecuritySchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    level: {
        type: Number,
        default: 1
    }

});

const StaffSecurity = mongoose.model(
    "StaffSecurity",
    staffSecuritySchema
);
// STAFF WARN
const staffWarnSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    warns: [
        {

            reason: String,
            severity: Number,
            task: String,

            moderatorId: String,

            date: {
                type: Date,
                default: Date.now
            },

            expireAt: Date

        }
    ]

});

const StaffWarn = mongoose.model(
    "StaffWarn",
    staffWarnSchema
);

// FREEZE
const staffFreezeSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    reason: String,

    expiresAt: Date,

    permissions: Object

});

const StaffFreeze = mongoose.model(
    "StaffFreeze",
    staffFreezeSchema
);

// SUSPEND
const staffSuspendSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    reason: String,

    savedRoles: [String],

    expiresAt: Date

});

const StaffSuspend = mongoose.model(
    "StaffSuspend",
    staffSuspendSchema
);

// DEMOTE
const staffDemoteSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    oldRoles: [String],

    reason: String,

    date: {
        type: Date,
        default: Date.now
    }

});

const StaffDemote = mongoose.model(
    "StaffDemote",
    staffDemoteSchema
);

// BLACKLIST
const staffBlacklistSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    reason: String,

    moderatorId: String,

    date: {
        type: Date,
        default: Date.now
    }

});

const StaffBlacklist = mongoose.model(
    "StaffBlacklist",
    staffBlacklistSchema
);

// PROBATION
const staffProbationSchema = new mongoose.Schema({

    guildId: String,
    userId: String,

    expiresAt: Date

});

const StaffProbation = mongoose.model(
    "StaffProbation",
    staffProbationSchema
);

// ===================== FREEZE SYSTEM =====================
async function freezeMember(member, durationMs, reason) {

    const config = await StaffConfig.findOne({
        guildId: member.guild.id
    });

    if (!config) return;

    const savedRoles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.id);

    await StaffFreeze.findOneAndDelete({
        guildId: member.guild.id,
        userId: member.id
    });

    await StaffFreeze.create({
        guildId: member.guild.id,
        userId: member.id,
        reason,
        expiresAt: new Date(Date.now() + durationMs),
        permissions: savedRoles
    });

    if (config.staffRoleId)
        await member.roles.remove(config.staffRoleId).catch(() => {});

    if (config.freezeRoleId)
        await member.roles.add(config.freezeRoleId).catch(() => {});

}

// ===================== SUSPEND SYSTEM =====================
async function suspendMember(member, durationMs, reason) {

    const config = await StaffConfig.findOne({
        guildId: member.guild.id
    });

    if (!config) return;

    const savedRoles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.id);

    await StaffSuspend.findOneAndDelete({
        guildId: member.guild.id,
        userId: member.id
    });

    await StaffSuspend.create({
        guildId: member.guild.id,
        userId: member.id,
        reason,
        savedRoles,
        expiresAt: new Date(Date.now() + durationMs)
    });

    if (config.staffRoleId)
        await member.roles.remove(config.staffRoleId).catch(() => {});

    if (config.suspendRoleId)
        await member.roles.add(config.suspendRoleId).catch(() => {});
}

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

async function getSecurityLevel(guildId, userId) {

    const security =
    await StaffSecurity.findOne({

        guildId,
        userId

    });

    return security?.level || 1;

}

// ===================== LOG =====================
async function sendLog(guild, msg) {
  try {
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!ch) return;
    await ch.send(msg);
  } catch {}
}

async function sendStaffLog(guild, msg) {

    try {

        const config = await StaffConfig.findOne({
            guildId: guild.id
        });

        if (!config?.logChannelId) return;

        const ch = guild.channels.cache.get(
            config.logChannelId
        );

        if (!ch) return;

        await ch.send(msg);

    } catch (err) {

        console.error(err);

    }

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
  ),

  new SlashCommandBuilder()
    .setName("copyrolrolecategory")
    .setDescription("Copy role permissions from a source channel/category to another role in another channel/category")
    .addRoleOption(o =>
      o.setName("role1")
        .setDescription("Source role")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("source")
        .setDescription("Source channel/category")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role2")
        .setDescription("Target role")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("target")
        .setDescription("Target channel/category")
        .setRequired(true)
),

  new SlashCommandBuilder()
	.setName("syncrolerole")
	.setDescription("Sync all permissions from a role to another role")
	.addRoleOption(o =>
	  o.setName("rolesource")
    	.setDescription("Source role")
    	.setRequired(true)
	)
	.addRoleOption(o =>
	  o.setName("roletarget")
	    .setDescription("Target role")
	    .setRequired(true)
),

new SlashCommandBuilder()
	.setName("warnstaff")
	.setDescription("Give a staff warn")
	.addUserOption(o =>
 	   o.setName("member")
 	   .setDescription("Staff member")
  	  .setRequired(true)
	)
	.addIntegerOption(o =>
 	   o.setName("severity")
  	  .setDescription("1-7")
  	  .setRequired(true)
 	   .addChoices(
    	    { name: "1", value: 1 },
        	{ name: "2", value: 2 },
        	{ name: "3", value: 3 },
        	{ name: "4", value: 4 },
        	{ name: "5", value: 5 },
        	{ name: "6", value: 6 },
        	{ name: "7", value: 7 }
    	)
	)
	.addStringOption(o =>
    	o.setName("reason")
    	.setDescription("Reason")
    	.setRequired(true)
	)
	.addStringOption(o =>
    	o.setName("task")
    	.setDescription("Task to remove warn")
    	.setRequired(false)
),

new SlashCommandBuilder()
	.setName("staffwarns")
	.setDescription("Show active warns")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
),

new SlashCommandBuilder()
.setName("staffhistory")
.setDescription("Show full warn history")
.addUserOption(o =>
    o.setName("member")
    .setDescription("Member")
    .setRequired(true)
),

new SlashCommandBuilder()
	.setName("removewarnstaff")
	.setDescription("Remove one warn")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addIntegerOption(o =>
    	o.setName("warn")
    	.setDescription("Warn number")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("clearstaffwarns")
	.setDescription("Remove all warns")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffsecurity")
	.setDescription("Set security level")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addIntegerOption(o =>
    	o.setName("level")
    	.setDescription("1-7")
    	.setRequired(true)
    	.addChoices(
        	{ name: "1", value: 1 },
        	{ name: "2", value: 2 },
        	{ name: "3", value: 3 },
        	{ name: "4", value: 4 },
        	{ name: "5", value: 5 },
        	{ name: "6", value: 6 },
        	{ name: "7", value: 7 }
    	)
),

new SlashCommandBuilder()
	.setName("stafffreeze")
	.setDescription("Freeze a staff")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addIntegerOption(o =>
    	o.setName("hours")
    	.setDescription("Hours")
    	.setRequired(true)
	)
	.addStringOption(o =>
    	o.setName("reason")
    	.setDescription("Reason")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("setmemberrole")
	.setDescription("Set member role for suspend system")
	.addRoleOption(o =>
    	o.setName("role")
    	.setDescription("Member role")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffunfreeze")
	.setDescription("Remove freeze")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffsuspend")
	.setDescription("Suspend staff")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addIntegerOption(o =>
    	o.setName("hours")
    	.setDescription("Hours")
    	.setRequired(true)
	)
	.addStringOption(o =>
    	o.setName("reason")
    	.setDescription("Reason")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffunsuspend")
	.setDescription("Remove suspension")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffdemote")
	.setDescription("Demote staff")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addStringOption(o =>
    	o.setName("reason")
    	.setDescription("Reason")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffblacklist")
	.setDescription("Blacklist member")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addStringOption(o =>
    	o.setName("reason")
    	.setDescription("Reason")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffunblacklist")
	.setDescription("Remove blacklist")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffprobation")
	.setDescription("Put member in probation")
	.addUserOption(o =>
    	o.setName("member")
    	.setDescription("Member")
    	.setRequired(true)
	)
	.addIntegerOption(o =>
    	o.setName("days")
    	.setDescription("Days")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("setstafflog")
	.setDescription("Set staff log channel")
	.addChannelOption(o =>
    	o.setName("channel")
    	.setDescription("Channel")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("setstafflog")
	.setDescription("Set staff log channel")
	.addChannelOption(o =>
    	o.setName("channel")
    	.setDescription("Log channel")
    	.setRequired(true)
),

new SlashCommandBuilder()
	.setName("staffinfo")
	.setDescription("View staff warnings")
	.addUserOption(o =>
	    o.setName("member")
	    .setDescription("Member")
  	  .setRequired(true)
),

new SlashCommandBuilder()
	.setName("topstaffwarns")
	.setDescription("Top staff warns")

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

	setInterval(async () => {

    const allWarns = await StaffWarn.find();

    for (const data of allWarns) {

        const before = data.warns.length;

        data.warns = data.warns.filter(
            w => w.expireAt > new Date()
        );

        if (before !== data.warns.length) {

            await data.save();

            const config = await StaffConfig.findOne({
                guildId: data.guildId
            });

            const guild = client.guilds.cache.get(
                data.guildId
            );

            if (!guild) continue;

            const logChannel =
                guild.channels.cache.get(
                    config?.logChannelId
                );

            if (logChannel) {

                logChannel.send(

`🧹 STAFF WARN EXPIRED

User ID:
${data.userId}

One or more warns expired automatically.`

                );

            }

        }

    }

}, 60 * 60 * 1000);
});
// ===================== COMMAND HANDLER =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

if (commandName === "setstafflog") {

    if (!(await isBotAdmin(interaction))) {
        return interaction.reply({
            content: "❌ No permission",
            ephemeral: true
        });
    }

    const channel = interaction.options.getChannel("channel");

    let config = await StaffConfig.findOne({
        guildId: interaction.guild.id
    });

    if (!config) {

        config = await StaffConfig.create({
            guildId: interaction.guild.id
		});
	}
		
if (commandName === "staffsecurity") {

    if (!(await isBotAdmin(interaction))) {
        return interaction.reply({
            content: "❌ No permission",
            ephemeral: true
        });
    }

    const memberUser =
        interaction.options.getUser("member");

    const level =
        interaction.options.getInteger("level");

    let security = await StaffSecurity.findOne({

        guildId: interaction.guild.id,
        userId: memberUser.id

    });

    if (!security) {

        security = await StaffSecurity.create({

            guildId: interaction.guild.id,
            userId: memberUser.id

        });

    }

    security.level = level;

    await security.save();

    await sendStaffLog(
        interaction.guild,

`🛡 STAFF SECURITY

Member: ${memberUser.tag}

Level: ${level}

Set by: ${interaction.user.tag}`
    );

    return interaction.reply({

        content:
        `✅ Security level set to ${level}`

    });

}

	if (commandName === "removewarnstaff") {

 	   if (!(await isBotAdmin(interaction))) {
     	   return interaction.reply({
     	       content: "❌ No permission",
     	       ephemeral: true
    	    });
   	 }

  	  const member =
    	    interaction.options.getUser("member");

  	  const data =
  	      await StaffWarn.findOne({

  	          guildId: interaction.guild.id,
   	         userId: member.id

    	    });

 	   if (!data || data.warns.length === 0)
 	       return interaction.reply(
 	           "❌ No warns"
	        );

  	  data.warns.pop();

  	  await data.save();

  	  return interaction.reply(
 	       "✅ Warn removed"
 	   );

	}

	if (commandName === "staffinfo") {

 	   const member =
 	       interaction.options.getUser("member");
	
  	  const data =
  	      await StaffWarn.findOne({

       	     guildId: interaction.guild.id,
      	      userId: member.id

    	    });

   	 if (!data || data.warns.length === 0)
      	  return interaction.reply(
	            "✅ No warns"
    	    );

   	 let txt = "";

 	   data.warns.forEach((w, i) => {

        txt +=
	`#${i + 1}
	Reason: ${w.reason}
	Severity: ${w.severity}
	Task: ${w.task}
	Expires: <t:${Math.floor(w.expireAt.getTime()/1000)}:R>

	`;

    	});

    	return interaction.reply(txt);

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
            flags: 64
        });
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel("channel");

    if (!channel) {
        return interaction.editReply("❌ Channel not found");
    }

    if (!channel.parentId) {
        return interaction.editReply("❌ Channel is not inside a category");
    }

    try {

        const category = await interaction.guild.channels.fetch(channel.parentId);

        if (!category) {
            return interaction.editReply("❌ Category not found");
        }

        // 🔥 LUĂM PERMISIUNILE CORECT
        const overwrites = category.permissionOverwrites.cache.map(o => {

            return {
                id: o.id,
                allow: o.allow.bitfield,
                deny: o.deny.bitfield,
                type: o.type
            };

        });

        // 🔥 RESET + APPLY
        await channel.permissionOverwrites.set(overwrites);

        await sendLog(
            interaction.guild,
            `🔄 SYNC CHANNEL\nChannel: ${channel.name}\nCategory: ${category.name}\nUser: ${interaction.user.tag}`
        );

        return interaction.editReply(
            `✅ Synced ${channel.name} with ${category.name}`
        );

    } catch (err) {

        console.error(err);

        return interaction.editReply(
            "❌ Failed to sync channel permissions"
        );

    }
}
	
if (commandName === "warnstaff") {

 	   if (!(await isBotAdmin(interaction))) {
   	     return interaction.reply({
     	       content: "❌ No permission",
    	        ephemeral: true
    	    });
	    }

	    const memberUser = interaction.options.getUser("member");
 	   const reason = interaction.options.getString("reason");
 	   const severity = interaction.options.getInteger("severity");
 	   const task = interaction.options.getString("task") || "None";

 	   const member = await interaction.guild.members.fetch(memberUser.id);

  	  let data = await StaffWarn.findOne({
    	    guildId: interaction.guild.id,
    	    userId: member.id
 	   });

 	   if (!data) {
 	       data = await StaffWarn.create({
     	       guildId: interaction.guild.id,
      	      userId: member.id,
     	       warns: []
 	       });
 	   }

  	  const warnCount = data.warns.length + 1;

	    const expireAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

	    data.warns.push({
  	      reason,
    	    severity,
 	       task,
        	moderatorId: interaction.user.id,
        	expireAt
   	 });

	    await data.save();

 	   // SECURITY LEVEL
		const security = await getSecurityLevel(interaction.guild.id, member.id);

 	   const config = await StaffConfig.findOne({
	        guildId: interaction.guild.id
 	   });

 	   let actionMsg = "";

 	   // ================= RULE SYSTEM =================
	    if (warnCount === 1) {
	        actionMsg = "Verbal warning";
	    }
	
	    if (warnCount === 2) {
 	       actionMsg = "Verbal + possible freeze";
 	       if (security >= 5) {
   	         await applyStaffAction(member, "freeze", 0, "Security freeze");
 		       }
	    }

 	   if (warnCount === 3) {
	        actionMsg = "Suspend 12h + freeze 12h";
    	    await applyStaffAction(member, "suspend", 12 * 60 * 60 * 1000, reason);
        	await applyStaffAction(member, "freeze", 12 * 60 * 60 * 1000, reason);
	    }

    	if (warnCount === 4) {
        	actionMsg = "Suspend 24h + freeze 36h";
        	await applyStaffAction(member, "suspend", 24 * 60 * 60 * 1000, reason);
        	await applyStaffAction(member, "freeze", 36 * 60 * 60 * 1000, reason);
   	 }

    	if (warnCount === 5) {
        	actionMsg = "Demote + suspend 12h + freeze 48h";
        	await applyStaffAction(member, "demote", 0, reason);
        	const config = await StaffConfig.findOne({
    guildId: interaction.guild.id
});

await applyStaffAction(
    member,
    "suspend",
    12 * 60 * 60 * 1000,
    reason,
    config
);
        	await applyStaffAction(member, "freeze", 48 * 60 * 60 * 1000, reason);
    	}
if (commandName === "warnstaff") {

    if (!(await isBotAdmin(interaction))) {
        return interaction.reply({
            content: "❌ No permission",
            ephemeral: true
        });
    }

    const memberUser =
        interaction.options.getUser("member");

    const reason =
        interaction.options.getString("reason");

    const severity =
        interaction.options.getInteger("severity");

    const task =
        interaction.options.getString("task") || "None";

    const member =
        await interaction.guild.members.fetch(
            memberUser.id
        );

    let data = await StaffWarn.findOne({

        guildId: interaction.guild.id,
        userId: member.id

    });

    if (!data) {

        data = await StaffWarn.create({

            guildId: interaction.guild.id,
            userId: member.id,
            warns: []

        });

    }

    data.warns.push({

        reason,
        severity,
        task,

        moderatorId:
        interaction.user.id,

        expireAt:
        new Date(
            Date.now() +
            14 * 24 * 60 * 60 * 1000
        )

    });

    await data.save();

    const warnCount =
        data.warns.length;

    const security =
        await getSecurityLevel(

            interaction.guild.id,
            member.id

        );
	const config = await StaffConfig.findOne({
    guildId: interaction.guild.id
});

let actionMsg = "";

let suspendHours = 0;
let freezeHours = 0;

// ===== SECURITY =====

if (security === 2) {

    freezeHours += 6;

}

if (security === 3) {
	
    freezeHours += 16;

}

if (security === 4) {

    freezeHours += 48;

}

if (security === 5) {

    suspendHours += 24;
    freezeHours += 12;

}

if (security === 6) {

    suspendHours += 48;
    freezeHours += 24;

}
	
if (security === 7) {

    suspendHours += 72;
    freezeHours += 36;

}

// ===== WARN 1 =====

if (warnCount === 1) {

    actionMsg = "Verbal warning";

}

// ===== WARN 2 =====

if (warnCount === 2) {

    actionMsg = "Verbal warning + security punishments";

}

// ===== WARN 3 =====

if (warnCount === 3) {

    suspendHours += 12;
    freezeHours += 12;

    actionMsg =
        `Suspend ${suspendHours}h + Freeze ${freezeHours}h`;

}

// ===== WARN 4 =====

if (warnCount === 4) {

    suspendHours += 24;
    freezeHours += 36;

    actionMsg =
        `Suspend ${suspendHours}h + Freeze ${freezeHours}h`;

}

// ===== WARN 5 =====

if (warnCount === 5) {

    suspendHours += 12;
    freezeHours += 48;

    actionMsg =
        `Demote + Suspend ${suspendHours}h + Freeze ${freezeHours}h`;
	
	try {

        await member.send(
            "⚠️ You have 4 warns. The next warn may result in permanent staff removal."
        );

    } catch {}

}

    if (config?.demoteRoleId) {

        await member.roles.add(
            config.demoteRoleId
        ).catch(() => {});

    }

}

// ===== WARN 6 =====

if (warnCount >= 6) {

    actionMsg = "REMOVE STAFF";

    if (config?.staffRoleId) {

        await member.roles.remove(
            config.staffRoleId
        ).catch(() => {});

    }

	}

	// ===== APPLY SUSPEND =====

if (suspendHours > 0) {

    await member.timeout(

        suspendHours * 60 * 60 * 1000,
        reason

    ).catch(() => {});

}

// ===== APPLY FREEZE ROLE =====

if (

    freezeHours > 0 &&
    config?.freezeRoleId

) {

    await member.roles.add(
        config.freezeRoleId
    ).catch(() => {});

}

// ===== APPLY SUSPEND ROLE =====

if (

    suspendHours > 0 &&
    config?.suspendRoleId

) {

    await member.roles.add(
        config.suspendRoleId
    ).catch(() => {});

}

	try {

    await member.send(

`⚠️ STAFF WARNING

Reason:
${reason}

Severity:
${severity}

Task to remove warn:
${task}

Current warns:
${warnCount}/6

Action:
${actionMsg}

This warn expires in 14 days.`

    );

} catch {}

	if (warnCount === 5) {

    try {

        await member.send(

`⚠️ WARNING

You have 5 staff warns.

The next warn may result in permanent removal from staff depending on severity.`

        );

    } catch {}

}

	const logChannel = interaction.guild.channels.cache.get(
    config?.logChannelId
);

if (logChannel) {

    await logChannel.send(

`🚨 STAFF WARN

Member:
${member.user.tag}

Moderator:
${interaction.user.tag}

Reason:
${reason}

Severity:
${severity}

Task:
${task}

Warn:
${warnCount}/6

Action:
${actionMsg}

Expires:
<t:${Math.floor(expireAt.getTime()/1000)}:R>`

    );

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

    const security = await getSecurityLevel(interaction.guild.id, member.id);

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

  // ===================== COPY ROLE -> ROLE =====================
	if (commandName === "copyrolrolecategory") {

		if (!(await isBotAdmin(interaction))) {
			return interaction.reply({
				content: "❌ No permission",
				ephemeral: true
			});
		}

		const role1 = interaction.options.getRole("role1");
		const source = interaction.options.getChannel("source");

		const role2 = interaction.options.getRole("role2");
		const target = interaction.options.getChannel("target");

		try {

			const perms = source.permissionOverwrites.cache.get(role1.id);

			if (!perms) {
				return interaction.reply({
					content: "❌ Source role has no permissions in source channel/category",
					ephemeral: true
				});
			}

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

			await target.permissionOverwrites.edit(role2, {
				...allowData,
				...denyData
			});

			await sendLog(
				interaction.guild,
				`🔄 COPY ROLE TO ROLE
          Source role: ${role1.name}
          Source: ${source.name}
          Target role: ${role2.name}
          Target: ${target.name}
          User: ${interaction.user.tag}`
			);

			return interaction.reply(
				`✅ Copied permissions from ${role1.name} (${source.name}) to ${role2.name} (${target.name})`
			);

		} catch (err) {

			console.error(err);

			return interaction.reply({
				content: "❌ Error while copying permissions",
				ephemeral: true
			});

		}

	}

	// ===================== SYNC ROLE ROLE =====================
	if (commandName === "syncrolerole") {

		if (!(await isBotAdmin(interaction))) {
			return interaction.reply({
				content: "❌ No permission",
				ephemeral: true
			});
		}

		const roleSource = interaction.options.getRole("rolesource");
		const roleTarget = interaction.options.getRole("roletarget");

		let count = 0;

		try {

			for (const ch of interaction.guild.channels.cache.values()) {

				const perms = ch.permissionOverwrites.cache.get(roleSource.id);

				if (!perms) continue;

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

				await ch.permissionOverwrites.edit(roleTarget, {
					...allowData,
					...denyData
				});

				count++;

			}

			await sendLog(
				interaction.guild,
				`🔄 SYNC ROLE ROLE
Source: ${roleSource.name}
Target: ${roleTarget.name}
User: ${interaction.user.tag}`
			);

			return interaction.reply(
				`✅ Synchronized ${count} channels/categories from ${roleSource.name} to ${roleTarget.name}`
			);

		} catch (err) {

			console.error(err);

			return interaction.reply({
				content: "❌ Error while syncing roles",
				ephemeral: true
			});

		}
	}

	if (commandName === "setmemberrole") {

	    if (!(await isBotAdmin(interaction))) {
	        return interaction.reply({
  	          content: "❌ No permission",
    	        ephemeral: true
	        });
	    }

  	  const role = interaction.options.getRole("role");

	    let config = await StaffConfig.findOne({
   	     guildId: interaction.guild.id
	    });

 	   if (!config) {
    	    config = await StaffConfig.create({
         	   guildId: interaction.guild.id
       	 });
  	  }

 	   config.memberRoleId = role.id;
  	  await config.save();
	
    	return interaction.reply(`✅ Member role set to ${role.name}`);
	}

	if (commandName === "setstafflog") {

    	if (!(await isBotAdmin(interaction))) {
        	return interaction.reply({
            	content: "❌ No permission",
            	ephemeral: true
        	});
    	}

    	const channel = interaction.options.getChannel("channel");

    	let config = await StaffConfig.findOne({
        	guildId: interaction.guild.id
    	});

	    if (!config) {

    	    config = await StaffConfig.create({
        	    guildId: interaction.guild.id
       	 });

    	}

    	config.logChannelId = channel.id;

    	await config.save();

    	return interaction.reply({
        	content: `✅ Staff log channel set to ${channel}`,
        	ephemeral: false
    	});

	}

	if (commandName === "staffsecurity") {

	    if (!(await isBotAdmin(interaction))) {
    	    return interaction.reply({
        	    content: "❌ No permission",
        	    ephemeral: true
       	 });
   	 }

   	 const memberUser =
    	    interaction.options.getUser("member");

   	 const level =
   	     interaction.options.getInteger("level");

   	 let security = await StaffSecurity.findOne({

    	    guildId: interaction.guild.id,
    	    userId: memberUser.id

 	   });

 	   if (!security) {

    	    security = await StaffSecurity.create({

    	        guildId: interaction.guild.id,
    	        userId: memberUser.id

    	    });

   	 }

    	security.level = level;

	    await security.save();

    	await sendStaffLog(
    	    interaction.guild,

	`🛡 STAFF SECURITY

	Member: ${memberUser.tag}

	Level: ${level}

	Set by: ${interaction.user.tag}`
    	);

  	  return interaction.reply({

    	    content:
  	      `✅ Security level set to ${level}`

  	  });

	}


	if (commandName === "warnstaff") {

   	 if (!(await isBotAdmin(interaction))) {
  	      return interaction.reply({
        	    content: "❌ No permission",
        	    ephemeral: true
     	   });
  	  }

  	  const memberUser =
	        interaction.options.getUser("member");

	    const reason =
  	      interaction.options.getString("reason");

		    const severity =
    		    interaction.options.getInteger("severity");
	
	    const task =
	        interaction.options.getString("task") || "None";

	    const member =
    	    await interaction.guild.members.fetch(
        	    memberUser.id
        	);

    	let data = await StaffWarn.findOne({

        	guildId: interaction.guild.id,
       	 userId: member.id

    	});

 	   if (!data) {

 	       data = await StaffWarn.create({

     	       guildId: interaction.guild.id,
    	        userId: member.id,
    	        warns: []

    	    });

	    }

	    data.warns.push({

     	   reason,
    	    severity,
 	       task,

    	    moderatorId:
    	    interaction.user.id,

    	    expireAt:
    	    new Date(
    	        Date.now() +
    	        14 * 24 * 60 * 60 * 1000
    	    )

 	   });

 	   await data.save();

 	   const warnCount =
  	      data.warns.length;

		const security = await StaffSecurity.findOne({
 		 guildId: interaction.guild.id,
 		 userId: member.id
	});
}
};
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
