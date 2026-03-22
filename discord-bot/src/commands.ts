import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { getTopSignals, getCoinSignal, getBacktestSummary, setAlertChannel, removeAlertChannel } from './db.js';
import { HEAT_LABELS } from './config.js';

function heatEmbed(label: string) {
  return HEAT_LABELS[label] || HEAT_LABELS.cool;
}

// ── /trending ──

export const trendingCommand = new SlashCommandBuilder()
  .setName('trending')
  .setDescription('Show top trending memecoins right now')
  .addStringOption((opt) =>
    opt.setName('window')
      .setDescription('Time window')
      .addChoices(
        { name: '1 hour', value: '1h' },
        { name: '6 hours', value: '6h' },
        { name: '24 hours', value: '24h' },
        { name: '7 days', value: '7d' },
      )
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('type')
      .setDescription('Signal type')
      .addChoices(
        { name: 'FOMO (bullish)', value: 'fomo' },
        { name: 'FUD (bearish)', value: 'fud' },
      )
      .setRequired(false)
  );

export async function handleTrending(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const window = interaction.options.getString('window') || '24h';
  const type = interaction.options.getString('type') || 'fomo';

  try {
    const signals = await getTopSignals(window, type, 8);

    if (signals.length === 0) {
      await interaction.editReply('No signals found for this window.');
      return;
    }

    const typeLabel = type === 'fomo' ? 'FOMO' : 'FUD';
    const lines = signals.map((s, i) => {
      const h = heatEmbed(s.signal_label);
      const score = Math.round(s.weighted_score);
      const warn = s.contrarian_warning ? ' ⚠️' : '';
      return `**${i + 1}.** ${h.emoji} **${s.coin_symbol}** — ${score}/100 (${h.label})${warn}\n   Mentions: ${s.mention_count} | Sentiment: ${s.avg_sentiment > 0 ? '+' : ''}${s.avg_sentiment.toFixed(2)} | Sources: ${s.source_count}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${typeLabel} Trending (${window})`)
      .setDescription(lines.join('\n\n'))
      .setColor(type === 'fomo' ? 0xff6d00 : 0x7b1fa2)
      .setFooter({ text: 'Powered by InsightHub Memecoin Predictor' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('trending error:', err);
    await interaction.editReply('Failed to fetch signals.');
  }
}

// ── /signal ──

export const signalCommand = new SlashCommandBuilder()
  .setName('signal')
  .setDescription('Get FOMO/FUD signal for a specific coin')
  .addStringOption((opt) =>
    opt.setName('coin')
      .setDescription('Coin symbol (e.g. DOGE, PEPE)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('window')
      .setDescription('Time window')
      .addChoices(
        { name: '1 hour', value: '1h' },
        { name: '6 hours', value: '6h' },
        { name: '24 hours', value: '24h' },
        { name: '7 days', value: '7d' },
      )
      .setRequired(false)
  );

export async function handleSignal(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const coin = interaction.options.getString('coin', true).toUpperCase();
  const window = interaction.options.getString('window') || '24h';

  try {
    const { fomo, fud } = await getCoinSignal(coin, window);

    if (!fomo && !fud) {
      await interaction.editReply(`No signal data for **${coin}**. It may not have enough mentions yet.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${coin} Signal (${window})`)
      .setTimestamp()
      .setFooter({ text: 'Powered by InsightHub Memecoin Predictor' });

    if (fomo) {
      const h = heatEmbed(fomo.signal_label);
      const events = fomo.detected_events?.length
        ? fomo.detected_events.join(', ')
        : 'none';
      embed.addFields({
        name: `${h.emoji} FOMO — ${Math.round(fomo.weighted_score)}/100 (${h.label})`,
        value: [
          `Mentions: **${fomo.mention_count}** | Velocity: **${fomo.mention_velocity?.toFixed(1)}**/h`,
          `Sentiment: **${fomo.avg_sentiment > 0 ? '+' : ''}${fomo.avg_sentiment.toFixed(2)}**`,
          `Sources: **${fomo.source_count}** | Events: ${events}`,
          fomo.contrarian_warning ? `⚠️ **${fomo.contrarian_warning.replace('_', ' ')}**` : '',
        ].filter(Boolean).join('\n'),
      });
      embed.setColor(h.color);
    }

    if (fud) {
      const h = heatEmbed(fud.signal_label);
      const events = fud.detected_events?.length
        ? fud.detected_events.join(', ')
        : 'none';
      embed.addFields({
        name: `🔻 FUD — ${Math.round(fud.weighted_score)}/100 (${h.label})`,
        value: [
          `Mentions: **${fud.mention_count}** | Velocity: **${fud.mention_velocity?.toFixed(1)}**/h`,
          `Sentiment: **${fud.avg_sentiment > 0 ? '+' : ''}${fud.avg_sentiment.toFixed(2)}**`,
          `Sources: **${fud.source_count}** | Events: ${events?.length ? events : 'none'}`,
          fud.contrarian_warning ? `⚠️ **${fud.contrarian_warning.replace('_', ' ')}**` : '',
        ].filter(Boolean).join('\n'),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('signal error:', err);
    await interaction.editReply('Failed to fetch signal.');
  }
}

// ── /alerts ──

export const alertsCommand = new SlashCommandBuilder()
  .setName('alerts')
  .setDescription('Set or remove automatic signal alerts in this channel')
  .addStringOption((opt) =>
    opt.setName('action')
      .setDescription('Enable or disable alerts')
      .addChoices(
        { name: 'Enable alerts here', value: 'on' },
        { name: 'Disable alerts', value: 'off' },
      )
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function handleAlerts(interaction: ChatInputCommandInteraction) {
  const action = interaction.options.getString('action', true);
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  try {
    if (action === 'on') {
      await setAlertChannel(guildId, channelId);
      await interaction.reply(`Signal alerts enabled in <#${channelId}>. You'll get notified when a coin hits Hot (score >= 60).`);
    } else {
      await removeAlertChannel(guildId);
      await interaction.reply('Signal alerts disabled.');
    }
  } catch (err) {
    console.error('alerts error:', err);
    await interaction.reply({ content: 'Failed to update alert settings.', ephemeral: true });
  }
}

// ── /stats ──

export const statsCommand = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show backtest hit rates — how accurate are our signals?');

export async function handleStats(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const summary = await getBacktestSummary();

    if (summary.length === 0) {
      await interaction.editReply('No backtest data available yet.');
      return;
    }

    const fomoLines = summary
      .filter((s) => s.signal_type === 'fomo')
      .sort((a, b) => b.hit_rate - a.hit_rate)
      .map((s) => {
        const h = heatEmbed(s.signal_label);
        return `${h.emoji} **${h.label}**: ${(s.hit_rate * 100).toFixed(1)}% hit rate (${s.hit}/${s.total}) | avg return: ${s.avg_return_pct > 0 ? '+' : ''}${s.avg_return_pct.toFixed(1)}%`;
      });

    const fudLines = summary
      .filter((s) => s.signal_type === 'fud')
      .sort((a, b) => b.hit_rate - a.hit_rate)
      .map((s) => {
        const h = heatEmbed(s.signal_label);
        return `${h.emoji} **${h.label}**: ${(s.hit_rate * 100).toFixed(1)}% hit rate (${s.hit}/${s.total}) | avg return: ${s.avg_return_pct > 0 ? '+' : ''}${s.avg_return_pct.toFixed(1)}%`;
      });

    const embed = new EmbedBuilder()
      .setTitle('Signal Accuracy (Backtest)')
      .setColor(0x00c853)
      .setTimestamp()
      .setFooter({ text: 'Based on historical signal vs. actual price movement' });

    if (fomoLines.length > 0) {
      embed.addFields({ name: 'FOMO Signals', value: fomoLines.join('\n') });
    }
    if (fudLines.length > 0) {
      embed.addFields({ name: 'FUD Signals', value: fudLines.join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('stats error:', err);
    await interaction.editReply('Failed to fetch backtest stats.');
  }
}

// ── /about ──

export const aboutCommand = new SlashCommandBuilder()
  .setName('about')
  .setDescription('About this bot and data collection transparency');

export async function handleAbout(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('InsightHub Memecoin Predictor')
    .setDescription([
      'Free memecoin signal bot powered by multi-source sentiment analysis.',
      '',
      '**Data Sources**: Reddit, Twitter/X, Telegram, CoinGecko + Discord (this server)',
      '**Signals**: FOMO/FUD scoring (0-100) with WHY explanations',
      '**Backtest**: Signals are verified against actual price movements',
      '',
      '**Data Collection Notice**',
      'This bot reads public channel messages in crypto-related channels to improve signal accuracy.',
      'We only analyze aggregate sentiment trends — no personal data is stored.',
      'Server admins can remove the bot at any time to stop data collection.',
      '',
      '**Commands**',
      '`/trending` — Top trending coins',
      '`/signal DOGE` — FOMO/FUD for a specific coin',
      '`/alerts on` — Auto-alert when a coin hits Hot',
      '`/stats` — Backtest accuracy report',
      '',
      '[Dashboard](https://aca-info.com/en/crypto) | Built by InsightHub',
    ].join('\n'))
    .setColor(0x2196f3);

  await interaction.reply({ embeds: [embed] });
}
