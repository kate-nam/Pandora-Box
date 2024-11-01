import { ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';

// DISCORD Button functions
// ===============================================================================================
export async function confirmButtons(message, confirmId, rejectId, messageContent) {
    const confirmButton = new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success); // Green confirm button
  
      const rejectButton = new ButtonBuilder()
      .setCustomId(rejectId)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger); // Red reject button
  
    const row = new ActionRowBuilder().addComponents(confirmButton, rejectButton);
  
    await message.channel.send({
      content: messageContent,
      components: [row],
    });
  }
  
// Utility function to disable buttons
export async function disableButtons(interaction, buttonsData) {
    const disabledButtons = buttonsData.map(buttonData => {
      return new ButtonBuilder()
        .setCustomId(buttonData.customId)
        .setLabel(buttonData.label)
        .setStyle(buttonData.style)
        .setDisabled(true);
    });
  
    // Create an action row with the disabled buttons
    const disabledRow = new ActionRowBuilder().addComponents(...disabledButtons);
  
    // Edit the original message to disable the buttons
    await interaction.message.edit({
      components: [disabledRow],
    });
  }
  


// ===============================================================================================

// Prepare GPT input 'issue.messages' (not active use)
export function makeConversationGPTReadable(conversation) {
    let readableConversation = '';
  
    // Process the origin channel
    readableConversation += '--- Origin Channel Conversation ---\n';
    conversation.originChannel.forEach((message) => {
      if (message.role === 'user') {
        readableConversation += `User: ${message.content}\n`;
      } else if (message.role === 'assistant') {
        readableConversation += `Messenger (ChatGPT Assistant 1): ${message.content}\n`;
      }
    });
  
    // Process the target channel
    readableConversation += '\n--- Target Channel Conversation ---\n';
    conversation.targetChannel.forEach((message) => {
      if (message.role === 'user') {
        readableConversation += `Target User: ${message.content}\n`;
      } else if (message.role === 'assistant') {
        readableConversation += `Messenger (ChatGPT Assistant 2): ${message.content}\n`;
      }
    });
  
    return readableConversation;
  }