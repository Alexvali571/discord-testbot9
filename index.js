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

    warnCount: {
        type: Number,
        default: 0
    },

    warnCountExp: {
        type: Number,
        default: 0
    },

    warnCountRm: {
        type: Number,
        default: 0
    },

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
    guildId:       String,
    logChannelId:  String,

    freezeRoleId:  String,
    suspendRoleId: String,
    demoteRoleId:  String,

    staffRoleId:   String,
    memberRoleId:  String,
    verifyRoleId:  String,
    logChannelId: String,
    warnLogChannelId: {
    type: String,
    default: null
},
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

    permissions: Object,

    source: {
        type: String,
        default: "manual"
    }
}));

const StaffSuspend = mongoose.model("StaffSuspend", new mongoose.Schema({
    guildId: String,
    userId: String,

    reason: String,

    savedRoles: [String],

    expiresAt: Date,

    source: {
        type: String,
        default: "manual"
    }
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
    guildId: String,
    userId: String,

    reason: String,
    moderatorId: String,

    expiresAt: Date
}));

const staffSystem = require("./staff_system");
 
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
    .setName("copyrolerole")
    .setDescription("Copiază permisiunile din toate canalele de la un rol la altul")
    .addRoleOption(o =>
        o.setName("source")
            .setDescription("Rolul de la care se copiază permisiunile")
            .setRequired(true)
    )
    .addRoleOption(o =>
        o.setName("target")
            .setDescription("Rolul care va primi permisiunile")
            .setRequired(true)
    ),

    
].map(c => c.toJSON());
 
// ===================== REGISTER =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);
 
async function register() {

    const allCommands = [
        ...commands,
        ...staffSystem.commands
    ];

    await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        {
            body: allCommands.map(command =>
                typeof command.toJSON === "function"
                    ? command.toJSON()
                    : command
            )
        }
    );

    console.log(`✅ ${allCommands.length} commands registered`);
}
 
// ===================== READY =====================
client.once("ready", async () => {
    console.log(`🟢 Logged in as ${client.user.tag}`);
    heartbeat();
    await register();

    staffSystem.register(client);
 
    setInterval(() => { heartbeat(); console.log("💓 heartbeat OK"); }, 30000);
 
});
 
// ===================== COMMAND HANDLER =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

const staffHandled =
    await staffSystem.handleInteraction(
        interaction
    );

if (staffHandled)
    return;
 
    const { commandName } = interaction;

    // =====================================================
// COPY ROLE -> ROLE
// Copiază permission overwrites din TOATE canalele
// =====================================================

if (commandName === "copyrolerole") {

    // DOAR BOT ADMIN
    const allowed =
        await staffSystem.isBotAdmin(
            interaction
        );

    if (!allowed) {

        await interaction.reply({
            content:
                "❌ Această comandă poate fi folosită doar de Bot Admin.",
            ephemeral: true
        });

        return;
    }


    const sourceRole =
        interaction.options.getRole(
            "source"
        );

    const targetRole =
        interaction.options.getRole(
            "target"
        );


    // =====================================
    // VERIFICĂRI
    // =====================================

    if (sourceRole.id === targetRole.id) {

        await interaction.reply({
            content:
                "❌ Rolul sursă și rolul destinație nu pot fi același rol.",
            ephemeral: true
        });

        return;
    }


    if (
        targetRole.id ===
        interaction.guild.id
    ) {

        await interaction.reply({
            content:
                "❌ Nu poți folosi @everyone ca rol destinație.",
            ephemeral: true
        });

        return;
    }


    await interaction.deferReply({
        ephemeral: true
    });


    let checked = 0;
    let copied = 0;
    let skipped = 0;
    let failed = 0;


    // =====================================
    // TOATE CANALELE + CATEGORIILE
    // =====================================

    for (
        const channel
        of interaction.guild.channels.cache.values()
    ) {

        checked++;


        try {

            // Căutăm overwrite-ul rolului SOURCE
            const sourceOverwrite =
                channel.permissionOverwrites.cache.get(
                    sourceRole.id
                );


            // SOURCE nu are setări speciale aici
            if (!sourceOverwrite) {

                skipped++;

                continue;
            }


            // =====================================
            // COPIEM EXACT ALLOW + DENY
            // =====================================

            await channel.permissionOverwrites.edit(
                targetRole,
                {
                    ...Object.fromEntries(
                        sourceOverwrite.allow
                            .toArray()
                            .map(permission => [
                                permission,
                                true
                            ])
                    ),

                    ...Object.fromEntries(
                        sourceOverwrite.deny
                            .toArray()
                            .map(permission => [
                                permission,
                                false
                            ])
                    )
                }
            );


            copied++;

        }

        catch (error) {

            failed++;

            console.error(
                `[COPYROLEROLE] ${channel.name}:`,
                error
            );

        }

    }

    // =====================================
// LOG COPY ROLE -> ROLE
// Folosește canalul setat prin /setstafflog
// =====================================

try {

    const staffConfig =
        await StaffConfig.findOne({
            guildId: interaction.guild.id
        });


    if (staffConfig?.logChannelId) {

        const logChannel =
            interaction.guild.channels.cache.get(
                staffConfig.logChannelId
            );


        if (logChannel) {

            await logChannel.send(
`📋 **ROLE PERMISSIONS COPIED**

Executed by: <@${interaction.user.id}>

Source Role: ${sourceRole}
Source ID: \`${sourceRole.id}\`

Target Role: ${targetRole}
Target ID: \`${targetRole.id}\`

Channels checked: **${checked}**
Overwrites copied: **${copied}**
Skipped: **${skipped}**
Failed: **${failed}**

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
            );

        }

    }

}

catch (error) {

    console.error(
        "[COPYROLEROLE LOG]",
        error
    );

}


    // =====================================
    // REZULTAT
    // =====================================

    await interaction.editReply(
`✅ **ROLE PERMISSIONS COPIED**

Source: ${sourceRole}
Target: ${targetRole}

Channels checked: **${checked}**
Overwrites copied: **${copied}**
Skipped: **${skipped}**
Failed: **${failed}**`
    );


    return;
}
 
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
    function generateWarnId(userId) {
    return `${userId}-${Date.now()}`;
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


  if (!interaction.isChatInputCommand()) return;

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
