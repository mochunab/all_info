import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  type TextChannel,
} from 'discord.js';
import { DISCORD_BOT_TOKEN, HEAT_LABELS, ALERT_SCORE_THRESHOLD } from './config.js';
import { getTopSignals, getAlertChannels } from './db.js';
import { processMessage } from './crawler.js';
import {
  handleTrending,
  handleSignal,
  handleAlerts,
  handleStats,
  handleAbout,
} from './commands.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Ready ──

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot online: ${c.user.tag}`);
  console.log(`   Servers: ${c.guilds.cache.size}`);

  // 6시간마다 알림 체크
  setInterval(() => checkAndSendAlerts(), 6 * 60 * 60 * 1000);
  // 시작 1분 후 첫 체크
  setTimeout(() => checkAndSendAlerts(), 60_000);
});

// ── Slash Commands ──

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const handlers: Record<string, (i: typeof interaction) => Promise<void>> = {
    trending: handleTrending,
    signal: handleSignal,
    alerts: handleAlerts,
    stats: handleStats,
    about: handleAbout,
  };

  const handler = handlers[interaction.commandName];
  if (handler) {
    try {
      await handler(interaction);
    } catch (err) {
      console.error(`Command error [${interaction.commandName}]:`, err);
      const reply = interaction.deferred
        ? interaction.editReply('Something went wrong.')
        : interaction.reply({ content: 'Something went wrong.', ephemeral: true });
      await reply.catch(() => {});
    }
  }
});

// ── Message Crawling ──

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  try {
    await processMessage(message);
  } catch (err) {
    // 조용히 실패 (메시지마다 에러 로그 스팸 방지)
  }
});

// ── Auto Alerts ──

async function checkAndSendAlerts() {
  try {
    const alertChannels = await getAlertChannels();
    if (alertChannels.length === 0) return;

    const signals = await getTopSignals('6h', 'fomo', 3);
    const hotSignals = signals.filter((s) => s.weighted_score >= ALERT_SCORE_THRESHOLD);

    if (hotSignals.length === 0) return;

    const lines = hotSignals.map((s) => {
      const h = HEAT_LABELS[s.signal_label] || HEAT_LABELS.cool;
      return `${h.emoji} **${s.coin_symbol}** — ${Math.round(s.weighted_score)}/100 (${h.label}) | ${s.mention_count} mentions`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Hot Signal Alert')
      .setDescription(lines.join('\n'))
      .setColor(0xff6d00)
      .setFooter({ text: 'Use /trending for full list | /alerts off to disable' })
      .setTimestamp();

    for (const { channel_id } of alertChannels) {
      try {
        const channel = await client.channels.fetch(channel_id) as TextChannel;
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      } catch {
        // 채널 접근 불가 시 무시
      }
    }

    console.log(`📢 Alerts sent to ${alertChannels.length} channels (${hotSignals.length} hot signals)`);
  } catch (err) {
    console.error('Alert check error:', err);
  }
}

// ── Guild Join Logging ──

client.on(Events.GuildCreate, (guild) => {
  console.log(`➕ Joined: ${guild.name} (${guild.memberCount} members)`);
});

client.on(Events.GuildDelete, (guild) => {
  console.log(`➖ Left: ${guild.name}`);
});

// ── Start ──

client.login(DISCORD_BOT_TOKEN);
