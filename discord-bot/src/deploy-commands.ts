import { REST, Routes } from 'discord.js';
import { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID } from './config.js';
import {
  trendingCommand,
  signalCommand,
  alertsCommand,
  statsCommand,
  aboutCommand,
} from './commands.js';

const commands = [
  trendingCommand.toJSON(),
  signalCommand.toJSON(),
  alertsCommand.toJSON(),
  statsCommand.toJSON(),
  aboutCommand.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

async function main() {
  console.log(`Registering ${commands.length} slash commands...`);

  await rest.put(
    Routes.applicationCommands(DISCORD_CLIENT_ID),
    { body: commands },
  );

  console.log('Done! Commands registered globally (may take up to 1 hour to propagate).');
}

main().catch(console.error);
