import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  escapeMarkdown,
  type ChatInputCommandInteraction
} from 'discord.js';
import { ask, deleteDocument, listDocuments, uploadDocument } from './rag-client.js';

const SUPPORTED_EXTENSIONS = ['.pdf', '.md', '.markdown', '.txt', '.docx'];

export const dndCommands = [
  new SlashCommandBuilder().setName('ask').setDescription('Ask a D&D question, answered from the uploaded rulebooks and notes.')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(1000)),
  new SlashCommandBuilder().setName('dnd-upload').setDescription('Add a PDF, Markdown, text or Word file to the D&D knowledge base.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addAttachmentOption((o) => o.setName('file').setDescription('The file to add').setRequired(true)),
  new SlashCommandBuilder().setName('dnd-sources').setDescription('List the documents in the D&D knowledge base.'),
  new SlashCommandBuilder().setName('dnd-remove').setDescription('Remove a document from the D&D knowledge base.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('id').setDescription('Document ID from /dnd-sources').setRequired(true))
];

const dndCommandNames = new Set(dndCommands.map((command) => command.name));

export function isDndCommand(name: string): boolean {
  return dndCommandNames.has(name);
}

export async function handleDndCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'ask': return answer(interaction);
    case 'dnd-upload': return upload(interaction);
    case 'dnd-sources': return sources(interaction);
    case 'dnd-remove': return remove(interaction);
  }
}

async function answer(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString('question', true);
  await interaction.deferReply();
  try {
    const result = await ask(question);
    const cited = result.sources
      .map((s) => `\`[${s.n}]\` ${escapeMarkdown(s.filename)}${s.page ? `, p. ${s.page}` : ''}`)
      .join('\n');
    const embed = new EmbedBuilder()
      .setColor(0xb22222)
      .setTitle(truncate(question, 256))
      .setDescription(truncate(result.answer, 4000))
      .setFooter({ text: 'Answers come from the uploaded sources and a local AI model; double-check important rulings.' });
    if (cited) embed.addFields({ name: 'Sources', value: truncate(cited, 1024) });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply(`Couldn't answer that: ${(error as Error).message}`);
  }
}

async function upload(interaction: ChatInputCommandInteraction): Promise<void> {
  const file = interaction.options.getAttachment('file', true);
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    await interaction.reply({ content: `Supported file types: ${SUPPORTED_EXTENSIONS.join(', ')}`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const download = await fetch(file.url);
    if (!download.ok) throw new Error(`Discord returned ${download.status} for the attachment`);
    const document = await uploadDocument(file.name, await download.arrayBuffer(), file.contentType ?? 'application/octet-stream');
    await interaction.editReply(
      `Added **${escapeMarkdown(document.filename)}** (id \`${document.id}\`). ` +
      'It is being indexed now; check progress with `/dnd-sources`.'
    );
  } catch (error) {
    await interaction.editReply(`Upload failed: ${(error as Error).message}`);
  }
}

async function sources(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const documents = await listDocuments();
    if (!documents.length) {
      await interaction.editReply('The knowledge base is empty. Add files with `/dnd-upload`.');
      return;
    }
    const icons = { ready: '✅', processing: '⏳', failed: '❌' } as const;
    const lines = documents.map((d) => {
      const detail = d.status === 'failed' ? d.error ?? 'failed' : d.status === 'ready' ? `${d.chunks} chunks` : 'indexing';
      return `${icons[d.status]} \`${d.id}\` ${escapeMarkdown(d.filename)} · ${detail}`;
    });
    await interaction.editReply(truncate(lines.join('\n'), 2000));
  } catch (error) {
    await interaction.editReply(`Couldn't list sources: ${(error as Error).message}`);
  }
}

async function remove(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await deleteDocument(interaction.options.getString('id', true));
    await interaction.editReply('Document removed.');
  } catch (error) {
    await interaction.editReply(`Couldn't remove it: ${(error as Error).message}`);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
