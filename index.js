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
 
// ===================== EXPRESS =====================
const app = express();
 
app.get("/", (req, res) => res.send("Bot is running"));
 
app.get("/health", (req, res) => {
    if (!client.isReady()) return res.status(500).json({ status: "offline" });
    res.status(200).json({ status: "online", uptime: process.uptime(), ping: client.ws.ping });
});
 
app.get("/ping", (req, res) => res.status(200).send("pong"));
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Express running on port", PORT));
 
// ===================== ENV =====================
const TOKEN      = process.env.TOKEN;
const CLIENT_ID  = process.env.CLIENT_ID;
const MONGO_URI  = process.env.MONGO_URI;
 
// ===================== MONGO =====================
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 })
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB error:", err));
 
mongoose.connection.on("disconnected", () => console.log("❌ MongoDB disconnected"));
mongoose.connection.on("connected",    () => console.log("✅ MongoDB connected"));
 
// ===================== DB MODELS =====================
 
const GuildConfig = mongoose.model("GuildConfig", new mongoose.Schema({
    guildId:    String,
    botAdminRole: String
}));
 
const staffWarnSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warns: [
        {
            warnId: Number,
            reason: String,
            severity: Number,
            task: String,
            moderatorId: String,
            date: { type: Date, default: Date.now },
            expireAt: Date,
            active: { type: Boolean, default: true },
            removed: { type: Boolean, default: false },
            removedBy: String,
            removedAt: Date,
            removeReason: String
        }
    ]
});
 
const StaffConfig = mongoose.model("StaffConfig", new mongoose.Schema({
    guildId:      String,
    logChannelId: String,
    freezeRoleId: String,
    suspendRoleId: String,
    demoteRoleId: String,
    staffRoleId:  String,
    memberRoleId: String
}));
 
const StaffSecurity = mongoose.model("StaffSecurity", new mongoose.Schema({
    guildId: String,
    userId:  String,
    level:   { type: Number, default: 1 }
}));
 
const StaffWarn = mongoose.model("StaffWarn", staffWarnSchema);

const staffHierarchy = [

"Owner",
"Founder",
"Co-Owner",
"Co-Founder",
"Manager General",
"Sub-Manager General",
"Supervizor",
"ADMIN Manager",
"Mod Manager",
"⭐",
"HR Manager",
"Public Relation",
"Advanced ADMIN",
"Advanced Moderator",
"Event Manager",
"Event Coordonater",
"Media Manager",
"Tester Manager",
"Rute Tester Leader",
"Helper Leader",
"ADMIN",
"Moderator",
"Event Team",
"Convoy-Helper",
"Media Team",
"Rute Tester",
"Tester",
"Helper"

];
 
const StaffFreeze = mongoose.model("StaffFreeze", new mongoose.Schema({
    guildId: String,
    userId: String,
    reason: String,
    expiresAt: Date,

    savedRoles: [String],

    permissions: Object
}));
 
const StaffSuspend = mongoose.model("StaffSuspend", new mongoose.Schema({
    guildId:    String,
    userId:     String,
    reason:     String,
    savedRoles: [String],
    expiresAt:  Date
}));
 
const StaffDemote = mongoose.model("StaffDemote", new mongoose.Schema({
    guildId:  String,
    userId:   String,
    oldRoles: [String],
    reason:   String,
    date:     { type: Date, default: Date.now }
}));
 
const StaffBlacklist = mongoose.model("StaffBlacklist", new mongoose.Schema({
    guildId:     String,
    userId:      String,
    reason:      String,
    moderatorId: String,
    date:        { type: Date, default: Date.now }
}));
 
const StaffProbation = mongoose.model("StaffProbation", new mongoose.Schema({
    guildId:   String,
    userId:    String,
    expiresAt: Date
}));
 
// ===================== HELPERS =====================
 
async function isBotAdmin(interaction) {
    const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config?.botAdminRole) return false;
    return interaction.member.roles.cache.has(config.botAdminRole);
}
 
async function getSecurityLevel(guildId, userId) {
    const s = await StaffSecurity.findOne({ guildId, userId });
    return s?.level || 1;
}
 
async function sendLog(guild, msg) {
    try {
        const config = await StaffConfig.findOne({ guildId: guild.id });
        if (!config?.logChannelId) return;
        const ch = guild.channels.cache.get(config.logChannelId);
        if (!ch) return;
        await ch.send(msg);
    } catch (err) {
        console.error("[sendLog error]", err);
    }
}
 
// ===================== FREEZE / SUSPEND HELPERS =====================
 
async function freezeMember(member, durationMs, reason) {
    const config = await StaffConfig.findOne({ guildId: member.guild.id });
    if (!config) return;
 
    await StaffFreeze.findOneAndDelete({ guildId: member.guild.id, userId: member.id });
   const savedRoles = member.roles.cache
.filter(r => r.id !== member.guild.id)
.map(r => r.id);

await StaffFreeze.create({

    guildId: member.guild.id,

    userId: member.id,

    reason,

    expiresAt: new Date(
        Date.now() + durationMs
    ),

    savedRoles,

    permissions: {}

});

    const keepRoles=[];

if(config.memberRoleId)
keepRoles.push(config.memberRoleId);

if(config.verifyRoleId)
keepRoles.push(config.verifyRoleId);

await member.roles.set(keepRoles);

if(config.freezeRoleId)
await member.roles.add(config.freezeRoleId);

const staffHierarchy = [

"Owner",
"Founder",
"Co-Owner",
"Co-Founder",
"Manager General",
"Sub-Manager General",
"Supervizor",
"ADMIN Manager",
"Mod Manager",
"⭐",
"HR Manager",
"Public Relation",
"Advanced ADMIN",
"Advanced Moderator",
"Event Manager",
"Event Coordonater",
"Media Manager",
"Tester Manager",
"Rute Tester Leader",
"Helper Leader",
"ADMIN",
"Moderator",
"Event Team",
"Convoy-Helper",
"Media Team",
"Rute Tester",
"Tester",
"Helper"

];

const highestRoleName =
staffHierarchy.find(roleName =>
member.roles.cache.some(r => r.name === roleName)
);

const highestRole =
member.guild.roles.cache.find(
r => r.name === highestRoleName
);

for(const channel of member.guild.channels.cache.values()){

const overwrite=
channel.permissionOverwrites.cache.get(
highestRole.id
);

if(!overwrite) continue;

await channel.permissionOverwrites.edit(
member,
{
ViewChannel:
overwrite.allow.has("ViewChannel"),

Connect:
overwrite.allow.has("Connect")
}
).catch(()=>{});

}

}
 
async function suspendMember(member, durationMs, reason) {
    const config = await StaffConfig.findOne({ guildId: member.guild.id });
    if (!config) return;
 
    const savedRoles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.id);
 
    await StaffSuspend.findOneAndDelete({ guildId: member.guild.id, userId: member.id });
    await StaffSuspend.create({
        guildId:   member.guild.id,
        userId:    member.id,
        reason,
        savedRoles,
        expiresAt: new Date(Date.now() + durationMs)
    });
 
    if (config.staffRoleId)   await member.roles.remove(config.staffRoleId).catch(() => {});
    if (config.suspendRoleId) await member.roles.add(config.suspendRoleId).catch(() => {});
}
 
// ===================== CLIENT =====================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});
 
client.on("error", console.error);
client.on("warn",  console.warn);
 
client.on("shardDisconnect", (event, id) => {
    console.log("❌ Shard disconnected", id, event?.code);
    process.exit(1);
});
client.on("shardReconnecting", id => console.log("🔄 Shard reconnecting", id));
client.on("shardResume", (id, replayed) => {
    console.log("✅ Shard resumed", id, replayed);
    heartbeat();
});
 
let lastHeartbeat = Date.now();
function heartbeat() { lastHeartbeat = Date.now(); }
 
setInterval(() => {
    console.log("Status:", client.ws.status, "Ping:", client.ws.ping);
    if (client.ws.status !== 0) {
        console.log("❌ Discord gateway lost. Restarting...");
        process.exit(1);
    }
}, 60000);
 
setInterval(() => {
    if (client?.user) console.log(`🟢 Alive as ${client.user.tag}`);
    else console.log("🟡 Bot not ready yet");
}, 60000);
 
setInterval(() => {
    if (!client.isReady()) { console.log("❌ Bot dead → restart"); process.exit(1); }
}, 120000);
 
setInterval(() => {
    const diff = Date.now() - lastHeartbeat;
    console.log("⏱ watchdog check:", diff, "ms");
    if (diff > 120000) { console.log("💀 Bot frozen → restarting..."); process.exit(1); }
}, 30000);
 
process.on("unhandledRejection", console.error);
process.on("uncaughtException",  console.error);
 
// ===================== COMMANDS =====================
const commands = [
    new SlashCommandBuilder()
        .setName("syncrole")
        .setDescription("Sync role permissions from category to all categories")
        .addRoleOption(o => o.setName("role").setDescription("Select role").setRequired(true))
        .addChannelOption(o => o.setName("category").setDescription("Select category").setRequired(true)),
    new SlashCommandBuilder()
        .setName("synccategory")
        .setDescription("Sync all channels in a category with category permissions")
        .addChannelOption(o => o.setName("category").setDescription("Select category").setRequired(true)),
    new SlashCommandBuilder()
        .setName("syncchannel")
        .setDescription("Sync channel permissions with its category")
        .addChannelOption(o => o.setName("channel").setDescription("Select channel").setRequired(true)),
    new SlashCommandBuilder()
        .setName("warnstaff")
        .setDescription("Give a staff warn")
        .addUserOption(o => o.setName("member").setDescription("Staff member").setRequired(true))
        .addIntegerOption(o => o.setName("severity").setDescription("1-7").setRequired(true)
            .addChoices(
                { name: "1", value: 1 }, { name: "2", value: 2 }, { name: "3", value: 3 },
                { name: "4", value: 4 }, { name: "5", value: 5 }, { name: "6", value: 6 },
                { name: "7", value: 7 }
            ))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
        .addStringOption(o => o.setName("task").setDescription("Task to remove warn").setRequired(false)),
    new SlashCommandBuilder()
        .setName("denyrole")
        .setDescription("Deny role in channel or category")
        .addRoleOption(o => o.setName("role").setDescription("Select role").setRequired(true))
        .addChannelOption(o => o.setName("target").setDescription("Select channel or category").setRequired(true)),
    new SlashCommandBuilder()
        .setName("allowbotrole")
        .setDescription("Set bot admin role")
        .addRoleOption(o => o.setName("role").setDescription("Select role").setRequired(true)),
    new SlashCommandBuilder()
        .setName("removebotrole")
        .setDescription("Remove bot admin role")
        .addRoleOption(o => o.setName("role").setDescription("Select role").setRequired(true)),
    new SlashCommandBuilder()
        .setName("copyrolemember")
        .setDescription("Copy role permissions to member (category or all)")
        .addRoleOption(o => o.setName("role").setDescription("Select role").setRequired(true))
        .addUserOption(o => o.setName("member").setDescription("Select member").setRequired(true))
        .addChannelOption(o => o.setName("category").setDescription("Select category").setRequired(true))
        .addStringOption(o => o.setName("mode").setDescription("category or alls").setRequired(true)
            .addChoices({ name: "category", value: "category" }, { name: "alls", value: "alls" })),
    new SlashCommandBuilder()
        .setName("copychannelp")
        .setDescription("Copy all permissions from one channel to another")
        .addChannelOption(o => o.setName("source").setDescription("Channel with permissions").setRequired(true))
        .addChannelOption(o => o.setName("target").setDescription("Channel to receive permissions").setRequired(true)),
    new SlashCommandBuilder()
        .setName("copyrolrolecategory")
        .setDescription("Copy role permissions from a source channel/category to another role in another channel/category")
        .addRoleOption(o => o.setName("role1").setDescription("Source role").setRequired(true))
        .addChannelOption(o => o.setName("source").setDescription("Source channel/category").setRequired(true))
        .addRoleOption(o => o.setName("role2").setDescription("Target role").setRequired(true))
        .addChannelOption(o => o.setName("target").setDescription("Target channel/category").setRequired(true)),
    new SlashCommandBuilder()
        .setName("syncrolerole")
        .setDescription("Sync all permissions from a role to another role")
        .addRoleOption(o => o.setName("rolesource").setDescription("Source role").setRequired(true))
        .addRoleOption(o => o.setName("roletarget").setDescription("Target role").setRequired(true)),
    new SlashCommandBuilder()
        .setName("setmemberrole")
        .setDescription("Set member role for suspend system")
        .addRoleOption(o => o.setName("role").setDescription("Member role").setRequired(true)),
    new SlashCommandBuilder()
        .setName("setstafflog")
        .setDescription("Set staff log channel")
        .addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffsecurity")
        .setDescription("Set security level")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("level").setDescription("1-7").setRequired(true)
            .addChoices(
                { name: "1", value: 1 }, { name: "2", value: 2 }, { name: "3", value: 3 },
                { name: "4", value: 4 }, { name: "5", value: 5 }, { name: "6", value: 6 },
                { name: "7", value: 7 }
            )),
    new SlashCommandBuilder()
        .setName("removewarnstaff")
        .setDescription("Remove one warn by number")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("warn").setDescription("Warn number").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for removing warn").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffinfo")
        .setDescription("View staff warnings")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffwarns")
        .setDescription("Show active warns")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffhistory")
        .setDescription("Show full warn history")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("clearstaffwarns")
        .setDescription("Remove all warns")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("stafffreeze")
        .setDescription("Freeze a staff member")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("hours").setDescription("Hours").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffunfreeze")
        .setDescription("Remove freeze")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffsuspend")
        .setDescription("Suspend staff member")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("hours").setDescription("Hours").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffunsuspend")
        .setDescription("Remove suspension")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffdemote")
        .setDescription("Demote staff member")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffblacklist")
        .setDescription("Blacklist member")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffunblacklist")
        .setDescription("Remove blacklist")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true)),
    new SlashCommandBuilder()
        .setName("staffprobation")
        .setDescription("Put member in probation")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("days").setDescription("Days").setRequired(true)),
    new SlashCommandBuilder()
        .setName("topstaffwarns")
        .setDescription("Top staff warns"),
    new SlashCommandBuilder()
        .setName("removewarnhistory")
        .setDescription("Remove warn from history")
        .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
        .addIntegerOption(o => o.setName("warnid").setDescription("Warn ID").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
].map(c => c.toJSON());
 
// ===================== REGISTER =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);
 
async function register() {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Commands registered");
}
 
// ===================== READY =====================
client.once("ready", async () => {
    console.log(`🟢 Logged in as ${client.user.tag}`);
    heartbeat();
    await register();
 
    setInterval(() => { heartbeat(); console.log("💓 heartbeat OK"); }, 30000);
 
    // Auto-expire warns every hour
    setInterval(async () => {
        try {
            const allWarns = await StaffWarn.find();
            for (const data of allWarns) {
                let changed = false;
                for (const warn of data.warns) {
                    if (warn.active && !warn.removed && warn.expireAt <= new Date()) {
                        warn.active = false;
                        changed = true;
                    }
                }
                if (changed) {
                    await data.save();
                    const guild = client.guilds.cache.get(data.guildId);
                    if (!guild) continue;
                    await sendLog(guild,
`🧹 STAFF WARN EXPIRED
 
User ID: ${data.userId}
 
One or more warns expired automatically.`
                    );
                }
            }
        } catch (err) {
            console.error("[warn expiry error]", err);
        }
    }, 60 * 60 * 1000);
});
 
// ===================== COMMAND HANDLER =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
 
    const { commandName } = interaction;
 
    // ===================== 1. SYNCROLE =====================
    if (commandName === "syncrole") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role     = interaction.options.getRole("role");
        const category = interaction.options.getChannel("category");
        const sourceOw = category.permissionOverwrites.cache.get(role.id);
 
        if (!sourceOw)
            return interaction.reply({ content: "❌ Role has no permissions in selected category", ephemeral: true });
 
        try {
            const permissions = {};
            for (const perm of Object.keys(PermissionsBitField.Flags)) {
                const flag = PermissionsBitField.Flags[perm];
                if (sourceOw.allow.has(flag))      permissions[perm] = true;
                else if (sourceOw.deny.has(flag))  permissions[perm] = false;
            }
 
            const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
            for (const cat of categories.values())
                await cat.permissionOverwrites.edit(role, permissions);
 
            await sendLog(interaction.guild,
`🔁 SYNC ROLE
 
Role: ${role.name}
Source category: ${category.name}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(`✅ Synced **${role.name}** to all categories (source: **${category.name}**)`);
 
        } catch (err) {
            console.error("[syncrole]", err);
            return interaction.reply({ content: "❌ Failed to sync role", ephemeral: true });
        }
    }
 
    // ===================== 2. SYNCCATEGORY =====================
    if (commandName === "synccategory") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const category = interaction.options.getChannel("category");
        if (!category || category.type !== 4)
            return interaction.reply({ content: "❌ Please select a valid category", ephemeral: true });
 
        try {
            const channels = interaction.guild.channels.cache.filter(c => c.parentId === category.id);
            let count = 0;
            for (const ch of channels.values()) {
                await ch.permissionOverwrites.set(category.permissionOverwrites.cache);
                count++;
            }
 
            await sendLog(interaction.guild,
`🔄 SYNC CATEGORY
 
Category: ${category.name}
Channels synced: ${count}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(`✅ Synced **${count}** channels in **${category.name}**`);
 
        } catch (err) {
            console.error("[synccategory]", err);
            return interaction.reply({ content: "❌ Failed to sync category", ephemeral: true });
        }
    }
 
    // ===================== 3. SYNCCHANNEL =====================
    if (commandName === "syncchannel") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        await interaction.deferReply();
 
        const channel = interaction.options.getChannel("channel");
 
        if (!channel)
            return interaction.editReply("❌ Channel not found");
 
        const validTypes = [0, 2, 5, 13, 15, 16];
        if (!validTypes.includes(channel.type))
            return interaction.editReply("❌ Invalid channel type");
 
        if (!channel.parentId)
            return interaction.editReply("❌ Channel is not inside a category");
 
        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has("ManageRoles") || !botMember.permissions.has("ManageChannels"))
            return interaction.editReply("❌ Bot does not have ManageRoles / ManageChannels permissions");
 
        try {
            const category = await interaction.guild.channels.fetch(channel.parentId);
            if (!category) return interaction.editReply("❌ Category not found");
 
            const overwrites = category.permissionOverwrites.cache.map(o => ({
                id:   o.id,
                allow: o.allow.toArray(),
                deny:  o.deny.toArray(),
                type:  o.type
            }));
 
            await channel.permissionOverwrites.set(overwrites);
 
            await sendLog(interaction.guild,
`🔄 SYNC CHANNEL
 
Channel: ${channel.name} (${channel.id})
Category: ${category.name}
Overwrites applied: ${overwrites.length}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.editReply(
                `✅ Synced **${channel.name}** with category **${category.name}** (${overwrites.length} overwrites applied)`
            );
 
        } catch (err) {
            console.error("[syncchannel]", err);
            return interaction.editReply(`❌ Failed to sync: \`${err.message}\``);
        }
    }
 
    // ===================== 4. WARNSTAFF =====================
    if (commandName === "warnstaff") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const reason     = interaction.options.getString("reason");
        const severity   = interaction.options.getInteger("severity");
        const task       = interaction.options.getString("task") || "None";
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
 
        let data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: member.id });
 
        if (!data) {
            data = await StaffWarn.create({ guildId: interaction.guild.id, userId: member.id, warns: [] });
        }
 
        if (data.warns.length >= 6) {
            return interaction.reply({ content: "❌ Nu se pot da mai mult de 6 warn-uri staff-urilor.", ephemeral: true });
        }
 
        const expireAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
 
        data.warns.push({
            warnId: data.warns.length + 1,
            reason,
            severity,
            task,
            moderatorId: interaction.user.id,
            expireAt,
            active: true,
            removed: false
        });
 
        await data.save();
 
        const warnCount = data.warns.length;
 
        let suspendHours = 0;
        let freezeHours = 0;
 
        switch (severity) {
            case 1: freezeHours = 1; break;
            case 2: freezeHours = 3; break;
            case 3: freezeHours = 6; break;
            case 4: suspendHours = 6;  freezeHours = 12; break;
            case 5: suspendHours = 12; freezeHours = 24; break;
            case 6: suspendHours = 24; freezeHours = 36; break;
            case 7: suspendHours = 48; freezeHours = 48; break;
        }
 
        suspendHours += (warnCount - 1) * 6;
        freezeHours  += (warnCount - 1) * 6;
 
        let actionMsg = `Suspend ${suspendHours}h + Freeze ${freezeHours}h`;
 
        if (warnCount === 5) {
            try {
                await member.send(
`⚠️ STAFF WARNING NOTICE
 
You currently have 5/6 staff warns.
Next warn may result in permanent staff removal.`
                );
            } catch {}
        }
 
        if (warnCount === 6) {
            if (config?.staffRoleId)
                await member.roles.remove(config.staffRoleId).catch(() => {});
 
            try {
                await member.send(
`🚫 STAFF REMOVAL
 
You have reached 6/6 staff warns.
Your staff role has been permanently removed.`
                );
            } catch {}
 
            actionMsg = "REMOVE STAFF";
        }
 
        if (suspendHours > 0)
            await member.timeout(suspendHours * 60 * 60 * 1000, reason).catch(() => {});
 
        if (freezeHours > 0 && config?.freezeRoleId)
            await member.roles.add(config.freezeRoleId).catch(() => {});
 
        if (config?.suspendRoleId && suspendHours > 0)
            await member.roles.add(config.suspendRoleId).catch(() => {});
 
        try {
            await member.send(
`⚠️ STAFF WARNING
 
Reason: ${reason}
Severity: ${severity}
Task: ${task}
Warns: ${warnCount}/6
Action: ${actionMsg}
 
Expires in 14 days.`
            );
        } catch {}
 
        await sendLog(interaction.guild,
`🚨 STAFF WARN
 
Member: ${member.user.tag} (${member.id})
Moderator: ${interaction.user.tag}
Reason: ${reason}
Severity: ${severity}
Task: ${task}
Warns: ${warnCount}/6
Action: ${actionMsg}
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        const expireTimestamp = Math.floor(expireAt.getTime() / 1000);
 
        return interaction.reply(
`⚠️ **STAFF WARN**
 
👤 Member: <@${member.id}> (${member.user.tag})
👮 Moderator: <@${interaction.user.id}> (${interaction.user.tag})
 
📝 Reason: ${reason}
 
📊 Warn Count: ${warnCount}/6
🔴 Severity: ${severity}
📋 Task: ${task}
⚙️ Action: ${actionMsg}
 
⏰ Expires: <t:${expireTimestamp}:F> (<t:${expireTimestamp}:R>)`
        );
    }
 
    // ===================== 5. DENYROLE =====================
    if (commandName === "denyrole") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role   = interaction.options.getRole("role");
        const target = interaction.options.getChannel("target");
 
        const denyAll = {};
        for (const perm of Object.keys(PermissionsBitField.Flags)) denyAll[perm] = false;
 
        try {
            await target.permissionOverwrites.edit(role, denyAll);
 
            if (target.type === 4) {
                const channels = interaction.guild.channels.cache.filter(c => c.parentId === target.id);
                for (const ch of channels.values()) await ch.lockPermissions();
            }
 
            await sendLog(interaction.guild,
`🚫 DENY ROLE
 
Role: ${role.name} (${role.id})
Target: ${target.name} (${target.id})
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(`🚫 **${role.name}** denied in **${target.name}**`);
 
        } catch (err) {
            console.error("[denyrole]", err);
            return interaction.reply({ content: "❌ Error", ephemeral: true });
        }
    }
 
    // ===================== 6. ALLOWBOTROLE =====================
    if (commandName === "allowbotrole") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return interaction.reply({ content: "❌ Only server admins can use this", ephemeral: true });
 
        const role = interaction.options.getRole("role");
 
        let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });
 
        config.botAdminRole = role.id;
        await config.save();
 
        await sendLog(interaction.guild,
`🛡 BOT ADMIN ROLE SET
 
Role: ${role.name} (${role.id})
Set by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`🛡 Bot admin role set to **${role.name}**`);
    }
 
    // ===================== 7. REMOVEBOTROLE =====================
    if (commandName === "removebotrole") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role = interaction.options.getRole("role");
 
        let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (!config) config = await GuildConfig.create({ guildId: interaction.guild.id });
 
        if (config.botAdminRole === role.id) {
            config.botAdminRole = null;
            await config.save();
        }
 
        await sendLog(interaction.guild,
`🗑 BOT ADMIN ROLE REMOVED
 
Role: ${role.name} (${role.id})
Removed by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`🗑 Removed bot admin role **${role.name}**`);
    }
 
    // ===================== 8. COPYROLEMEMBER =====================
    if (commandName === "copyrolemember") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role       = interaction.options.getRole("role");
        const memberUser = interaction.options.getUser("member");
        const category   = interaction.options.getChannel("category");
        const mode       = interaction.options.getString("mode");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const applyPerms = async (ch) => {
            const perms = ch.permissionOverwrites.cache.get(role.id);
            if (!perms) return;
            const data = {};
            for (const perm of Object.keys(PermissionsBitField.Flags)) {
                if (perms.allow.has(perm)) data[perm] = true;
                if (perms.deny.has(perm))  data[perm] = false;
            }
            await ch.permissionOverwrites.edit(member, data);
        };
 
        try {
            if (mode === "category") {
                await applyPerms(category);
                const children = interaction.guild.channels.cache.filter(c => c.parentId === category.id);
                for (const ch of children.values()) await applyPerms(ch);
            }
 
            if (mode === "alls") {
                for (const ch of interaction.guild.channels.cache.values()) await applyPerms(ch);
            }
 
            await sendLog(interaction.guild,
`📋 COPY ROLE → MEMBER
 
Role: ${role.name} (${role.id})
Member: ${member.user.tag} (${member.id})
Mode: ${mode}
Category: ${category.name}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(`✅ Copied permissions from **${role.name}** to **${member.user.tag}**`);
 
        } catch (err) {
            console.error("[copyrolemember]", err);
            return interaction.reply({ content: "❌ Failed to copy permissions", ephemeral: true });
        }
    }
 
    // ===================== 9. COPYCHANNELP =====================
    if (commandName === "copychannelp") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const source = interaction.options.getChannel("source");
        const target = interaction.options.getChannel("target");
 
        try {
            await target.permissionOverwrites.set(source.permissionOverwrites.cache);
 
            await sendLog(interaction.guild,
`📋 COPY CHANNEL PERMISSIONS
 
Source: ${source.name} (${source.id})
Target: ${target.name} (${target.id})
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(`✅ Copied permissions from **${source.name}** to **${target.name}**`);
 
        } catch (err) {
            console.error("[copychannelp]", err);
            return interaction.reply({ content: "❌ Failed to copy permissions", ephemeral: true });
        }
    }
 
    // ===================== 10. COPYROLROLECATEGORY =====================
    if (commandName === "copyrolrolecategory") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role1  = interaction.options.getRole("role1");
        const source = interaction.options.getChannel("source");
        const role2  = interaction.options.getRole("role2");
        const target = interaction.options.getChannel("target");
 
        const perms = source.permissionOverwrites.cache.get(role1.id);
        if (!perms)
            return interaction.reply({ content: "❌ Source role has no permissions in source channel/category", ephemeral: true });
 
        try {
            const data = {};
            for (const perm of Object.keys(PermissionsBitField.Flags)) {
                if (perms.allow.has(perm)) data[perm] = true;
                if (perms.deny.has(perm))  data[perm] = false;
            }
            await target.permissionOverwrites.edit(role2, data);
 
            await sendLog(interaction.guild,
`🔄 COPY ROLE → ROLE
 
Source role: ${role1.name} (${role1.id})
Source channel: ${source.name} (${source.id})
Target role: ${role2.name} (${role2.id})
Target channel: ${target.name} (${target.id})
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(
                `✅ Copied permissions from **${role1.name}** (${source.name}) → **${role2.name}** (${target.name})`
            );
 
        } catch (err) {
            console.error("[copyrolrolecategory]", err);
            return interaction.reply({ content: "❌ Error while copying permissions", ephemeral: true });
        }
    }
 
    // ===================== 11. SYNCROLEROLE =====================
    if (commandName === "syncrolerole") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const roleSource = interaction.options.getRole("rolesource");
        const roleTarget = interaction.options.getRole("roletarget");
        let count = 0;
 
        try {
            for (const ch of interaction.guild.channels.cache.values()) {
                const perms = ch.permissionOverwrites.cache.get(roleSource.id);
                if (!perms) continue;
                const data = {};
                for (const perm of Object.keys(PermissionsBitField.Flags)) {
                    if (perms.allow.has(perm)) data[perm] = true;
                    if (perms.deny.has(perm))  data[perm] = false;
                }
                await ch.permissionOverwrites.edit(roleTarget, data);
                count++;
            }
 
            await sendLog(interaction.guild,
`🔄 SYNC ROLE → ROLE
 
Source role: ${roleSource.name} (${roleSource.id})
Target role: ${roleTarget.name} (${roleTarget.id})
Channels updated: ${count}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
            );
 
            return interaction.reply(
                `✅ Synchronized **${count}** channels from **${roleSource.name}** to **${roleTarget.name}**`
            );
 
        } catch (err) {
            console.error("[syncrolerole]", err);
            return interaction.reply({ content: "❌ Error while syncing roles", ephemeral: true });
        }
    }
 
    // ===================== 12. SETMEMBERROLE =====================
    if (commandName === "setmemberrole") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const role = interaction.options.getRole("role");
 
        let config = await StaffConfig.findOne({ guildId: interaction.guild.id });
        if (!config) config = await StaffConfig.create({ guildId: interaction.guild.id });
 
        config.memberRoleId = role.id;
        await config.save();
 
        await sendLog(interaction.guild,
`⚙️ MEMBER ROLE SET
 
Role: ${role.name} (${role.id})
Set by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ Member role set to **${role.name}**`);
    }
 
    // ===================== 13. SETSTAFFLOG =====================
    if (commandName === "setstafflog") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const channel = interaction.options.getChannel("channel");
 
        let config = await StaffConfig.findOne({ guildId: interaction.guild.id });
        if (!config) config = await StaffConfig.create({ guildId: interaction.guild.id });
 
        config.logChannelId = channel.id;
        await config.save();
 
        return interaction.reply(`✅ Staff log channel set to ${channel}`);
    }
 
    // ===================== 14. STAFFSECURITY =====================
    if (commandName === "staffsecurity") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const level      = interaction.options.getInteger("level");
 
        let security = await StaffSecurity.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
        if (!security) security = await StaffSecurity.create({ guildId: interaction.guild.id, userId: memberUser.id });
 
        security.level = level;
        await security.save();
 
        await sendLog(interaction.guild,
`🛡 STAFF SECURITY UPDATED
 
Member: ${memberUser.tag} (${memberUser.id})
New level: ${level}
Set by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ Security level for **${memberUser.tag}** set to **${level}**`);
    }
 
    // ===================== 15. REMOVEWARNSTAFF =====================
    // FIX: variabila `warn` era nedefinita in log; acum folosim `removedWarn`
    if (commandName === "removewarnstaff") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser   = interaction.options.getUser("member");
        const warnNum      = interaction.options.getInteger("warn");
        const removeReason = interaction.options.getString("reason");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data || data.warns.length === 0)
            return interaction.reply({ content: "❌ No warns found for this member", ephemeral: true });
 
        if (warnNum < 1 || warnNum > data.warns.length)
            return interaction.reply({
                content: `❌ Invalid warn number. This member has **${data.warns.length}** warn(s).`,
                ephemeral: true
            });
 
        // ✅ FIX: referinta corecta la warn-ul ales
        const removedWarn = data.warns[warnNum - 1];
 
        removedWarn.active       = false;
        removedWarn.removed      = true;
        removedWarn.removedBy    = interaction.user.id;
        removedWarn.removedAt    = new Date();
        removedWarn.removeReason = removeReason;
 
        await data.save();
 
        const activeLeft = data.warns.filter(w => w.active && !w.removed).length;
 
        await sendLog(interaction.guild,
`🗑 STAFF WARN REMOVED
 
Member: ${memberUser.tag} (${memberUser.id})
Warn #${warnNum} removed
Original reason: ${removedWarn.reason}
Remove reason: ${removeReason}
Removed by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(
            `✅ Warn **#${warnNum}** removed from **${memberUser.tag}** (${activeLeft} active warn(s) remaining)`
        );
    }
 
    // ===================== 16. STAFFINFO =====================
    if (commandName === "staffinfo") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data || data.warns.length === 0)
            return interaction.reply(`✅ **${memberUser.tag}** has no warns`);
 
        let txt = `📋 **Staff warns for ${memberUser.tag}** (${data.warns.length}/6)\n\n`;
        data.warns.forEach((w) => {
            let status = "🟢 Active";
            if (w.removed)      status = "🔴 Removed";
            else if (!w.active) status = "🟡 Expired";
 
            txt += `**#${w.warnId}**\nStatus: ${status}\nReason: ${w.reason}\nSeverity: ${w.severity}\nTask: ${w.task}\nModerator: <@${w.moderatorId}>\nExpires: <t:${Math.floor(w.expireAt.getTime() / 1000)}:R>\n`;
 
            if (w.removed) {
                txt += `Removed by: <@${w.removedBy}>\nRemove reason: ${w.removeReason}\nRemoved at: <t:${Math.floor(w.removedAt.getTime() / 1000)}:F>\n`;
            }
 
            txt += "\n";
        });
 
        return interaction.reply(txt);
    }
 
    // ===================== 17. STAFFWARNS =====================
    if (commandName === "staffwarns") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data || data.warns.length === 0)
            return interaction.reply(`✅ **${memberUser.tag}** has no active warns`);
 
        const now = new Date();
        const activeWarns = data.warns.filter(w => w.active && !w.removed && w.expireAt > now);
 
        if (activeWarns.length === 0)
            return interaction.reply(`✅ **${memberUser.tag}** has no active warns (all expired or removed)`);
 
        let txt = `📋 **Active warns for ${memberUser.tag}** (${activeWarns.length} active)\n\n`;
        activeWarns.forEach((w, i) => {
            txt +=
`**#${i + 1}**
Reason: ${w.reason}
Severity: ${w.severity}
Task: ${w.task}
Expires: <t:${Math.floor(w.expireAt.getTime() / 1000)}:R>
 
`;
        });
 
        return interaction.reply(txt);
    }
 
    // ===================== 18. STAFFHISTORY =====================
    if (commandName === "staffhistory") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data || data.warns.length === 0)
            return interaction.reply(`✅ **${memberUser.tag}** has no warn history`);
 
        const now = new Date();
        let txt = `📜 **Full warn history for ${memberUser.tag}** (${data.warns.length} total)\n\n`;
        data.warns.forEach((w, i) => {
            const expired = w.expireAt <= now;
            txt +=
`**#${i + 1}** ${expired ? "~~(expired)~~" : ""}
Reason: ${w.reason}
Severity: ${w.severity}
Task: ${w.task}
Moderator: <@${w.moderatorId}>
Date: <t:${Math.floor(w.date ? new Date(w.date).getTime() / 1000 : w.expireAt.getTime() / 1000 - 14 * 24 * 60 * 60)}:F>
Expires: <t:${Math.floor(w.expireAt.getTime() / 1000)}:R>
 
`;
        });
 
        return interaction.reply(txt);
    }
 
    // ===================== 19. CLEARSTAFFWARNS =====================
    // FIX: sterge toate warn-urile (active + istorice) si salveaza corect
    if (commandName === "clearstaffwarns") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data || data.warns.length === 0)
            return interaction.reply({ content: "❌ No warns found for this member", ephemeral: true });
 
        const count = data.warns.length;
 
        // ✅ FIX: golim array-ul si salvam
        data.warns = [];
        await data.save();
 
        await sendLog(interaction.guild,
`🧹 STAFF WARNS CLEARED
 
Member: ${memberUser.tag} (${memberUser.id})
Warns removed: ${count}
Cleared by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ Cleared **${count}** warn(s) from **${memberUser.tag}**`);
    }
 
    // ===================== 20. STAFFFREEZE =====================
    if (commandName === "stafffreeze") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const hours      = interaction.options.getInteger("hours");
        const reason     = interaction.options.getString("reason");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
        if (!config?.freezeRoleId)
            return interaction.reply({ content: "❌ Freeze role not configured", ephemeral: true });
 
        const durationMs = hours * 60 * 60 * 1000;
        await freezeMember(member, durationMs, reason);
 
        const expiresAt = new Date(Date.now() + durationMs);
 
        await StaffFreeze.findOneAndUpdate(
            { guildId: interaction.guild.id, userId: member.id },
            { reason, expiresAt },
            { upsert: true }
        );
 
        try {
            await member.send(
`❄️ STAFF FREEZE
 
You have been frozen for ${hours}h.
Reason: ${reason}
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
            );
        } catch {}
 
        await sendLog(interaction.guild,
`❄️ STAFF FREEZE
 
Member: ${member.user.tag} (${member.id})
Duration: ${hours}h
Reason: ${reason}
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`❄️ **${member.user.tag}** frozen for **${hours}h** — ${reason}`);
    }
 
    // ===================== 21. STAFFUNFREEZE =====================
     if (commandName === "staffunfreeze") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
 
        const freezeData = await StaffFreeze.findOneAndDelete({
            guildId: interaction.guild.id,
            userId:  member.id
        });
 
        if (!freezeData)
            return interaction.reply({ content: "❌ This member is not frozen", ephemeral: true });
 
if (config?.freezeRoleId)
    await member.roles.remove(
        config.freezeRoleId
    ).catch(() => {});

// șterge overwrite-urile făcute la freeze
for (const channel of interaction.guild.channels.cache.values()) {

    await channel.permissionOverwrites
    .delete(member.id)
    .catch(() => {});

}

// pune toate rolurile înapoi
if (freezeData.savedRoles?.length) {

    await member.roles.set(
        freezeData.savedRoles
    ).catch(() => {});

}
 
        try { await member.send("✅ Your freeze has been removed."); } catch {}
 
        await sendLog(interaction.guild,
`✅ STAFF UNFREEZE
 
Member: ${member.user.tag} (${member.id})
Unfrozen by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ **${member.user.tag}** has been unfrozen`);
    }
 
    // ===================== 22. STAFFSUSPEND =====================
    if (commandName === "staffsuspend") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const hours      = interaction.options.getInteger("hours");
        const reason     = interaction.options.getString("reason");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
        if (!config?.suspendRoleId)
            return interaction.reply({ content: "❌ Suspend role not configured", ephemeral: true });
 
        const durationMs = hours * 60 * 60 * 1000;
        await suspendMember(member, durationMs, reason);
 
        const expiresAt = new Date(Date.now() + durationMs);
 
        try {
            await member.send(
`⛔ STAFF SUSPENSION
 
You have been suspended for ${hours}h.
Reason: ${reason}
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
            );
        } catch {}
 
        await sendLog(interaction.guild,
`⛔ STAFF SUSPEND
 
Member: ${member.user.tag} (${member.id})
Duration: ${hours}h
Reason: ${reason}
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`⛔ **${member.user.tag}** suspended for **${hours}h** — ${reason}`);
    }
 
    // ===================== 23. STAFFUNSUSPEND =====================
    if (commandName === "staffunsuspend") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
 
        const suspendData = await StaffSuspend.findOneAndDelete({
            guildId: interaction.guild.id,
            userId:  member.id
        });
 
        if (!suspendData)
            return interaction.reply({ content: "❌ This member is not suspended", ephemeral: true });
 
        if (config?.suspendRoleId)
            await member.roles.remove(config.suspendRoleId).catch(() => {});
 
        if (suspendData.savedRoles?.length) {
            for (const roleId of suspendData.savedRoles) {
                await member.roles.add(roleId).catch(() => {});
            }
        }
 
        await member.timeout(null).catch(() => {});
 
        try { await member.send("✅ Your suspension has been removed."); } catch {}
 
        await sendLog(interaction.guild,
`✅ STAFF UNSUSPEND
 
Member: ${member.user.tag} (${member.id})
Unsuspended by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ **${member.user.tag}** has been unsuspended`);
    }
 
    // ===================== 24. STAFFDEMOTE =====================
    if (commandName === "staffdemote") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const reason     = interaction.options.getString("reason");
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
        } catch {
            return interaction.reply({ content: "❌ Member not found in this server", ephemeral: true });
        }
 
        const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
 
        const oldRoles = member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .map(r => r.id);
 
        await StaffDemote.create({ guildId: interaction.guild.id, userId: member.id, oldRoles, reason });
 
        if (config?.staffRoleId)
            await member.roles.remove(config.staffRoleId).catch(() => {});
 
        if (config?.demoteRoleId)
            await member.roles.add(config.demoteRoleId).catch(() => {});
 
        try {
            await member.send(`📉 STAFF DEMOTION\n\nYou have been demoted.\nReason: ${reason}`);
        } catch {}
 
        await sendLog(interaction.guild,
`📉 STAFF DEMOTE
 
Member: ${member.user.tag} (${member.id})
Reason: ${reason}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`📉 **${member.user.tag}** has been demoted — ${reason}`);
    }
 
    // ===================== 25. STAFFBLACKLIST =====================
    if (commandName === "staffblacklist") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const reason     = interaction.options.getString("reason");
 
        const existing = await StaffBlacklist.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (existing)
            return interaction.reply({ content: "❌ This member is already blacklisted", ephemeral: true });
 
        await StaffBlacklist.create({ guildId: interaction.guild.id, userId: memberUser.id, reason, moderatorId: interaction.user.id });
 
        let member;
        try {
            member = await interaction.guild.members.fetch(memberUser.id);
            const config = await StaffConfig.findOne({ guildId: interaction.guild.id });
            if (config?.staffRoleId) await member.roles.remove(config.staffRoleId).catch(() => {});
        } catch {}
 
        try {
            await memberUser.send(`🚫 STAFF BLACKLIST\n\nYou have been blacklisted from staff.\nReason: ${reason}`);
        } catch {}
 
        await sendLog(interaction.guild,
`🚫 STAFF BLACKLIST
 
Member: ${memberUser.tag} (${memberUser.id})
Reason: ${reason}
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`🚫 **${memberUser.tag}** has been blacklisted — ${reason}`);
    }
 
    // ===================== 26. STAFFUNBLACKLIST =====================
    if (commandName === "staffunblacklist") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
 
        const deleted = await StaffBlacklist.findOneAndDelete({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!deleted)
            return interaction.reply({ content: "❌ This member is not blacklisted", ephemeral: true });
 
        try { await memberUser.send("✅ Your staff blacklist has been removed."); } catch {}
 
        await sendLog(interaction.guild,
`✅ STAFF UNBLACKLIST
 
Member: ${memberUser.tag} (${memberUser.id})
Removed by: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ **${memberUser.tag}** has been removed from the blacklist`);
    }
 
    // ===================== 27. STAFFPROBATION =====================
    if (commandName === "staffprobation") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const days       = interaction.options.getInteger("days");
 
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
 
        await StaffProbation.findOneAndDelete({ guildId: interaction.guild.id, userId: memberUser.id });
        await StaffProbation.create({ guildId: interaction.guild.id, userId: memberUser.id, expiresAt });
 
        try {
            await memberUser.send(
`⚠️ STAFF PROBATION
 
You have been placed on probation for ${days} day(s).
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
            );
        } catch {}
 
        await sendLog(interaction.guild,
`⚠️ STAFF PROBATION
 
Member: ${memberUser.tag} (${memberUser.id})
Duration: ${days} day(s)
Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>
Moderator: ${interaction.user.tag} (${interaction.user.id})
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`⚠️ **${memberUser.tag}** placed on probation for **${days}** day(s)`);
    }
 
    // ===================== 28. TOPSTAFFWARNS =====================
    if (commandName === "topstaffwarns") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const allWarns = await StaffWarn.find({ guildId: interaction.guild.id });
 
        if (!allWarns || allWarns.length === 0)
            return interaction.reply("✅ No staff warns in this server");
 
        const now = new Date();
 
        const sorted = allWarns
            .map(d => ({
                userId: d.userId,
                active: d.warns.filter(w => w.active && !w.removed && w.expireAt > now).length,
                total:  d.warns.length
            }))
            .filter(d => d.active > 0)
            .sort((a, b) => b.active - a.active)
            .slice(0, 10);
 
        if (sorted.length === 0)
            return interaction.reply("✅ No active staff warns in this server");
 
        let txt = `🏆 **Top Staff Warns**\n\n`;
        sorted.forEach((d, i) => {
            txt += `**#${i + 1}** <@${d.userId}> — ${d.active} active warn(s) (${d.total} total)\n`;
        });
 
        return interaction.reply(txt);
    }
 
    // ===================== 29. REMOVEWARNHISTORY =====================
    if (commandName === "removewarnhistory") {
        if (!(await isBotAdmin(interaction)))
            return interaction.reply({ content: "❌ No permission", ephemeral: true });
 
        const memberUser = interaction.options.getUser("member");
        const warnId     = interaction.options.getInteger("warnid");
        const reason     = interaction.options.getString("reason");
 
        const data = await StaffWarn.findOne({ guildId: interaction.guild.id, userId: memberUser.id });
 
        if (!data)
            return interaction.reply({ content: "❌ No history found for this member", ephemeral: true });
 
        const warn = data.warns.find(w => w.warnId === warnId);
 
        if (!warn)
            return interaction.reply({ content: `❌ Warn ID **${warnId}** not found`, ephemeral: true });
 
        warn.active       = false;
        warn.removed      = true;
        warn.removedBy    = interaction.user.id;
        warn.removedAt    = new Date();
        warn.removeReason = reason;
 
        await data.save();
 
        await sendLog(interaction.guild,
`🗑 WARN HISTORY REMOVED
 
Member: ${memberUser.tag} (${memberUser.id})
Warn ID: ${warnId}
Original reason: ${warn.reason}
Removed by: ${interaction.user.tag} (${interaction.user.id})
Remove reason: ${reason}
Time: <t:${Math.floor(Date.now() / 1000)}:F>`
        );
 
        return interaction.reply(`✅ Warn ID **${warnId}** marked as removed from history`);
    }
});
 
// ===================== START =====================
console.log("Starting bot...");
 
function startBot() {
    client.login(TOKEN)
        .then(() => console.log("✅ Logged in successfully"))
        .catch(err => {
            console.error("❌ Login error:", err);
            setTimeout(startBot, 5000);
        });
}
 
startBot();
