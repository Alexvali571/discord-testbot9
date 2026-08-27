const {
    SlashCommandBuilder
} = require("discord.js");

const mongoose = require("mongoose");

// Modelele sunt deja create în index.js,
// înainte de require("./staff_system")
const GuildConfig = mongoose.model("GuildConfig");
const StaffConfig = mongoose.model("StaffConfig");
const StaffSecurity = mongoose.model("StaffSecurity");
const StaffWarn = mongoose.model("StaffWarn");
const StaffFreeze = mongoose.model("StaffFreeze");
const StaffSuspend = mongoose.model("StaffSuspend");
const StaffDemote = mongoose.model("StaffDemote");
const StaffProbation = mongoose.model("StaffProbation");


// =====================================================
// MODERATOR CONFIG
// =====================================================

const ModeratorConfig =
    mongoose.models.ModeratorConfig ||
    mongoose.model(
        "ModeratorConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true,
                index: true
            },

            grad1RoleId: {
                type: String,
                default: null
            },

            grad2RoleId: {
                type: String,
                default: null
            }
        })
    );


// =====================================================
// BLACKLIST DATABASE
// =====================================================

const BlacklistEntry =
    mongoose.models.BlacklistEntry ||
    mongoose.model(
        "BlacklistEntry",
        new mongoose.Schema({
            guildId: {
                type: String,
                index: true
            },

            userId: {
                type: String,
                index: true
            },

            type: {
                type: String,
                enum: [
                    "normal",
                    "staff"
                ],
                required: true
            },

            reason: {
                type: String,
                required: true
            },

            moderatorId: {
                type: String,
                required: true
            },

            active: {
                type: Boolean,
                default: true
            },

            date: {
                type: Date,
                default: Date.now
            },

            removedBy: String,
            removedAt: Date,
            removeReason: String
        })
    );


const BlacklistConfig =
    mongoose.models.BlacklistConfig ||
    mongoose.model(
        "BlacklistConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true,
                index: true
            },

            logChannelId: {
                type: String,
                default: null
            },

            normalForbiddenRoleIds: {
                type: [String],
                default: []
            },

            staffForbiddenRoleIds: {
                type: [String],
                default: []
            }
        })
    );


// =====================================================
// STAFF HIERARCHY
// =====================================================

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


// =====================================================
// PERMISSIONS
// =====================================================

// Moderator Grad 1
const GRAD1_COMMANDS = new Set([
    "warnstaff",
    "staffwarns",
    "blacklist",
    "staffinfo",
    "staffwarnhistory",
    "viewblacklist"
]);


// Moderator Grad 2
const GRAD2_COMMANDS = new Set([
    ...GRAD1_COMMANDS,

    "staffblacklist",

    "removewarnstaff",
    "clearwarnstaff",

    "stafffreeze",
    "staffunfreeze",

    "staffsuspend",
    "staffunsuspend",

    "staffdemote",

    "staffprobation",
    "staffunprobation",

    "unblacklist",
    "staffunblacklist",

    "topstaffwarns",

    "removewarnhistory",
    "clearwarnstaffhistory"
]);


// Doar Bot Admin
const BOT_ADMIN_ONLY = new Set([
    "setmodrol",
    "viewmodrole",

    "setstafflog",
    "setstaffrole",
    "setmemberrole",
    "setverifyrole",
    "setstaffwarnlog",

    "setfreezerole",
    "setsuspendrole",
    "setdemoterole",

    "staffsecurity",

    "setblacklistchannel",
    "setblacklistrole",
    "unsetblacklistrole",
    "viewblacklistroles"
]);


// =====================================================
// ACCESS HELPERS
// =====================================================

async function isBotAdmin(interaction) {

    const config = await GuildConfig.findOne({
        guildId: interaction.guild.id
    });

    if (!config?.botAdminRole)
        return false;

    return interaction.member.roles.cache.has(
        config.botAdminRole
    );
}


async function getModeratorLevel(interaction) {

    const config = await ModeratorConfig.findOne({
        guildId: interaction.guild.id
    });

    if (!config)
        return 0;


    if (
        config.grad2RoleId &&
        interaction.member.roles.cache.has(
            config.grad2RoleId
        )
    ) {
        return 2;
    }


    if (
        config.grad1RoleId &&
        interaction.member.roles.cache.has(
            config.grad1RoleId
        )
    ) {
        return 1;
    }


    return 0;
}


async function canUse(
    interaction,
    commandName
) {

    // Bot Admin are acces la TOATE comenzile
    if (await isBotAdmin(interaction))
        return true;


    // comenzile SET nu pot fi date de moderator
    if (
        BOT_ADMIN_ONLY.has(commandName)
    ) {
        return false;
    }


    const level =
        await getModeratorLevel(interaction);


    if (
        GRAD2_COMMANDS.has(commandName)
    ) {
        return level >= 2;
    }


    if (
        GRAD1_COMMANDS.has(commandName)
    ) {
        return level >= 1;
    }


    return false;
}


async function requireAccess(
    interaction,
    commandName
) {

    if (
        await canUse(
            interaction,
            commandName
        )
    ) {
        return true;
    }


    let message =
        "❌ Nu ai permisiunea necesară.";


    if (
        BOT_ADMIN_ONLY.has(commandName)
    ) {

        message =
            "❌ Această comandă poate fi folosită doar de Bot Admin.";

    }

    else if (
        GRAD2_COMMANDS.has(commandName)
    ) {

        message =
            "❌ Ai nevoie de Moderator Grad 2 sau Bot Admin.";

    }

    else if (
        GRAD1_COMMANDS.has(commandName)
    ) {

        message =
            "❌ Ai nevoie de Moderator Grad 1, Grad 2 sau Bot Admin.";

    }


    await interaction.reply({
        content: message,
        ephemeral: true
    });


    return false;
}

// =====================================================
// WARN HELPERS
// =====================================================

function getActiveWarns(data) {
    if (!data?.warns) return [];

    const now = new Date();

    return data.warns.filter(w =>
        w.active === true &&
        w.removed !== true &&
        w.expireAt &&
        new Date(w.expireAt) > now
    );
}


function getExpiredWarns(data) {
    if (!data?.warns) return [];

    const now = new Date();

    return data.warns.filter(w =>
        w.removed !== true &&
        (
            w.active === false ||
            (
                w.expireAt &&
                new Date(w.expireAt) <= now
            )
        )
    );
}


function getRemovedWarns(data) {
    if (!data?.warns) return [];

    return data.warns.filter(w =>
        w.removed === true
    );
}


// Recalculează counterele din baza de date.
// Nu șterge istoricul.
async function recalculateWarnCounters(data) {

    if (!data) return;

    data.warnCount =
        getActiveWarns(data).length;

    data.warnCountExp =
        getExpiredWarns(data).length;

    data.warnCountRm =
        getRemovedWarns(data).length;

    await data.save();
}


// =====================================================
// WARN ID
// =====================================================

function getNextWarnId(data) {

    if (!data.warns?.length)
        return 1;

    const ids = data.warns
        .map(w => Number(w.warnId) || 0);

    return Math.max(...ids) + 1;
}


// =====================================================
// ACTION CALCULATION
// =====================================================

function calculateWarnAction(
    severity,
    warnCount
) {

    let suspendHours = 0;
    let freezeHours = 0;


    switch (severity) {

        case 1:
            freezeHours = 1;
            break;

        case 2:
            freezeHours = 3;
            break;

        case 3:
            freezeHours = 6;
            break;

        case 4:
            suspendHours = 6;
            freezeHours = 12;
            break;

        case 5:
            suspendHours = 12;
            freezeHours = 24;
            break;

        case 6:
            suspendHours = 24;
            freezeHours = 36;
            break;

        case 7:
            suspendHours = 48;
            freezeHours = 48;
            break;
    }


    // fiecare warn activ suplimentar
    // adaugă 6 ore
    const extra =
        Math.max(0, warnCount - 1) * 6;

    suspendHours += extra;
    freezeHours += extra;


    return {
        suspendHours,
        freezeHours
    };
}

async function sendStaffWarnLog(
    guild,
    message
) {

    const config =
        await StaffConfig.findOne({
            guildId: guild.id
        });


    if (!config)
        return;


    // Prioritate:
    // 1. canalul setat prin /setstaffwarnlog
    // 2. dacă nu există, canalul general /setstafflog

    const channelId =
        config.warnLogChannelId ||
        config.logChannelId;


    if (!channelId)
        return;


    const channel =
        guild.channels.cache.get(
            channelId
        );


    if (!channel)
        return;


    await channel.send(message)
        .catch(error => {

            console.error(
                "[STAFF WARN LOG]",
                error
            );

        });

}


// =====================================================
// STAFF LOG
// =====================================================

async function sendStaffLog(
    guild,
    message
) {

    try {

        const config =
            await StaffConfig.findOne({
                guildId: guild.id
            });


        if (!config?.logChannelId)
            return;


        const channel =
            guild.channels.cache.get(
                config.logChannelId
            );


        if (!channel)
            return;


        await channel.send(message);

    }

    catch (error) {

        console.error(
            "[STAFF LOG ERROR]",
            error
        );

    }
}


// =====================================================
// GET / CREATE WARN DATA
// =====================================================

async function getWarnData(
    guildId,
    userId
) {

    let data =
        await StaffWarn.findOne({
            guildId,
            userId
        });


    if (!data) {

        data =
            await StaffWarn.create({

                guildId,
                userId,

                warnCount: 0,
                warnCountExp: 0,
                warnCountRm: 0,

                warns: []

            });

    }


    return data;
}

// =====================================================
// 6/6 WARNS -> REMOVE STAFF
// =====================================================

async function removeStaffForMaxWarns(
    member
) {

    const config =
        await StaffConfig.findOne({
            guildId: member.guild.id
        });


    // -------------------------------------------------
    // Eliminăm sancțiunile provenite din WARN
    // înainte de remove staff.
    // -------------------------------------------------

    const warnFreeze =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source: "warn"
        });

    if (warnFreeze) {

await removeStaffFreeze(
    member,
    "Reached 6/6 staff warns",
    "warn"
);

    }


    const warnSuspend =
        await StaffSuspend.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source: "warn"
        });

    if (warnSuspend) {

await removeStaffSuspend(
    member,
    "Reached 6/6 staff warns",
    "warn"
);

    }


    // -------------------------------------------------
    // Scoatem TOATE rolurile staff
    // -------------------------------------------------

    const staffRoles =
        getStaffRoles(member);


    if (staffRoles.size > 0) {

        await member.roles.remove(
            staffRoles,
            "Reached 6/6 staff warns"
        ).catch(() => {});

    }


    // Dacă există și rol general Staff configurat,
    // îl scoatem explicit.
    if (
        config?.staffRoleId &&
        member.roles.cache.has(
            config.staffRoleId
        )
    ) {

        await member.roles.remove(
            config.staffRoleId,
            "Reached 6/6 staff warns"
        ).catch(() => {});

    }


    return true;
}


// =====================================================
// /WARNSTAFF
// =====================================================

async function handleWarnStaff(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "warnstaff"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );

    const severity =
        interaction.options.getInteger(
            "severity"
        );

    const task =
        interaction.options.getString(
            "task"
        ) || "None";


    let member;

    try {

        member =
            await interaction.guild.members.fetch(
                user.id
            );

    }

    catch {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit pe server.",
            ephemeral: true
        });

        return true;
    }


    const data =
        await getWarnData(
            interaction.guild.id,
            member.id
        );


    await recalculateWarnCounters(data);


    const activeBefore =
        getActiveWarns(data).length;


    if (activeBefore >= 6) {

        await interaction.reply({
            content:
                "❌ Acest membru are deja 6 warn-uri active.",
            ephemeral: true
        });

        return true;
    }


    const expireAt =
        new Date(
            Date.now() +
            14 * 24 * 60 * 60 * 1000
        );


    const warnId =
        getNextWarnId(data);


    data.warns.push({

        warnId,

        reason,
        severity,
        task,

        moderatorId:
            interaction.user.id,

        date:
            new Date(),

        expireAt,

        active: true,
        removed: false

    });


    await data.save();

    await recalculateWarnCounters(data);


    const warnCount =
        getActiveWarns(data).length;


    // =====================================================
// APLICĂ / RECALCULEAZĂ SANCȚIUNEA WARN
// =====================================================

const punishment =
    await recalculateWarnPunishments(
        interaction.guild,
        member,
        data
    );

let actionMessage = [];

// =====================================================
// 6/6 -> REMOVE STAFF
// =====================================================

if (warnCount >= 6) {

    await removeStaffForMaxWarns(
        member
    );

}

if (punishment.suspendHours > 0) {
    actionMessage.push(
        `Suspend ${punishment.suspendHours}h`
    );
}


if (punishment.freezeHours > 0) {
    actionMessage.push(
        `Freeze ${punishment.freezeHours}h`
    );
}


if (warnCount >= 6) {
    actionMessage = [
        "REMOVE STAFF"
    ];
}


const actionText =
    actionMessage.length
        ? actionMessage.join(" + ")
        : "None";


    try {

        await member.send(
`⚠️ STAFF WARNING

Reason: ${reason}
Severity: ${severity}
Task: ${task}

Warns: ${warnCount}/6
Action: ${actionText}

Expires in 14 days.`
        );

    }

    catch {}


    await sendStaffWarnLog(
        interaction.guild,

`🚨 STAFF WARN

Member: ${member.user.tag} (${member.id})
Warn ID: #${warnId}

Moderator: ${interaction.user.tag} (${interaction.user.id})

Reason: ${reason}
Severity: ${severity}
Task: ${task}

Active warns: ${warnCount}/6
Action: ${actionText}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`⚠️ **STAFF WARN**

👤 Member: <@${member.id}>
👮 Moderator: <@${interaction.user.id}>

🆔 Warn ID: **#${warnId}**
📝 Reason: ${reason}

📊 Active Warns: **${warnCount}/6**
🔴 Severity: **${severity}**
📋 Task: ${task}
⚙️ Action: ${actionText}

⏰ Expires: <t:${Math.floor(
    expireAt.getTime() / 1000
)}:F> (<t:${Math.floor(
    expireAt.getTime() / 1000
)}:R>)`
    );


    return true;
}


// =====================================================
// /STAFFWARN
// DOAR WARN-URILE ACTIVE
// =====================================================

async function handleStaffWarn(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "staffwarns"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );


    const data =
        await StaffWarn.findOne({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (!data) {

        await interaction.reply(
            `✅ **${user.tag}** nu are warn-uri active.`
        );

        return true;
    }


    await recalculateWarnCounters(data);


    const active =
        getActiveWarns(data);


    if (!active.length) {

        await interaction.reply(
            `✅ **${user.tag}** nu are warn-uri active.`
        );

        return true;
    }


    let text =
`⚠️ **Active staff warns for ${user.tag}**

Active: **${active.length}/6**

`;


    for (const warn of active) {

        text +=
`**Warn #${warn.warnId}**
Reason: ${warn.reason}
Severity: ${warn.severity}
Task: ${warn.task || "None"}
Moderator: <@${warn.moderatorId}>
Date: <t:${Math.floor(
    new Date(warn.date).getTime() / 1000
)}:F>
Expires: <t:${Math.floor(
    new Date(warn.expireAt).getTime() / 1000
)}:R>

`;

    }


    await interaction.reply(text);

    return true;
}


// =====================================================
// /STAFFINFO
// IMPORTANT:
// AFIȘEAZĂ DOAR WARN-URILE ACTIVE
// =====================================================

async function handleStaffInfo(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "staffinfo"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );


    const data =
        await StaffWarn.findOne({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (!data) {

        await interaction.reply(
            `📋 **Staff info — ${user.tag}**

Active warns: **0/6**`
        );

        return true;
    }


    await recalculateWarnCounters(data);


    const active =
        getActiveWarns(data);


    let text =
`📋 **Staff info — ${user.tag}**

Active warns: **${active.length}/6**

`;


    if (!active.length) {

        text +=
            "✅ No active staff warns.";

    }

    else {

        for (const warn of active) {

            text +=
`**Warn #${warn.warnId}**
Reason: ${warn.reason}
Severity: ${warn.severity}
Task: ${warn.task || "None"}
Expires: <t:${Math.floor(
    new Date(warn.expireAt).getTime() / 1000
)}:R>

`;

        }

    }


    await interaction.reply(text);

    return true;
}


// =====================================================
// /STAFFWARNHISTORY
//
// AICI APAR:ACTIVE EXPIRED REMOVED
// =====================================================

async function handleStaffWarnHistory(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffwarnhistory"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );


    const data =
        await StaffWarn.findOne({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (
        !data ||
        !data.warns.length
    ) {

        await interaction.reply(
            `✅ **${user.tag}** nu are istoric de warn-uri.`
        );

        return true;
    }


    await recalculateWarnCounters(data);


    const active =
        getActiveWarns(data);

    const expired =
        getExpiredWarns(data);

    const removed =
        getRemovedWarns(data);


    let text =
`📜 **Staff warn history — ${user.tag}**

🟢 Active: **${active.length}**
🟡 Expired: **${expired.length}**
🔴 Removed: **${removed.length}**
📊 Total: **${data.warns.length}**

`;


    // ACTIVE
    if (active.length) {

        text +=
            "━━━━━━━━━━ 🟢 ACTIVE ━━━━━━━━━━\n\n";


        for (const warn of active) {

            text +=
`**Warn #${warn.warnId}**
Reason: ${warn.reason}
Severity: ${warn.severity}
Task: ${warn.task || "None"}
Moderator: <@${warn.moderatorId}>
Date: <t:${Math.floor(
    new Date(warn.date).getTime() / 1000
)}:F>
Expires: <t:${Math.floor(
    new Date(warn.expireAt).getTime() / 1000
)}:R>

`;

        }

    }


    // EXPIRED
    if (expired.length) {

        text +=
            "━━━━━━━━━━ 🟡 EXPIRED ━━━━━━━━━━\n\n";


        for (const warn of expired) {

            text +=
`**Warn #${warn.warnId}**
Reason: ${warn.reason}
Severity: ${warn.severity}
Task: ${warn.task || "None"}
Moderator: <@${warn.moderatorId}>

`;

        }

    }


    // REMOVED
    if (removed.length) {

        text +=
            "━━━━━━━━━━ 🔴 REMOVED ━━━━━━━━━━\n\n";


        for (const warn of removed) {

            text +=
`**Warn #${warn.warnId}**
Original reason: ${warn.reason}
Severity: ${warn.severity}
Removed by: ${
    warn.removedBy
        ? `<@${warn.removedBy}>`
        : "Unknown"
}
Remove reason: ${warn.removeReason || "N/A"}
Removed at: ${
    warn.removedAt
        ? `<t:${Math.floor(
            new Date(
                warn.removedAt
            ).getTime() / 1000
        )}:F>`
        : "Unknown"
}

`;

        }

    }


    await interaction.reply(text);

    return true;
}

// =====================================================
// VERIFICĂ SETĂRILE OBLIGATORII STAFF
// =====================================================

async function requireStaffConfig(
    interaction,
    requiredFields = []
) {

    const config =
        await StaffConfig.findOne({
            guildId: interaction.guild.id
        });

    if (!config) {

        await interaction.reply({
            content:
`❌ Sistemul Staff nu este configurat.

Un Bot Admin trebuie să seteze rolurile necesare înainte de folosirea acestei comenzi.`,
            ephemeral: true
        });

        return null;
    }

    const labels = {
        freezeRoleId: "/setfreezerole",
        suspendRoleId: "/setsuspendrole",
        memberRoleId: "/setmemberrole",
        verifyRoleId: "/setverifyrole",
        staffRoleId: "/setstaffrole",
        demoteRoleId: "/setdemoterole",
        logChannelId: "/setstafflog"
    };

    const missing =
        requiredFields.filter(
            field => !config[field]
        );

    if (missing.length > 0) {

        const commandList =
            missing
                .map(
                    field =>
                        `• ${labels[field] || field}`
                )
                .join("\n");

        await interaction.reply({
            content:
`❌ Lipsesc setări obligatorii pentru această comandă:

${commandList}

Configurează-le mai întâi.`,
            ephemeral: true
        });

        return null;
    }

    return config;
}


// =====================================================
// VERIFICĂ SETĂRILE OBLIGATORII BLACKLIST
// =====================================================

async function requireBlacklistConfig(
    interaction,
    type
) {

    const config =
        await getBlacklistConfig(
            interaction.guild.id
        );

    const missing = [];

    if (!config.logChannelId) {
        missing.push(
            "/setblacklistchannel"
        );
    }

    if (
        type === "normal" &&
        (
            !config.normalForbiddenRoleIds ||
            config.normalForbiddenRoleIds.length === 0
        )
    ) {
        missing.push(
            "/setblacklistrole type:Normal"
        );
    }

    if (
        type === "staff" &&
        (
            !config.staffForbiddenRoleIds ||
            config.staffForbiddenRoleIds.length === 0
        )
    ) {
        missing.push(
            "/setblacklistrole type:Staff"
        );
    }

    if (missing.length > 0) {

        await interaction.reply({
            content:
`❌ Sistemul de blacklist nu este configurat complet.

Lipsesc:

${missing.map(x => `• ${x}`).join("\n")}

Configurează-le înainte să folosești această comandă.`,
            ephemeral: true
        });

        return null;
    }

    return config;
}

// =====================================================
// WARN SANCTION RECALCULATION
// Folosit DUPĂ /removewarnstaff și /clearwarnstaff
// =====================================================

async function recalculateWarnPunishments(
    guild,
    member,
    data
) {

    await recalculateWarnCounters(data);

    const activeWarns =
        getActiveWarns(data);


    // =================================================
    // 0 WARN-URI ACTIVE
    // =================================================

    if (activeWarns.length === 0) {

        const warnSuspend =
            await StaffSuspend.findOne({
                guildId: guild.id,
                userId: member.id,
                source: "warn"
            });

        if (warnSuspend) {

            await removeStaffSuspend(
                member,
                "Staff warn punishment recalculated",
                "warn"
            );

        }


        const warnFreeze =
            await StaffFreeze.findOne({
                guildId: guild.id,
                userId: member.id,
                source: "warn"
            });

        if (warnFreeze) {

            await removeStaffFreeze(
                member,
                "Staff warn punishment recalculated",
                "warn"
            );

        }


        return {
            activeWarns: 0,
            suspendHours: 0,
            freezeHours: 0
        };
    }


    // =================================================
    // ULTIMUL WARN ACTIV
    // =================================================

    const latestWarn =
        [...activeWarns].sort(
            (a, b) =>
                new Date(b.date) -
                new Date(a.date)
        )[0];


    const {
        suspendHours,
        freezeHours
    } =
        calculateWarnAction(
            latestWarn.severity,
            activeWarns.length
        );


    // =================================================
    // SUSPEND DIN WARN
    // =================================================

    const existingWarnSuspend =
        await StaffSuspend.findOne({
            guildId: guild.id,
            userId: member.id,
            source: "warn"
        });


    if (suspendHours > 0) {

        await applyStaffSuspend(
            member,
            suspendHours,
            "Staff warn punishment",
            "warn"
        );

    }

    else if (existingWarnSuspend) {

        await removeStaffSuspend(
            member,
            "Staff warn punishment recalculated",
            "warn"
        );

    }


    // =================================================
    // FREEZE DIN WARN
    // =================================================

    const existingWarnFreeze =
        await StaffFreeze.findOne({
            guildId: guild.id,
            userId: member.id,
            source: "warn"
        });


    if (freezeHours > 0) {

        await applyStaffFreeze(
            member,
            freezeHours,
            "Staff warn punishment",
            "warn"
        );

    }

    else if (existingWarnFreeze) {

        await removeStaffFreeze(
            member,
            "Staff warn punishment recalculated",
            "warn"
        );

    }


    return {
        activeWarns:
            activeWarns.length,

        suspendHours,
        freezeHours
    };
}


// =====================================================
// /REMOVEWARNSTAFF
//
// MUTĂ WARN-UL:
// ACTIVE -> REMOVED
//
// NU ÎL ȘTERGE DIN HISTORY
// RECALCULEAZĂ SANCȚIUNILE
// =====================================================

async function handleRemoveWarnStaff(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "removewarnstaff"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const warnId =
        interaction.options.getInteger(
            "warn"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    // Motiv obligatoriu
    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Trebuie să specifici motivul eliminării warn-ului.",
            ephemeral: true
        });

        return true;
    }


    const data =
        await StaffWarn.findOne({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (!data) {

        await interaction.reply({
            content:
                "❌ Acest membru nu are warn-uri.",
            ephemeral: true
        });

        return true;
    }


    // Căutăm după WARN ID real,
    // nu după poziția din array.
    const warn =
        data.warns.find(
            w =>
                Number(w.warnId) ===
                Number(warnId)
        );


    if (!warn) {

        await interaction.reply({
            content:
                `❌ Warn #${warnId} nu există.`,
            ephemeral: true
        });

        return true;
    }


    if (warn.removed) {

        await interaction.reply({
            content:
                `❌ Warn #${warnId} este deja în Removed.`,
            ephemeral: true
        });

        return true;
    }


    if (!warn.active) {

        await interaction.reply({
            content:
                `❌ Warn #${warnId} nu mai este activ.`,
            ephemeral: true
        });

        return true;
    }


    let member;

    try {

        member =
            await interaction.guild.members.fetch(
                user.id
            );

    }

    catch {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit pe server.",
            ephemeral: true
        });

        return true;
    }


    // ===============================================
    // ACTIVE -> REMOVED
    // ===============================================

    warn.active = false;

    warn.removed = true;

    warn.removedBy =
        interaction.user.id;

    warn.removedAt =
        new Date();

    warn.removeReason =
        reason;


    await data.save();


    await recalculateWarnCounters(data);


    // ===============================================
    // RECALCULARE ROLURI / SANCȚIUNI
    // ===============================================

    const result =
        await recalculateWarnPunishments(
            interaction.guild,
            member,
            data
        );


    await sendStaffLog(
        interaction.guild,

`🗑 STAFF WARN REMOVED

Member: ${user.tag} (${user.id})
Warn ID: #${warnId}

Original reason: ${warn.reason}
Remove reason: ${reason}

Removed by: ${interaction.user.tag} (${interaction.user.id})

Active warns remaining: ${result.activeWarns}

New punishment:
Suspend: ${result.suspendHours}h
Freeze: ${result.freezeHours}h

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`✅ **Staff warn removed**

👤 Member: <@${user.id}>
🆔 Warn: **#${warnId}**

📝 Remove reason: ${reason}

📊 Active warns remaining: **${result.activeWarns}/6**

⚙️ Recalculated punishment:
Suspend: **${result.suspendHours}h**
Freeze: **${result.freezeHours}h**

Warn-ul rămâne în **Staff Warn History → Removed**.`
    );


    return true;
}


// =====================================================
// /CLEARWARNSTAFF
//
// TOATE WARN-URILE ACTIVE -> REMOVED
// MOTIV OBLIGATORIU
// RECALCULEAZĂ SANCȚIUNILE
// =====================================================

async function handleClearWarnStaff(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "clearwarnstaff"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Trebuie să specifici motivul pentru clear.",
            ephemeral: true
        });

        return true;
    }


    const data =
        await StaffWarn.findOne({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (!data) {

        await interaction.reply({
            content:
                "❌ Acest membru nu are warn-uri.",
            ephemeral: true
        });

        return true;
    }


    const activeWarns =
        getActiveWarns(data);


    if (!activeWarns.length) {

        await interaction.reply({
            content:
                "❌ Acest membru nu are warn-uri active.",
            ephemeral: true
        });

        return true;
    }


    let member;

    try {

        member =
            await interaction.guild.members.fetch(
                user.id
            );

    }

    catch {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit pe server.",
            ephemeral: true
        });

        return true;
    }


    const removedAt =
        new Date();


    // ===============================================
    // TOATE ACTIVE -> REMOVED
    // ===============================================

    for (const warn of activeWarns) {

        warn.active = false;

        warn.removed = true;

        warn.removedBy =
            interaction.user.id;

        warn.removedAt =
            removedAt;

        warn.removeReason =
            reason;

    }


    await data.save();


    await recalculateWarnCounters(data);


    // Nu mai există active,
    // deci se scot sancțiunile de warn.
    const result =
        await recalculateWarnPunishments(
            interaction.guild,
            member,
            data
        );


    await sendStaffLog(
        interaction.guild,

`🧹 STAFF WARNS CLEARED

Member: ${user.tag} (${user.id})

Warns moved to Removed: ${activeWarns.length}

Reason: ${reason}

Cleared by: ${interaction.user.tag} (${interaction.user.id})

Active warns remaining: ${result.activeWarns}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`🧹 **Staff warns cleared**

👤 Member: <@${user.id}>

🗑 Moved to Removed: **${activeWarns.length}**
📝 Reason: ${reason}

📊 Active warns: **0/6**

Warn-urile NU au fost șterse din istoric.
Le vei găsi în:

🔴 **Staff Warn History → Removed**`
    );


    return true;
}

// =====================================================
// /REMOVEWARNHISTORY
//
// ȘTERGE DEFINITIV UN WARN DIN ISTORIC
//
// IMPORTANT:
// - motiv obligatoriu
// - NU recalculează roluri
// - NU modifică freeze/suspend
// - poate șterge Active / Expired / Removed
// =====================================================

async function handleRemoveWarnHistory(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "removewarnhistory"
        ))
    )
        return true;


    const user =
        interaction.options.getUser("member");

    const warnId =
        interaction.options.getInteger("warnid");

    const reason =
        interaction.options.getString("reason");


    if (!reason?.trim()) {

        await interaction.reply({
            content: "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const data =
        await StaffWarn.findOne({
            guildId: interaction.guild.id,
            userId: user.id
        });


    if (!data || !data.warns?.length) {

        await interaction.reply({
            content: "❌ Acest membru nu are istoric de warn-uri.",
            ephemeral: true
        });

        return true;
    }


    const index =
        data.warns.findIndex(
            w =>
                Number(w.warnId) ===
                Number(warnId)
        );


    if (index === -1) {

        await interaction.reply({
            content: `❌ Warn #${warnId} nu există în istoric.`,
            ephemeral: true
        });

        return true;
    }


    const warn = data.warns[index];


    // Salvăm informațiile înainte de ștergere
    const originalReason =
        warn.reason || "N/A";

    const originalSeverity =
        warn.severity ?? "N/A";

    let oldStatus = "Active";

    if (warn.removed)
        oldStatus = "Removed";
    else if (
        !warn.active ||
        (
            warn.expireAt &&
            new Date(warn.expireAt) <= new Date()
        )
    )
        oldStatus = "Expired";


    // ===============================================
    // ȘTERGERE DEFINITIVĂ
    // ===============================================

    data.warns.splice(index, 1);


    /*
        Recalculăm DOAR contoarele afișate în DB.

        NU apelăm:
        recalculateWarnPunishments()

        deci rolurile/sancțiunile NU sunt atinse.
    */

    data.warnCount =
        getActiveWarns(data).length;

    data.warnCountExp =
        getExpiredWarns(data).length;

    data.warnCountRm =
        getRemovedWarns(data).length;


    await data.save();


    await sendStaffLog(
        interaction.guild,

`🗑 WARN DELETED FROM HISTORY

Member: ${user.tag} (${user.id})
Warn ID: #${warnId}

Previous status: ${oldStatus}
Original reason: ${originalReason}
Severity: ${originalSeverity}

Delete reason: ${reason}

Deleted by: ${interaction.user.tag} (${interaction.user.id})

⚠️ Punishments were NOT recalculated.

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`🗑 **Warn deleted from history**

👤 Member: <@${user.id}>
🆔 Warn: **#${warnId}**

Previous status: **${oldStatus}**
Original reason: ${originalReason}

📝 Delete reason: ${reason}

Warn-ul a fost șters **definitiv** din Staff Warn History.

⚠️ Rolurile și sancțiunile NU au fost recalculate.`
    );


    return true;
}


// =====================================================
// /CLEARWARNSTAFFHISTORY
//
// ȘTERGE DEFINITIV TOT ISTORICUL
//
// IMPORTANT:
// - motiv obligatoriu
// - NU recalculează sancțiuni
// - NU modifică roluri
// =====================================================

async function handleClearWarnStaffHistory(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "clearwarnstaffhistory"
        ))
    )
        return true;


    const user =
        interaction.options.getUser("member");

    const reason =
        interaction.options.getString("reason");


    if (!reason?.trim()) {

        await interaction.reply({
            content: "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const data =
        await StaffWarn.findOne({
            guildId: interaction.guild.id,
            userId: user.id
        });


    if (!data || !data.warns?.length) {

        await interaction.reply({
            content: "❌ Acest membru nu are istoric de warn-uri.",
            ephemeral: true
        });

        return true;
    }


    // Numărăm ce exista înainte
    const activeCount =
        getActiveWarns(data).length;

    const expiredCount =
        getExpiredWarns(data).length;

    const removedCount =
        getRemovedWarns(data).length;

    const totalCount =
        data.warns.length;


    // ===============================================
    // ȘTERGERE DEFINITIVĂ
    // ===============================================

    data.warns = [];

    data.warnCount = 0;
    data.warnCountExp = 0;
    data.warnCountRm = 0;


    await data.save();


    await sendStaffLog(
        interaction.guild,

`🧹 STAFF WARN HISTORY CLEARED

Member: ${user.tag} (${user.id})

Deleted:
Active: ${activeCount}
Expired: ${expiredCount}
Removed: ${removedCount}
Total: ${totalCount}

Reason: ${reason}

Cleared by: ${interaction.user.tag} (${interaction.user.id})

⚠️ Punishments were NOT recalculated.

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`🧹 **Staff warn history cleared**

👤 Member: <@${user.id}>

Deleted permanently:
🟢 Active: **${activeCount}**
🟡 Expired: **${expiredCount}**
🔴 Removed: **${removedCount}**
📊 Total: **${totalCount}**

📝 Reason: ${reason}

⚠️ Rolurile și sancțiunile NU au fost recalculate.`
    );


    return true;
}

// =====================================================
// FREEZE HELPERS
// =====================================================

function getStaffRoles(member) {
    return member.roles.cache.filter(role =>
        role.id !== member.guild.id &&
        staffHierarchy.includes(role.name) &&
        !role.managed
    );
}

function getHighestStaffRole(member) {
    for (const roleName of staffHierarchy) {
        const role = member.roles.cache.find(
            r => r.name === roleName
        );

        if (role) return role;
    }

    return null;
}

function getSavedRoles(member) {
    return member.roles.cache
        .filter(role =>
            role.id !== member.guild.id &&
            !role.managed
        )
        .map(role => role.id);
}


// =====================================================
// APPLY FREEZE
// =====================================================

async function applyStaffFreeze(
    member,
    hours,
    reason,
    source = "manual"
) {

    const config =
        await StaffConfig.findOne({
            guildId: member.guild.id
        });

    if (!config?.freezeRoleId) {
        throw new Error(
            "Freeze role is not configured"
        );
    }


    // Freeze existent din aceeași sursă
    const existingFreeze =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source
        });


    // Orice alt freeze activ al aceluiași membru
    const otherFreeze =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source: {
                $ne: source
            }
        });


    // =================================================
    // PĂSTRĂM BACKUP-UL ORIGINAL
    // =================================================

    let savedRoles;

    if (
        existingFreeze?.savedRoles?.length
    ) {

        savedRoles =
            existingFreeze.savedRoles;

    }

    else if (
        otherFreeze?.savedRoles?.length
    ) {

        savedRoles =
            otherFreeze.savedRoles;

    }

    else {

        savedRoles =
            getSavedRoles(member);

    }


    let permissionBackup = {};


    if (
        existingFreeze?.permissions &&
        Object.keys(
            existingFreeze.permissions
        ).length > 0
    ) {

        permissionBackup =
            existingFreeze.permissions;

    }

    else if (
        otherFreeze?.permissions &&
        Object.keys(
            otherFreeze.permissions
        ).length > 0
    ) {

        permissionBackup =
            otherFreeze.permissions;

    }


    // =================================================
    // APLICĂM PERMISIUNILE DOAR LA PRIMUL FREEZE
    // =================================================

    if (
        !existingFreeze &&
        !otherFreeze
    ) {

        const highestRole =
            getHighestStaffRole(member);

        permissionBackup = {};


        if (highestRole) {

            for (
                const channel
                of member.guild.channels.cache.values()
            ) {

                if (
                    !channel.permissionOverwrites
                )
                    continue;


                const sourceOverwrite =
                    channel.permissionOverwrites.cache.get(
                        highestRole.id
                    );


                if (!sourceOverwrite)
                    continue;


                const oldMemberOverwrite =
                    channel.permissionOverwrites.cache.get(
                        member.id
                    );


                if (oldMemberOverwrite) {

                    permissionBackup[channel.id] = {

                        allow:
                            oldMemberOverwrite.allow.toArray(),

                        deny:
                            oldMemberOverwrite.deny.toArray(),

                        type:
                            oldMemberOverwrite.type
                    };

                }

                else {

                    permissionBackup[channel.id] =
                        null;

                }


                const permissionData = {};


                if (
                    sourceOverwrite.allow.has(
                        "ViewChannel"
                    )
                ) {

                    permissionData.ViewChannel =
                        true;

                }

                else if (
                    sourceOverwrite.deny.has(
                        "ViewChannel"
                    )
                ) {

                    permissionData.ViewChannel =
                        false;

                }


                if (
                    sourceOverwrite.allow.has(
                        "Connect"
                    )
                ) {

                    permissionData.Connect =
                        true;

                }

                else if (
                    sourceOverwrite.deny.has(
                        "Connect"
                    )
                ) {

                    permissionData.Connect =
                        false;

                }


                if (
                    Object.keys(
                        permissionData
                    ).length > 0
                ) {

                    await channel
                        .permissionOverwrites
                        .edit(
                            member,
                            permissionData
                        )
                        .catch(() => {});

                }

            }

        }

    }


    const expiresAt =
        new Date(
            Date.now() +
            hours *
            60 *
            60 *
            1000
        );


    await StaffFreeze.findOneAndUpdate(

        {
            guildId: member.guild.id,
            userId: member.id,
            source
        },

        {
            guildId:
                member.guild.id,

            userId:
                member.id,

            reason,

            savedRoles,

            permissions:
                permissionBackup,

            expiresAt,

            source
        },

        {
            upsert: true,
            new: true
        }

    );


    // =================================================
    // SCOATEM ROLURILE STAFF
    // =================================================

    const staffRoles =
        getStaffRoles(member);


    if (staffRoles.size > 0) {

        await member.roles.remove(
            staffRoles,
            `Staff freeze: ${reason}`
        ).catch(() => {});

    }


    // Member rămâne
    if (
        config.memberRoleId &&
        !member.roles.cache.has(
            config.memberRoleId
        )
    ) {

        await member.roles.add(
            config.memberRoleId
        ).catch(() => {});

    }


    // Verify rămâne
    if (
        config.verifyRoleId &&
        !member.roles.cache.has(
            config.verifyRoleId
        )
    ) {

        await member.roles.add(
            config.verifyRoleId
        ).catch(() => {});

    }


    // Freeze Role
    if (
        !member.roles.cache.has(
            config.freezeRoleId
        )
    ) {

        await member.roles.add(
            config.freezeRoleId,
            `Staff freeze: ${reason}`
        ).catch(() => {});

    }


    return expiresAt;
}


// =====================================================
// REMOVE FREEZE
// =====================================================

async function removeStaffFreeze(
    member,
    reason,
    source = "manual"
) {

    const config =
        await StaffConfig.findOne({
            guildId: member.guild.id
        });


    let freezeQuery = {
    guildId: member.guild.id,
    userId: member.id
};


if (source === "manual") {

    freezeQuery.$or = [
        { source: "manual" },
        { source: { $exists: false } },
        { source: null }
    ];

}

else {

    freezeQuery.source =
        source;

}


const freezeData =
    await StaffFreeze.findOneAndDelete(
        freezeQuery
    );


    if (!freezeData)
        return false;


    // =================================================
    // MAI EXISTĂ ALT FREEZE?
    // =================================================

    const anotherFreeze =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id
        });


    // Dacă mai există unul,
    // NU scoatem Freeze Role,
    // NU restaurăm permissions,
    // NU restaurăm rolurile.
    if (anotherFreeze) {

        return true;

    }


    // =================================================
    // NU MAI EXISTĂ NICIUN FREEZE
    // =================================================

    if (config?.freezeRoleId) {

        await member.roles.remove(
            config.freezeRoleId
        ).catch(() => {});

    }


    // =================================================
    // RESTAURĂM PERMISIUNILE ORIGINALE
    // =================================================

    if (
        freezeData.permissions &&
        typeof freezeData.permissions ===
            "object"
    ) {

        for (
            const [
                channelId,
                oldOverwrite
            ]
            of Object.entries(
                freezeData.permissions
            )
        ) {

            const channel =
                member.guild.channels.cache.get(
                    channelId
                );


            if (
                !channel?.permissionOverwrites
            )
                continue;


            // Nu exista overwrite individual
            // înainte de freeze.
            if (!oldOverwrite) {

                await channel
                    .permissionOverwrites
                    .delete(member.id)
                    .catch(() => {});

                continue;

            }


            await channel
                .permissionOverwrites
                .edit(
                    member,
                    {
                        ViewChannel:
                            oldOverwrite.allow.includes(
                                "ViewChannel"
                            )
                                ? true
                                : oldOverwrite.deny.includes(
                                    "ViewChannel"
                                )
                                    ? false
                                    : null,

                        Connect:
                            oldOverwrite.allow.includes(
                                "Connect"
                            )
                                ? true
                                : oldOverwrite.deny.includes(
                                    "Connect"
                                )
                                    ? false
                                    : null
                    }
                )
                .catch(() => {});

        }

    }


    // =================================================
    // DACĂ MAI ESTE SUSPENDED,
    // NU RESTAURĂM ROLURILE STAFF
    // =================================================

    const stillSuspended =
        await StaffSuspend.findOne({
            guildId: member.guild.id,
            userId: member.id
        });


    if (!stillSuspended) {

        if (
            freezeData.savedRoles?.length
        ) {

            const validRoles =
                freezeData.savedRoles.filter(
                    roleId => {

                        const role =
                            member.guild.roles.cache.get(
                                roleId
                            );

                        return (
                            role &&
                            !role.managed
                        );

                    }
                );


            if (validRoles.length) {

                await member.roles.add(
                    validRoles,
                    reason
                ).catch(() => {});

            }

        }

    }


    return true;
}


// =====================================================
// APPLY SUSPEND
// =====================================================

async function applyStaffSuspend(
    member,
    hours,
    reason,
    source = "manual"
) {

    const config =
        await StaffConfig.findOne({
            guildId: member.guild.id
        });

    if (!config?.suspendRoleId) {
        throw new Error(
            "Suspend role is not configured"
        );
    }


    // Suspend existent din aceeași sursă
    const existingSuspend =
        await StaffSuspend.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source
        });


    // Suspend din cealaltă sursă
    const otherSuspend =
        await StaffSuspend.findOne({
            guildId: member.guild.id,
            userId: member.id,
            source: {
                $ne: source
            }
        });


    // Dacă este deja frozen, freeze-ul poate avea
    // backup-ul original al rolurilor.
    const existingFreeze =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id
        });


    // =================================================
    // BACKUP ROLURI
    // =================================================

    let savedRoles;

    if (
        existingSuspend?.savedRoles?.length
    ) {

        savedRoles =
            existingSuspend.savedRoles;

    }

    else if (
        otherSuspend?.savedRoles?.length
    ) {

        savedRoles =
            otherSuspend.savedRoles;

    }

    else if (
        existingFreeze?.savedRoles?.length
    ) {

        savedRoles =
            existingFreeze.savedRoles;

    }

    else {

        savedRoles =
            getSavedRoles(member);

    }


    const expiresAt =
        new Date(
            Date.now() +
            hours *
            60 *
            60 *
            1000
        );


    await StaffSuspend.findOneAndUpdate(

        {
            guildId: member.guild.id,
            userId: member.id,
            source
        },

        {
            guildId:
                member.guild.id,

            userId:
                member.id,

            reason,

            savedRoles,

            expiresAt,

            source
        },

        {
            upsert: true,
            new: true
        }

    );


    // =================================================
    // SCOATEM ROLURILE STAFF
    // =================================================

    const staffRoles =
        getStaffRoles(member);

    if (staffRoles.size > 0) {

        await member.roles.remove(
            staffRoles,
            `Staff suspend: ${reason}`
        ).catch(() => {});

    }


    // =================================================
    // SUSPEND ROLE
    // =================================================

    if (
        !member.roles.cache.has(
            config.suspendRoleId
        )
    ) {

        await member.roles.add(
            config.suspendRoleId,
            `Staff suspend: ${reason}`
        ).catch(() => {});

    }


    // =================================================
    // TIMEOUT = CEL MAI LUNG SUSPEND ACTIV
    // =================================================

    const allSuspends =
        await StaffSuspend.find({
            guildId: member.guild.id,
            userId: member.id
        });


    let longestExpiresAt =
        expiresAt;


    for (const suspend of allSuspends) {

        if (
            suspend.expiresAt &&
            new Date(suspend.expiresAt) >
            longestExpiresAt
        ) {

            longestExpiresAt =
                new Date(
                    suspend.expiresAt
                );

        }

    }


    const timeoutMs =
        Math.max(
            0,
            longestExpiresAt.getTime() -
            Date.now()
        );


    if (timeoutMs > 0) {

        await member.timeout(
            timeoutMs,
            reason
        ).catch(() => {});

    }


    return expiresAt;
}


// =====================================================
// REMOVE SUSPEND
// IMPORTANT:
// NU DĂ FREEZE
// =====================================================

async function removeStaffSuspend(
    member,
    reason,
    source = "manual"
) {

    const config =
        await StaffConfig.findOne({
            guildId: member.guild.id
        });


    const suspendData =
        await StaffSuspend.findOneAndDelete({
            guildId: member.guild.id,
            userId: member.id,
            source
        });


    if (!suspendData)
        return false;


    // =================================================
    // MAI EXISTĂ ALT SUSPEND?
    // =================================================

    const remainingSuspends =
        await StaffSuspend.find({
            guildId: member.guild.id,
            userId: member.id
        });


    if (remainingSuspends.length > 0) {

        // Suspend Role rămâne.

        // Timeout-ul trebuie mutat la suspend-ul
        // care expiră cel mai târziu.
        let longestExpiresAt = null;


        for (
            const suspend
            of remainingSuspends
        ) {

            if (!suspend.expiresAt)
                continue;


            const expires =
                new Date(
                    suspend.expiresAt
                );


            if (
                !longestExpiresAt ||
                expires > longestExpiresAt
            ) {

                longestExpiresAt =
                    expires;

            }

        }


        if (longestExpiresAt) {

            const remainingMs =
                Math.max(
                    0,
                    longestExpiresAt.getTime() -
                    Date.now()
                );


            if (remainingMs > 0) {

                await member.timeout(
                    remainingMs,
                    "Another staff suspension is still active"
                ).catch(() => {});

            }

        }


        // Nu restaurăm roluri:
        // încă există suspend.
        return true;
    }


    // =================================================
    // NU MAI EXISTĂ SUSPEND
    // =================================================

    if (config?.suspendRoleId) {

        await member.roles.remove(
            config.suspendRoleId
        ).catch(() => {});

    }


    await member.timeout(
        null,
        reason
    ).catch(() => {});


    // =================================================
    // DACĂ MAI EXISTĂ FREEZE,
    // NU RESTAURĂM ROLURILE
    // =================================================

    const stillFrozen =
        await StaffFreeze.findOne({
            guildId: member.guild.id,
            userId: member.id
        });


    if (stillFrozen) {

        return true;

    }


    // =================================================
    // RESTAURĂM ROLURILE ORIGINALE
    // =================================================

    if (
        suspendData.savedRoles?.length
    ) {

        const validRoles =
            suspendData.savedRoles.filter(
                roleId => {

                    const role =
                        member.guild.roles.cache.get(
                            roleId
                        );

                    return (
                        role &&
                        !role.managed
                    );

                }
            );


        if (validRoles.length) {

            await member.roles.add(
                validRoles,
                reason
            ).catch(() => {});

        }

    }


    return true;
}


// =====================================================
// /STAFFFREEZE
// =====================================================

async function handleStaffFreeze(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "stafffreeze"
        ))
    )
        return true;

    const config =
    await requireStaffConfig(
        interaction,
        [
            "freezeRoleId",
            "memberRoleId",
            "verifyRoleId"
        ]
    );

if (!config)
    return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const hours =
        interaction.options.getInteger(
            "hours"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    let member;

    try {

        member =
            await interaction.guild.members.fetch(
                user.id
            );

    }

    catch {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit.",
            ephemeral: true
        });

        return true;
    }


    try {

        const expiresAt =
            await applyStaffFreeze(
                member,
                hours,
                reason,
                "manual"
            );


        await sendStaffLog(
            interaction.guild,

`❄️ STAFF FREEZE

Member: ${member.user.tag} (${member.id})
Duration: ${hours}h
Reason: ${reason}

Moderator: ${interaction.user.tag} (${interaction.user.id})

Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:R>`
        );


        await interaction.reply(
`❄️ **Staff Freeze**

👤 Member: <@${member.id}>
⏱ Duration: **${hours}h**
📝 Reason: ${reason}

⏰ Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:R>`
        );

    }

    catch (error) {

        console.error(
            "[stafffreeze]",
            error
        );


        await interaction.reply({
            content:
                `❌ Freeze error: ${error.message}`,
            ephemeral: true
        });

    }


    return true;
}


// =====================================================
// /STAFFUNFREEZE
// =====================================================

async function handleStaffUnfreeze(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffunfreeze"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    if (!member) {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit.",
            ephemeral: true
        });

        return true;
    }


    const result =
        await removeStaffFreeze(
            member,
            reason
        );


    if (!result) {

        await interaction.reply({
            content:
                "❌ Membrul nu are freeze activ.",
            ephemeral: true
        });

        return true;
    }


    await sendStaffLog(
        interaction.guild,

`✅ STAFF UNFREEZE

Member: ${member.user.tag} (${member.id})
Reason: ${reason}

Moderator: ${interaction.user.tag} (${interaction.user.id})

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
        `✅ Freeze eliminat de la <@${member.id}>.`
    );


    return true;
}


// =====================================================
// /STAFFSUSPEND
// =====================================================

async function handleStaffSuspend(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffsuspend"
        ))
    )
        return true;

    const config =
    await requireStaffConfig(
        interaction,
        [
            "suspendRoleId",
            "memberRoleId",
            "verifyRoleId"
        ]
    );

if (!config)
    return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const hours =
        interaction.options.getInteger(
            "hours"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    if (!member) {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit.",
            ephemeral: true
        });

        return true;
    }


    try {

        const expiresAt =
            await applyStaffSuspend(
                member,
                hours,
                reason,
                "manual"
            );


        await sendStaffLog(
            interaction.guild,

`⛔ STAFF SUSPEND

Member: ${member.user.tag} (${member.id})
Duration: ${hours}h
Reason: ${reason}

Moderator: ${interaction.user.tag} (${interaction.user.id})

Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:R>`
        );


        await interaction.reply(
`⛔ **Staff Suspend**

👤 Member: <@${member.id}>
⏱ Duration: **${hours}h**
📝 Reason: ${reason}

⏰ Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:R>`
        );

    }

    catch (error) {

        console.error(
            "[staffsuspend]",
            error
        );


        await interaction.reply({
            content:
                `❌ Suspend error: ${error.message}`,
            ephemeral: true
        });

    }


    return true;
}


// =====================================================
// /STAFFUNSUSPEND
// =====================================================

async function handleStaffUnsuspend(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffunsuspend"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    if (!member) {

        await interaction.reply({
            content:
                "❌ Membrul nu a fost găsit.",
            ephemeral: true
        });

        return true;
    }


    const result =
        await removeStaffSuspend(
            member,
            reason
        );


    if (!result) {

        await interaction.reply({
            content:
                "❌ Membrul nu are suspend activ.",
            ephemeral: true
        });

        return true;
    }


    await sendStaffLog(
        interaction.guild,

`✅ STAFF UNSUSPEND

Member: ${member.user.tag} (${member.id})
Reason: ${reason}

Moderator: ${interaction.user.tag} (${interaction.user.id})

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
        `✅ Suspend eliminat de la <@${member.id}>.`
    );


    return true;
}


// =====================================================
// STAFF TIMER
// Verificare la 30 secunde
// =====================================================

let staffTimerStarted = false;

function startStaffTimer(client) {

    if (staffTimerStarted)
        return;

    staffTimerStarted = true;


    setInterval(

        async () => {

            try {

                const now = new Date();


                // =====================================
                // WARN EXPIRY
                // =====================================

                const warnDocuments =
                    await StaffWarn.find();


                for (const data of warnDocuments) {

                    let changed = false;


                    for (const warn of data.warns) {

                        if (
                            warn.active &&
                            !warn.removed &&
                            warn.expireAt &&
                            new Date(warn.expireAt) <= now
                        ) {

                            warn.active = false;

                            changed = true;

                        }

                    }


                    if (!changed)
                        continue;


                    await recalculateWarnCounters(
                        data
                    );


                    const guild =
                        client.guilds.cache.get(
                            data.guildId
                        );


                    if (!guild)
                        continue;


                    const member =
                        await guild.members.fetch(
                            data.userId
                        ).catch(() => null);


                    // După expirarea unui warn,
                    // recalculăm sancțiunile după
                    // warn-urile care mai sunt active.
                    if (member) {

                        await recalculateWarnPunishments(
                            guild,
                            member,
                            data
                        );

                    }


                    await sendStaffLog(
                        guild,

`🧹 STAFF WARN EXPIRED

Member: <@${data.userId}>

Active warns:
${data.warnCount}/6

Expired warns:
${data.warnCountExp}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
                    );

                }


// =====================================
// FREEZE EXPIRY
// =====================================

const freezes =
    await StaffFreeze.find({
        expiresAt: {
            $lte: now
        }
    });


for (const freeze of freezes) {

    const guild =
        client.guilds.cache.get(
            freeze.guildId
        );


    if (!guild)
        continue;


    const member =
        await guild.members.fetch(
            freeze.userId
        ).catch(() => null);


    if (!member) {

        await StaffFreeze.deleteOne({
            _id: freeze._id
        });

        continue;
    }


    const freezeSource =
        freeze.source || "manual";


    const removed =
        await removeStaffFreeze(
            member,
            freezeSource === "warn"
                ? "Warn freeze expired automatically"
                : "Freeze expired automatically",
            freezeSource
        );


    // IMPORTANT:
    // Dacă nu s-a șters nimic,
    // NU trimitem log.
    if (!removed)
        continue;


    await sendStaffLog(
        guild,

`✅ STAFF FREEZE EXPIRED

Member: <@${member.id}>
Source: ${freezeSource === "warn" ? "Staff Warn" : "Manual"}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );

}


// =====================================
// SUSPEND EXPIRY
// =====================================

const suspends =
    await StaffSuspend.find({
        expiresAt: {
            $lte: now
        }
    });


for (const suspend of suspends) {

    const guild =
        client.guilds.cache.get(
            suspend.guildId
        );


    if (!guild)
        continue;


    const member =
        await guild.members.fetch(
            suspend.userId
        ).catch(() => null);


    if (!member) {

        await StaffSuspend.deleteOne({
            _id: suspend._id
        });

        continue;
    }


    const suspendSource =
        suspend.source || "manual";


    await removeStaffSuspend(
        member,
        suspendSource === "warn"
            ? "Warn suspend expired automatically"
            : "Suspend expired automatically",
        suspendSource
    );


    await sendStaffLog(
        guild,

`✅ STAFF SUSPEND EXPIRED

Member: <@${member.id}>
Source: ${suspendSource === "warn" ? "Staff Warn" : "Manual"}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );

}


                // =====================================
                // PROBATION EXPIRY
                // =====================================

                const probations =
                    await StaffProbation.find({

                        expiresAt: {
                            $lte: now
                        }

                    });


                for (const probation of probations) {

                    await StaffProbation.deleteOne({
                        _id: probation._id
                    });


                    const guild =
                        client.guilds.cache.get(
                            probation.guildId
                        );


                    if (!guild)
                        continue;


                    await sendStaffLog(
                        guild,

`✅ STAFF PROBATION EXPIRED

Member: <@${probation.userId}>

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
                    );

                }

            }

            catch (error) {

                console.error(
                    "[STAFF TIMER]",
                    error
                );

            }

        },

        30 * 1000

    );

}

// =====================================================
// /STAFFPROBATION
// =====================================================

async function handleStaffProbation(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "staffprobation"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const days =
        interaction.options.getInteger(
            "days"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const expiresAt =
        new Date(
            Date.now() +
            days *
            24 *
            60 *
            60 *
            1000
        );


    await StaffProbation.findOneAndUpdate(

        {
            guildId:
                interaction.guild.id,

            userId:
                user.id
        },

        {
            guildId:
                interaction.guild.id,

            userId:
                user.id,

            reason,

            moderatorId:
                interaction.user.id,

            expiresAt
        },

        {
            upsert: true,
            new: true
        }

    );


    await sendStaffLog(
        interaction.guild,

`⚠️ STAFF PROBATION

Member: <@${user.id}> (${user.id})

Duration: ${days} day(s)
Reason: ${reason}

Moderator: <@${interaction.user.id}>

Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:F>

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`⚠️ **Staff Probation**

👤 Member: <@${user.id}>
📅 Duration: **${days} day(s)**
📝 Reason: ${reason}

⏰ Expires: <t:${Math.floor(
    expiresAt.getTime() / 1000
)}:R>`
    );


    return true;
}


// =====================================================
// /STAFFUNPROBATION
//
// MEMBER + REASON OBLIGATORIU
// =====================================================

async function handleStaffUnprobation(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffunprobation"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const probation =
        await StaffProbation.findOneAndDelete({

            guildId:
                interaction.guild.id,

            userId:
                user.id

        });


    if (!probation) {

        await interaction.reply({
            content:
                "❌ Acest membru nu este în probation.",
            ephemeral: true
        });

        return true;
    }


    await sendStaffLog(
        interaction.guild,

`✅ STAFF UNPROBATION

Member: <@${user.id}> (${user.id})

Reason: ${reason}

Moderator: <@${interaction.user.id}>

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`✅ **Staff Unprobation**

👤 Member: <@${user.id}>
📝 Reason: ${reason}

Probation-ul a fost eliminat.`
    );


    return true;
}


// =====================================================
// BLACKLIST CONFIG HELPERS
// =====================================================

async function getBlacklistConfig(
    guildId
) {

    let config =
        await BlacklistConfig.findOne({
            guildId
        });


    if (!config) {

        config =
            await BlacklistConfig.create({
                guildId,

                logChannelId:
                    null,

                normalForbiddenRoleIds:
                    [],

                staffForbiddenRoleIds:
                    []
            });

    }


    return config;
}


// =====================================================
// BLACKLIST LOG
// =====================================================

async function sendBlacklistLog(
    guild,
    message
) {

    try {

        const config =
            await getBlacklistConfig(
                guild.id
            );


        if (
            !config.logChannelId
        )
            return;


        const channel =
            guild.channels.cache.get(
                config.logChannelId
            );


        if (
            !channel ||
            !channel.isTextBased()
        )
            return;


        await channel.send(
            message
        );

    }

    catch (error) {

        console.error(
            "[BLACKLIST LOG ERROR]",
            error
        );

    }

}


// =====================================================
// ACTIVE BLACKLIST
// =====================================================

async function getActiveBlacklist(
    guildId,
    userId,
    type
) {

    return BlacklistEntry.findOne({

        guildId,

        userId,

        type,

        active: true

    });

}


// =====================================================
// REMOVE FORBIDDEN ROLES
// =====================================================

async function removeForbiddenRoles(
    member,
    type
) {

    const config =
        await getBlacklistConfig(
            member.guild.id
        );


    let forbiddenRoles = [];


    if (
        type === "staff"
    ) {

        forbiddenRoles =
            config.staffForbiddenRoleIds || [];

    }

    else {

        forbiddenRoles =
            config.normalForbiddenRoleIds || [];

    }


    const rolesToRemove =
        member.roles.cache.filter(

            role =>
                forbiddenRoles.includes(
                    role.id
                ) &&
                !role.managed &&
                role.id !==
                    member.guild.id

        );


    if (
        rolesToRemove.size === 0
    )
        return [];


    await member.roles.remove(
        rolesToRemove,
        `${type} blacklist`
    ).catch(() => {});


    return [
        ...rolesToRemove.values()
    ];

}


// =====================================================
// /BLACKLIST
//
// NORMAL BLACKLIST
// Grad 1+
// =====================================================

async function handleBlacklist(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "blacklist"
        ))
    )
        return true;

    const blacklistConfig =
    await requireBlacklistConfig(
        interaction,
        "normal"
    );

if (!blacklistConfig)
    return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const existing =
        await getActiveBlacklist(

            interaction.guild.id,

            user.id,

            "normal"

        );


    if (existing) {

        await interaction.reply({
            content:
                "❌ Membrul este deja pe Blacklist.",
            ephemeral: true
        });

        return true;
    }


    await BlacklistEntry.create({

        guildId:
            interaction.guild.id,

        userId:
            user.id,

        type:
            "normal",

        reason,

        moderatorId:
            interaction.user.id,

        active:
            true,

        date:
            new Date()

    });


    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    let removedRoles = [];


    if (member) {

        removedRoles =
            await removeForbiddenRoles(
                member,
                "normal"
            );

    }


    await sendBlacklistLog(
        interaction.guild,

`🚫 BLACKLIST

Member: <@${user.id}> (${user.id})

Reason: ${reason}

Moderator:
<@${interaction.user.id}>

Removed forbidden roles:
${
    removedRoles.length
        ?
        removedRoles
            .map(
                role =>
                    `<@&${role.id}>`
            )
            .join(", ")
        :
        "None"
}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`🚫 **Blacklist**

👤 Member: <@${user.id}>
📝 Reason: ${reason}

Blacklist-ul a fost aplicat.`
    );


    return true;
}


// =====================================================
// /STAFFBLACKLIST
//
// DOAR Grad 2 + Bot Admin
// =====================================================

async function handleStaffBlacklist(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "staffblacklist"
        ))
    )
        return true;

    const blacklistConfig =
    await requireBlacklistConfig(
        interaction,
        "staff"
    );

if (!blacklistConfig)
    return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );


    if (!reason?.trim()) {

        await interaction.reply({
            content:
                "❌ Motivul este obligatoriu.",
            ephemeral: true
        });

        return true;
    }


    const existing =
        await getActiveBlacklist(

            interaction.guild.id,

            user.id,

            "staff"

        );


    if (existing) {

        await interaction.reply({
            content:
                "❌ Membrul este deja pe Staff Blacklist.",
            ephemeral: true
        });

        return true;
    }


    await BlacklistEntry.create({

        guildId:
            interaction.guild.id,

        userId:
            user.id,

        type:
            "staff",

        reason,

        moderatorId:
            interaction.user.id,

        active:
            true,

        date:
            new Date()

    });


    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    let removedRoles = [];


    if (member) {

        removedRoles =
            await removeForbiddenRoles(
                member,
                "staff"
            );

    }


    await sendBlacklistLog(
        interaction.guild,

`🛡 STAFF BLACKLIST

Member: <@${user.id}> (${user.id})

Reason: ${reason}

Moderator:
<@${interaction.user.id}>

Removed forbidden roles:
${
    removedRoles.length
        ?
        removedRoles
            .map(
                role =>
                    `<@&${role.id}>`
            )
            .join(", ")
        :
        "None"
}

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
`🛡 **Staff Blacklist**

👤 Member: <@${user.id}>
📝 Reason: ${reason}

Staff Blacklist-ul a fost aplicat.`
    );


    return true;
}


// =====================================================
// /VIEWBLACKLIST
//
// SUS NORMAL
// JOS STAFF
// =====================================================

async function handleViewBlacklist(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "viewblacklist"
        ))
    )
        return true;


    const normal =
        await BlacklistEntry.find({

            guildId:
                interaction.guild.id,

            type:
                "normal",

            active:
                true

        }).sort({
            date: 1
        });


    const staff =
        await BlacklistEntry.find({

            guildId:
                interaction.guild.id,

            type:
                "staff",

            active:
                true

        }).sort({
            date: 1
        });


    let text =
`🚫 **BLACKLIST MEMBERS**

`;


    if (!normal.length) {

        text +=
            "No members blacklisted.\n";

    }

    else {

        normal.forEach(
            (entry, index) => {

                text +=
`**${index + 1}.** <@${entry.userId}>
Reason: ${entry.reason}
By: <@${entry.moderatorId}>
Date: <t:${Math.floor(
    new Date(
        entry.date
    ).getTime() / 1000
)}:F>

`;

            }
        );

    }


    text +=
`
━━━━━━━━━━━━━━━━━━━━

🛡 **STAFF BLACKLIST**

`;


    if (!staff.length) {

        text +=
            "No staff blacklisted.";

    }

    else {

        staff.forEach(
            (entry, index) => {

                text +=
`**${index + 1}.** <@${entry.userId}>
Reason: ${entry.reason}
By: <@${entry.moderatorId}>
Date: <t:${Math.floor(
    new Date(
        entry.date
    ).getTime() / 1000
)}:F>

`;

            }
        );

    }


    await interaction.reply(
        text.slice(
            0,
            1990
        )
    );


    return true;
}


// =====================================================
// /UNBLACKLIST
// NORMAL
// =====================================================

async function handleUnblacklist(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "unblacklist"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );

        if (!reason?.trim()) {

    await interaction.reply({
        content:
            "❌ Motivul este obligatoriu.",
        ephemeral: true
    });

    return true;
}


    const blacklist =
        await getActiveBlacklist(

            interaction.guild.id,

            user.id,

            "normal"

        );


    if (!blacklist) {

        await interaction.reply({
            content:
                "❌ Membrul nu este pe Blacklist.",
            ephemeral: true
        });

        return true;
    }


    blacklist.active =
        false;

    blacklist.removedBy =
        interaction.user.id;

    blacklist.removedAt =
        new Date();

    blacklist.removeReason =
        reason;


    await blacklist.save();


    await sendBlacklistLog(
        interaction.guild,

`✅ UNBLACKLIST

Member: <@${user.id}>

Reason: ${reason}

Removed by:
<@${interaction.user.id}>

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
        `✅ <@${user.id}> a fost scos de pe Blacklist.`
    );


    return true;
}


// =====================================================
// /STAFFUNBLACKLIST
// =====================================================

async function handleStaffUnblacklist(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "staffunblacklist"
        ))
    )
        return true;


    const user =
        interaction.options.getUser(
            "member"
        );

    const reason =
        interaction.options.getString(
            "reason"
        );

        if (!reason?.trim()) {

    await interaction.reply({
        content:
            "❌ Motivul este obligatoriu.",
        ephemeral: true
    });

    return true;
}


    const blacklist =
        await getActiveBlacklist(

            interaction.guild.id,

            user.id,

            "staff"

        );


    if (!blacklist) {

        await interaction.reply({
            content:
                "❌ Membrul nu este pe Staff Blacklist.",
            ephemeral: true
        });

        return true;
    }


    blacklist.active =
        false;

    blacklist.removedBy =
        interaction.user.id;

    blacklist.removedAt =
        new Date();

    blacklist.removeReason =
        reason;


    await blacklist.save();


    await sendBlacklistLog(
        interaction.guild,

`✅ STAFF UNBLACKLIST

Member: <@${user.id}>

Reason: ${reason}

Removed by:
<@${interaction.user.id}>

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
        `✅ <@${user.id}> a fost scos de pe Staff Blacklist.`
    );


    return true;
}

// =====================================================
// BLACKLIST ROLE PROTECTION
//
// Dacă unui player blacklistat i se acordă
// un rol interzis, botul îl scoate automat.
// =====================================================

function registerBlacklistProtection(
    client
) {

    client.on(
        "guildMemberUpdate",

        async (
            oldMember,
            newMember
        ) => {

            try {

                // Detectăm rolurile noi
                const addedRoles =
                    newMember.roles.cache.filter(

                        role =>
                            !oldMember.roles.cache.has(
                                role.id
                            )

                    );


                if (
                    addedRoles.size === 0
                )
                    return;


                // Blacklist normal
                const normalBlacklist =
                    await getActiveBlacklist(

                        newMember.guild.id,

                        newMember.id,

                        "normal"

                    );


                // Staff blacklist
                const staffBlacklist =
                    await getActiveBlacklist(

                        newMember.guild.id,

                        newMember.id,

                        "staff"

                    );


                if (
                    !normalBlacklist &&
                    !staffBlacklist
                )
                    return;


                const config =
                    await getBlacklistConfig(
                        newMember.guild.id
                    );


                const forbidden =
                    new Set();


                if (
                    normalBlacklist
                ) {

                    for (
                        const roleId
                        of config.normalForbiddenRoleIds
                    ) {

                        forbidden.add(
                            roleId
                        );

                    }

                }


                if (
                    staffBlacklist
                ) {

                    for (
                        const roleId
                        of config.staffForbiddenRoleIds
                    ) {

                        forbidden.add(
                            roleId
                        );

                    }

                }


                const forbiddenAdded =
                    addedRoles.filter(

                        role =>
                            forbidden.has(
                                role.id
                            ) &&
                            !role.managed

                    );


                if (
                    forbiddenAdded.size === 0
                )
                    return;


                // Eliminăm imediat rolurile
                await newMember.roles.remove(
                    forbiddenAdded,
                    "Blacklist role protection"
                ).catch(() => {});


                await sendBlacklistLog(
                    newMember.guild,

`🛡 BLACKLIST ROLE PROTECTION

Member:
<@${newMember.id}>

Blocked roles:
${forbiddenAdded
    .map(
        role =>
            `<@&${role.id}>`
    )
    .join(", ")}

Normal Blacklist:
${normalBlacklist ? "YES" : "NO"}

Staff Blacklist:
${staffBlacklist ? "YES" : "NO"}

Action:
Role(s) automatically removed.

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
                );

            }

            catch (error) {

                console.error(
                    "[BLACKLIST PROTECTION ERROR]",
                    error
                );

            }

        }

    );

}

// =====================================================
// /SETBLACKLISTROLE
// Adaugă un rol interzis pentru Normal / Staff
// DOAR BOT ADMIN
// =====================================================

async function handleSetBlacklistRole(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "setblacklistrole"
        ))
    )
        return true;


    const type =
        interaction.options.getString("type");

    const role =
        interaction.options.getRole("role");


    const config =
        await getBlacklistConfig(
            interaction.guild.id
        );


    const field =
        type === "staff"
            ? "staffForbiddenRoleIds"
            : "normalForbiddenRoleIds";


    let roles =
        [...(config[field] || [])];


    if (roles.includes(role.id)) {

        await interaction.reply({
            content:
                `❌ ${role} este deja în lista de roluri interzise pentru **${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}**.`,
            ephemeral: true
        });

        return true;
    }


    roles.push(role.id);

    config[field] = roles;

    await config.save();


    await sendBlacklistLog(
        interaction.guild,

`⚙️ BLACKLIST ROLE ADDED

Type:
${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}

Role:
${role} (${role.id})

Added by:
${interaction.user} (${interaction.user.id})

Time:
<t:${Math.floor(Date.now() / 1000)}:F>`
    );


    await interaction.reply(
        `✅ ${role} a fost adăugat în rolurile interzise pentru **${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}**.`
    );


    return true;
}


// =====================================================
// /UNSETBLACKLISTROLE
// Scoate un rol din lista interzisă
// DOAR BOT ADMIN
// =====================================================

async function handleUnsetBlacklistRole(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "unsetblacklistrole"
        ))
    )
        return true;


    const type =
        interaction.options.getString("type");

    const role =
        interaction.options.getRole("role");


    const config =
        await getBlacklistConfig(
            interaction.guild.id
        );


    const field =
        type === "staff"
            ? "staffForbiddenRoleIds"
            : "normalForbiddenRoleIds";


    let roles =
        [...(config[field] || [])];


    if (!roles.includes(role.id)) {

        await interaction.reply({
            content:
                `❌ ${role} nu se află în lista interzisă pentru **${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}**.`,
            ephemeral: true
        });

        return true;
    }


    roles =
        roles.filter(
            roleId =>
                roleId !== role.id
        );


    config[field] = roles;

    await config.save();


    await sendBlacklistLog(
        interaction.guild,

`⚙️ BLACKLIST ROLE REMOVED

Type:
${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}

Role:
${role} (${role.id})

Removed by:
${interaction.user} (${interaction.user.id})

Time:
<t:${Math.floor(Date.now() / 1000)}:F>`
    );


    await interaction.reply(
        `✅ ${role} a fost scos din rolurile interzise pentru **${type === "staff" ? "Staff Blacklist" : "Normal Blacklist"}**.`
    );


    return true;
}


// =====================================================
// /VIEWBLACKLISTROLES
// Arată rolurile interzise
// DOAR BOT ADMIN
// =====================================================

async function handleViewBlacklistRoles(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "viewblacklistroles"
        ))
    )
        return true;


    const config =
        await getBlacklistConfig(
            interaction.guild.id
        );


    const normalRoles =
        config.normalForbiddenRoleIds || [];

    const staffRoles =
        config.staffForbiddenRoleIds || [];


    let text =
`🚫 **NORMAL BLACKLIST — ROLURI INTERZISE**

`;


    if (!normalRoles.length) {

        text +=
            "Niciun rol configurat.\n";

    }

    else {

        normalRoles.forEach(
            (roleId, index) => {

                text +=
                    `**${index + 1}.** <@&${roleId}>\n`;

            }
        );

    }


    text +=
`
━━━━━━━━━━━━━━━━━━━━

🛡 **STAFF BLACKLIST — ROLURI INTERZISE**

`;


    if (!staffRoles.length) {

        text +=
            "Niciun rol configurat.";

    }

    else {

        staffRoles.forEach(
            (roleId, index) => {

                text +=
                    `**${index + 1}.** <@&${roleId}>\n`;

            }
        );

    }


    await interaction.reply(
        text
    );


    return true;
}


// =====================================================
// /SETBLACKLISTCHANNEL
// Canal comun pentru logurile ambelor blacklist-uri
// DOAR BOT ADMIN
// =====================================================

async function handleSetBlacklistChannel(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "setblacklistchannel"
        ))
    )
        return true;


    const channel =
        interaction.options.getChannel(
            "channel"
        );


    const config =
        await getBlacklistConfig(
            interaction.guild.id
        );


    config.logChannelId =
        channel.id;


    await config.save();


    await interaction.reply(
        `✅ Canalul pentru logurile blacklist a fost setat la ${channel}.`
    );


    return true;
}

// =====================================================
// /SETMODROL
// DOAR BOT ADMIN
// =====================================================

async function handleSetModRole(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "setmodrol"
        ))
    )
        return true;


    const grad =
        interaction.options.getInteger(
            "grad"
        );

    const role =
        interaction.options.getRole(
            "role"
        );


    let config =
        await ModeratorConfig.findOne({
            guildId: interaction.guild.id
        });


    if (!config) {

        config =
            await ModeratorConfig.create({
                guildId: interaction.guild.id
            });

    }


    if (grad === 1) {

        config.grad1RoleId =
            role.id;

    }

    else if (grad === 2) {

        config.grad2RoleId =
            role.id;

    }

    else {

        await interaction.reply({
            content:
                "❌ Grad invalid.",
            ephemeral: true
        });

        return true;
    }


    await config.save();


    await sendStaffLog(
        interaction.guild,

`⚙️ MODERATOR ROLE SET

Grad: ${grad}
Role: ${role} (${role.id})

Set by: ${interaction.user} (${interaction.user.id})

Time: <t:${Math.floor(
    Date.now() / 1000
)}:F>`
    );


    await interaction.reply(
        `✅ Rolul ${role} a fost setat pentru **Moderator Grad ${grad}**.`
    );


    return true;
}

// =====================================================
// /VIEWMODROLE
// DOAR BOT ADMIN
// =====================================================

async function handleViewModRole(interaction) {

    if (
        !(await requireAccess(
            interaction,
            "viewmodrole"
        ))
    )
        return true;


    const config =
        await ModeratorConfig.findOne({
            guildId: interaction.guild.id
        });


    const grad1 =
        config?.grad1RoleId
            ? `<@&${config.grad1RoleId}>`
            : "Nesetat";

    const grad2 =
        config?.grad2RoleId
            ? `<@&${config.grad2RoleId}>`
            : "Nesetat";


    await interaction.reply(
`🛡️ **ROLURI MODERATOR**

**GRAD 1**
${grad1}

━━━━━━━━━━━━━━━━━━━━

**GRAD 2**
${grad2}`
    );


    return true;
}

// =====================================================
// /VIEWMODERATORS
// PUBLIC
// =====================================================

async function handleViewModerators(interaction) {

    const config =
        await ModeratorConfig.findOne({
            guildId: interaction.guild.id
        });


    if (
        !config?.grad1RoleId &&
        !config?.grad2RoleId
    ) {

        await interaction.reply(
            "❌ Rolurile de moderator nu sunt configurate."
        );

        return true;
    }


    await interaction.guild.members.fetch();


    const grad1Members =
        config.grad1RoleId
            ? interaction.guild.members.cache.filter(
                member =>
                    member.roles.cache.has(
                        config.grad1RoleId
                    )
            )
            : new Map();


    const grad2Members =
        config.grad2RoleId
            ? interaction.guild.members.cache.filter(
                member =>
                    member.roles.cache.has(
                        config.grad2RoleId
                    )
            )
            : new Map();


    let text =
`🛡️ **MODERATORI**

**GRAD 1**
`;


    if (grad1Members.size === 0) {

        text +=
            "Niciun moderator.\n";

    }

    else {

        let index = 1;

        for (
            const member
            of grad1Members.values()
        ) {

            text +=
                `**${index}.** <@${member.id}>\n`;

            index++;

        }

    }


    text +=
`
━━━━━━━━━━━━━━━━━━━━

**GRAD 2**
`;


    if (grad2Members.size === 0) {

        text +=
            "Niciun moderator.";

    }

    else {

        let index = 1;

        for (
            const member
            of grad2Members.values()
        ) {

            text +=
                `**${index}.** <@${member.id}>\n`;

            index++;

        }

    }


    await interaction.reply(text);

    return true;
}

// =====================================================
// /VIEWCOMMANDS
// Arată doar comenzile la care utilizatorul are acces
// =====================================================

async function handleViewCommands(interaction) {

    const botAdmin =
        await isBotAdmin(interaction);

    const level =
        await getModeratorLevel(interaction);


    const publicCommands = [
        "viewmoderators"
    ];


    let allowedCommands =
        [...publicCommands];


    if (level >= 1) {

        allowedCommands.push(
            ...GRAD1_COMMANDS
        );

    }


    if (level >= 2) {

        allowedCommands.push(
            ...GRAD2_COMMANDS
        );

    }


    if (botAdmin) {

        allowedCommands.push(
            ...GRAD1_COMMANDS,
            ...GRAD2_COMMANDS,
            ...BOT_ADMIN_ONLY
        );

    }


    // eliminăm duplicatele
    allowedCommands =
        [...new Set(
            allowedCommands
        )];


    // viewcommands trebuie să apară mereu
    if (
        !allowedCommands.includes(
            "viewcommands"
        )
    ) {

        allowedCommands.push(
            "viewcommands"
        );

    }


    allowedCommands.sort();


    let text =
`📋 **COMENZILE TALE DISPONIBILE**

`;


    for (
        const command
        of allowedCommands
    ) {

        text +=
            `• \`/${command}\`\n`;

    }


    if (botAdmin) {

        text +=
`\n🛡️ Nivel acces: **Bot Admin**`;

    }

    else if (level >= 2) {

        text +=
`\n🔴 Nivel acces: **Moderator Grad 2**`;

    }

    else if (level >= 1) {

        text +=
`\n🟡 Nivel acces: **Moderator Grad 1**`;

    }

    else {

        text +=
`\n⚪ Nivel acces: **Public**`;

    }


    await interaction.reply({
        content: text,
        ephemeral: true
    });


    return true;
}

async function handleSetStaffWarnLog(
    interaction
) {

    if (
        !(await requireAccess(
            interaction,
            "setstaffwarnlog"
        ))
    )
        return true;


    const channel =
        interaction.options.getChannel(
            "channel"
        );


    await StaffConfig.findOneAndUpdate(
        {
            guildId:
                interaction.guild.id
        },
        {
            $set: {
                warnLogChannelId:
                    channel.id
            }
        },
        {
            upsert: true,
            new: true
        }
    );


    await interaction.reply({
        content:
            `✅ Staff Warn Log a fost setat pe ${channel}.`,
        ephemeral: true
    });


    return true;
}

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("setmodrol")
        .setDescription("Setează rol Moderator Grad 1 sau 2")
        .addIntegerOption(o =>
            o.setName("grad")
                .setDescription("Grad moderator")
                .setRequired(true)
                .addChoices(
                    { name: "Grad 1", value: 1 },
                    { name: "Grad 2", value: 2 }
                )
        )
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol moderator")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
    .setName("viewmodrole")
    .setDescription("Vezi rolurile configurate pentru Moderator Grad 1 și 2"),

new SlashCommandBuilder()
    .setName("viewmoderators")
    .setDescription("Vezi lista moderatorilor Grad 1 și Grad 2"),

    new SlashCommandBuilder()
        .setName("warnstaff")
        .setDescription("Acordă un warn staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("severity")
                .setDescription("Severity 1-7")
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
                .setDescription("Motiv")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("task")
                .setDescription("Task")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("staffwarns")
        .setDescription("Vezi warn-urile active")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffinfo")
        .setDescription("Vezi informațiile active despre warn-uri")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffwarnhistory")
        .setDescription("Vezi istoricul complet de warn-uri")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("removewarnstaff")
        .setDescription("Elimină un warn activ")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("warn")
                .setDescription("Warn ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clearwarnstaff")
        .setDescription("Elimină toate warn-urile active")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("removewarnhistory")
        .setDescription("Șterge definitiv un warn din istoric")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("warnid")
                .setDescription("Warn ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clearwarnstaffhistory")
        .setDescription("Șterge definitiv istoricul de warn-uri")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
    .setName("setstaffwarnlog")
    .setDescription("Setează canalul pentru logurile /warnstaff")
    .addChannelOption(o =>
        o.setName("channel")
            .setDescription("Canal pentru Staff Warn Log")
            .setRequired(true)
    ),

    new SlashCommandBuilder()
        .setName("stafffreeze")
        .setDescription("Freeze staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("hours")
                .setDescription("Ore")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffunfreeze")
        .setDescription("Scoate freeze staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffsuspend")
        .setDescription("Suspend staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("hours")
                .setDescription("Ore")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffunsuspend")
        .setDescription("Scoate suspend staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffprobation")
        .setDescription("Pune staff în probation")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("days")
                .setDescription("Zile")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffunprobation")
        .setDescription("Scoate staff din probation")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("blacklist")
        .setDescription("Blacklist normal")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffblacklist")
        .setDescription("Staff blacklist")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("viewblacklist")
        .setDescription("Vezi blacklist normal și staff"),

    new SlashCommandBuilder()
        .setName("setblacklistchannel")
        .setDescription("Setează canalul blacklist")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Canal")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setblacklistrole")
        .setDescription("Adaugă rol interzis pentru blacklist")
        .addStringOption(o =>
            o.setName("type")
                .setDescription("Tip blacklist")
                .setRequired(true)
                .addChoices(
                    { name: "Normal", value: "normal" },
                    { name: "Staff", value: "staff" }
                )
        )
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unsetblacklistrole")
        .setDescription("Scoate rol interzis din blacklist")
        .addStringOption(o =>
            o.setName("type")
                .setDescription("Tip blacklist")
                .setRequired(true)
                .addChoices(
                    { name: "Normal", value: "normal" },
                    { name: "Staff", value: "staff" }
                )
        )
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("viewblacklistroles")
        .setDescription("Vezi rolurile interzise"),
    
        // =================================================
    // UNBLACKLIST
    // =================================================

    new SlashCommandBuilder()
        .setName("unblacklist")
        .setDescription("Scoate blacklist-ul normal")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("staffunblacklist")
        .setDescription("Scoate Staff Blacklist")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),


    // =================================================
    // DEMOTE
    // =================================================

    new SlashCommandBuilder()
        .setName("staffdemote")
        .setDescription("Dă demote unui membru staff")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Motiv")
                .setRequired(true)
        ),


    // =================================================
    // TOP WARNS
    // =================================================

    new SlashCommandBuilder()
        .setName("topstaffwarns")
        .setDescription("Arată topul warn-urilor staff"),


    // =================================================
    // STAFF CONFIG
    // DOAR BOT ADMIN
    // =================================================

    new SlashCommandBuilder()
        .setName("setstafflog")
        .setDescription("Setează canalul de staff log")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Canal")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setstaffrole")
        .setDescription("Setează rolul principal Staff")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol Staff")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setmemberrole")
        .setDescription("Setează rolul Member")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setverifyrole")
        .setDescription("Setează rolul Verify")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol Verify")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setfreezerole")
        .setDescription("Setează rolul Freeze")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol Freeze")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setsuspendrole")
        .setDescription("Setează rolul Suspend")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol Suspend")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("setdemoterole")
        .setDescription("Setează rolul fallback pentru demote")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Rol")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("viewcommands")
        .setDescription("Vezi comenzile la care ai acces"),

    new SlashCommandBuilder()
        .setName("staffsecurity")
        .setDescription("Setează Security Level")
        .addUserOption(o =>
            o.setName("member")
                .setDescription("Membru staff")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("level")
                .setDescription("Nivel 1-7")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(7)
        ),

];

// =====================================================
// MAIN HANDLER
// =====================================================

async function handleInteraction(interaction) {

    if (!interaction.isChatInputCommand())
        return false;

    const commandName =
        interaction.commandName;

    if (commandName === "setstaffwarnlog")
        return handleSetStaffWarnLog(interaction);

    if (commandName === "viewcommands")
        return handleViewCommands(interaction);

    if (commandName === "setmodrol")
        return handleSetModRole(interaction);

    if (commandName === "viewmodrole")
        return handleViewModRole(interaction);

    if (commandName === "viewmoderators")
        return handleViewModerators(interaction);


    if (commandName === "warnstaff")
        return handleWarnStaff(interaction);

    if (commandName === "staffwarns")
        return handleStaffWarn(interaction);

    if (commandName === "staffinfo")
        return handleStaffInfo(interaction);

    if (commandName === "staffwarnhistory")
        return handleStaffWarnHistory(interaction);

    if (commandName === "removewarnstaff")
        return handleRemoveWarnStaff(interaction);

    if (commandName === "clearwarnstaff")
        return handleClearWarnStaff(interaction);

    if (commandName === "removewarnhistory")
        return handleRemoveWarnHistory(interaction);

    if (commandName === "clearwarnstaffhistory")
        return handleClearWarnStaffHistory(interaction);


    if (commandName === "stafffreeze")
        return handleStaffFreeze(interaction);

    if (commandName === "staffunfreeze")
        return handleStaffUnfreeze(interaction);

    if (commandName === "staffsuspend")
        return handleStaffSuspend(interaction);

    if (commandName === "staffunsuspend")
        return handleStaffUnsuspend(interaction);


    if (commandName === "staffprobation")
        return handleStaffProbation(interaction);

    if (commandName === "staffunprobation")
        return handleStaffUnprobation(interaction);


    if (commandName === "blacklist")
        return handleBlacklist(interaction);

    if (commandName === "staffblacklist")
        return handleStaffBlacklist(interaction);

    if (commandName === "viewblacklist")
        return handleViewBlacklist(interaction);


    if (commandName === "setblacklistchannel")
        return handleSetBlacklistChannel(interaction);

    if (commandName === "setblacklistrole")
        return handleSetBlacklistRole(interaction);

    if (commandName === "unsetblacklistrole")
        return handleUnsetBlacklistRole(interaction);

    if (commandName === "viewblacklistroles")
        return handleViewBlacklistRoles(interaction);



    // =================================================
    // UNBLACKLIST
    // =================================================

    if (commandName === "unblacklist")
        return handleUnblacklist(interaction);

    if (commandName === "staffunblacklist")
        return handleStaffUnblacklist(interaction);


    // =================================================
    // DEMOTE + TOP WARNS
    // =================================================

    if (commandName === "staffdemote")
        return handleStaffDemote(interaction);

    if (commandName === "topstaffwarns")
        return handleTopStaffWarns(interaction);


    // =================================================
    // STAFF CONFIG
    // =================================================

    if (commandName === "setstafflog")
        return handleSetStaffLog(interaction);

    if (commandName === "setstaffrole")
        return setStaffConfigRole(
            interaction,
            "setstaffrole",
            "staffRoleId",
            "Staff Role"
        );

    if (commandName === "setmemberrole")
        return setStaffConfigRole(
            interaction,
            "setmemberrole",
            "memberRoleId",
            "Member Role"
        );

    if (commandName === "setverifyrole")
        return setStaffConfigRole(
            interaction,
            "setverifyrole",
            "verifyRoleId",
            "Verify Role"
        );

    if (commandName === "setfreezerole")
        return setStaffConfigRole(
            interaction,
            "setfreezerole",
            "freezeRoleId",
            "Freeze Role"
        );

    if (commandName === "setsuspendrole")
        return setStaffConfigRole(
            interaction,
            "setsuspendrole",
            "suspendRoleId",
            "Suspend Role"
        );

    if (commandName === "setdemoterole")
        return setStaffConfigRole(
            interaction,
            "setdemoterole",
            "demoteRoleId",
            "Demote Role"
        );

    if (commandName === "staffsecurity")
        return handleStaffSecurity(interaction);

    return false;
}


// =====================================================
// REGISTER STAFF SYSTEM
// =====================================================

function register(client) {

    startStaffTimer(client);

    registerBlacklistProtection(client);

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    commands,

    handleInteraction,

    register,

    isBotAdmin,

    getModeratorLevel,

    canUse

};
