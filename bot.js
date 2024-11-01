import { config } from 'dotenv';
import { Client, GatewayIntentBits, ButtonStyle, Events } from 'discord.js';
import  db  from './firebase.js';
import { ref, set, get, update, remove } from 'firebase/database';
import { GPT } from './openai.js';

import { confirmButtons, disableButtons } from './utils.js';
import { retrieveIssues, formatIssueToString, formatIssueToStringCritique } from './issueProcess.js';
import { executePythonCode, parsePythonCode } from './executePython.js';

config();


const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});


client.once('ready', () => {
  console.log('Bot is online!');
});


client.on('messageCreate', async (message) => {
 
  if (message.author.bot) return;

  const thisChannel = message.channel.name;
  const issuesRef = ref(db, 'issues');
  let openIssue   = null;
  let channelType = null; // <'origin'|'target'> 


  if (message.channel.name === 'the-box') {
    console.log('beta')
    
    const issues = await retrieveIssues( issuesRef )

    const processIssues = async (issues) => {
      try {
        // Use map to create an array of promises
        const promises = issues.map(async (issue) => {
          const issueString = await formatIssueToStringCritique(issue);
          return issueString; // Collect result
        });
    
        // Wait for all promises to resolve
        const issueStrings = await Promise.all(promises);
    
        // Join the datapoints per issue into a string
        return issueStrings.join('\n');

      } catch (error) {
        console.error("Error processing issues:", error);
      }
    };
    
    const issueCritiques = await processIssues(issues);
    const pythonCode = await GPT.promptCritiquePlot(issueCritiques);

    await executePythonCode( parsePythonCode( pythonCode ) );

    await message.channel.send({ 
      content: 'GPTs creative analysis',
      files: ['temp_gpt.png']
    });

    return;
  }



  if (message.channel.name === 'atmosphere') {
    console.log('Emotion Map')
    
    const issues = await retrieveIssues( issuesRef )

    const processIssues = async (issues) => {
      try {
        // Use map to create an array of promises
        const promises = issues.map(async (issue) => {
          const issueString = await formatIssueToString(issue);
          const emotionResult = await GPT.promptIssueEmotionEvaluation(issueString);
          return emotionResult; // Collect result
        });
    
        // Wait for all promises to resolve
        const emotionResults = await Promise.all(promises);
    
        // Join the datapoints per issue into a string
        return emotionResults.join('\n');

      } catch (error) {
        console.error("Error processing issues:", error);
      }
    };
    
    const datapoints = await processIssues(issues);
    console.log(datapoints);
    const pythonCode = await GPT.promptEmotionMapCode(datapoints);

    await executePythonCode( parsePythonCode( pythonCode ) );

    await message.channel.send({ 
      content: 'Hey! This is the atmosphere these days.',
      files: ['temp.png']
    });

    return;
  }


    
  
  

  // ====================================================================================================================================
  // [!] CHECK FOR WHETHER THERE IS AN OPEN ISSUE AT FIREBASE
  // ====================================================================================================================================
  try {
      const snapshot = await get(issuesRef);
      
      snapshot.forEach((childSnapshot) => {
          const issue = childSnapshot.val();

          if (issue.status === 'open') {

            if (issue.originChannel === thisChannel) {
                openIssue = { id: childSnapshot.key, ...issue };
                channelType = 'origin';

            } else if (issue.targetChannel === thisChannel && issue.issueArrived && !issue.issueReplied ) {
                openIssue = { id: childSnapshot.key, ...issue };
                channelType = 'target';
            }
          }
      });
  } catch (error) {
      console.error("Error reading from Firebase:", error);
  }

  // ====================================================================================================================================
  // [0] THERE IS NO OPEN ISSUE. CREATE A NEW ISSUE 
  // ====================================================================================================================================
  if (!openIssue){
    console.log(0)
    channelType = 'origin';  // only 'originChannel' can create an issue

    const issueId = `issue-${Date.now()}`;
    const newIssue = {
      id: issueId,                             // Unique identifier
      status: 'open',                          // Set initial status to 'open'
      openTime: new Date().toISOString(),      // Store the creation time
      originChannel: message.channel.name,     // Name of the channel where the issue started (user A)
      originChannelId: message.channelId,      
      targetChannel: '',                       // Target channel (user B)
      targetChannelId: '',                     
      forwardMessage: '',                      // AI's paraphrased message from the sender (user A)
      issueArrived: false,                     
      replyMessage: '',                        // AI's paraphrased reply message from the target (user B)
      issueReplied: false,                     // Marks if the issue has been replied to
      messages: {                              // Message history
            originChannel: [{ role: 'user', content: '' }],
            targetChannel: [{ role: 'user', content: '' }]
        },
        issueCritique: ''  // may not be used 
    };

    try {
        await set(ref(db, `issues/${issueId}`), newIssue);
        openIssue = (await get( ref(db, `issues/${issueId}`) )).val()   // init openIssue object
    } catch (error) {
        console.error("Error reading/writing Firebase:", error);
        return;
    }
  }

  const openIssueRef = ref(db, `issues/${openIssue.id}`);               // init openIssueRef




  // ====================================================================================================================================
  // [1] THERE IS AN OPEN ISSUE AND `thisChannel` IS THE `originChannel` 
  // ====================================================================================================================================
  if (openIssue && channelType === 'origin') {
    console.log(1);

    if (message.content === '!close' || message.content === '!remove' || message.content === '!delete') {
      await remove(openIssueRef);
      return;
    }

    const availableChannels = message.guild.channels.cache.map( channel => ({ id: channel.id, name: channel.name }) )

    const responseObject = await GPT.promptOriginChannel(
      message.content, 
      availableChannels.slice(2).map(item => item.name),  // available target channel names (slice: filter out not-actual channels)
      openIssue.messages.originChannel  // message history (origin channel)
    );

    openIssue.messages.originChannel.push( { role: 'user', content: message.content } )
    openIssue.messages.originChannel.push( { role: 'assistant', content: responseObject.message.content } )
    await update(openIssueRef, openIssue)

    console.log(responseObject)

    // Get confirmation from the issue sender if GPT `need_clarification` flags are both `false`
    if ( !responseObject.message.needs_clarification && !responseObject.target.needs_clarification ) {
      
      openIssue.targetChannel = responseObject.target.name;
      openIssue.targetChannelId = availableChannels.find(ch => ch.name === responseObject.target.name).id;
      openIssue.forwardMessage = responseObject.message.content;
      await update(openIssueRef, openIssue);

      await message.channel.send(`Would you like to send below message to ${responseObject.target.name}? \n\n ${responseObject.message.content}`);
      confirmButtons(message, `sendRequestConfirm_${openIssue.id}`, `sendRequestReject`, '')

    } 
    // GPT asks more information for clarification
    else {
      await message.channel.send(responseObject.message.content)
    }

  





  // ====================================================================================================================================
  // [2] THERE IS AN OPEN ISSUE AND `thisChannel` IS THE `targetChannel` 
  // ====================================================================================================================================
  } else if (openIssue && channelType === 'target') {
    console.log(2);

    const responseObject = await GPT.promptTargetChannel(
      message.content, 
      openIssue.forwardMessage,   // GPT (target channel) cannot access to any information from originChannel. 'forwardMessage' is given to GPT explicitly.
      openIssue.messages.targetChannel  // message history (target channel)
    );

    openIssue.messages.targetChannel.push( { role: 'user', content: message.content } )
    openIssue.messages.targetChannel.push( { role: 'assistant', content: responseObject.message.content } )
    await update(openIssueRef, openIssue)

    console.log(responseObject)

    // Get confirmation from the issue sender if GPT `need_clarification` flag is `false`
    if ( !responseObject.message.needs_clarification ) {
      
      openIssue.replyMessage = responseObject.message.content;
      await update(openIssueRef, openIssue);

      await message.channel.send(`Would you like to send below reply back? \n\n ${responseObject.message.content}`);
      confirmButtons(message, `replyRequestConfirm_${openIssue.id}`, 'replyRequestReject', '')

    } 
    // GPT asks more information for clarification
    else {
      await message.channel.send(responseObject.message.content)
    }
  } 
  
  
});










// ====================================================================================================================================
// [!] BUTTON INTERACTION FOR CONFIRMATION 
// ====================================================================================================================================

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return; // Check if the interaction is a button click

  // Buttton Interaction from the originChannel
  // -------------------------------------------------------------------------------------------------------------------
  if ( interaction.customId.startsWith('sendRequestConfirm') ) {
    await disableButtons(interaction, [
      { customId: 'sendRequestConfirm', label: 'Confirm', style: ButtonStyle.Success },
      { customId: 'sendRequestReject', label: 'Reject', style: ButtonStyle.Danger }
    ]);
    const issueId = interaction.customId.split('_')[1];

    const openIssueRef = ref(db, `issues/${issueId}`);
    const issueSnapshot = await get(openIssueRef);
    let openIssue = issueSnapshot.exists() ? issueSnapshot.val() : null;

    if ( openIssue ) {
      await client.channels.cache.get( openIssue.targetChannelId ).send( openIssue.forwardMessage );
      openIssue.issueArrived = true;
      await update(openIssueRef, openIssue);

    } else {
      console.log('Error in getting firebase in button interaction')
    }

    await interaction.reply({ content: '[info] Message has been forwarded!', ephemeral: false });
  } 

  if (interaction.customId.startsWith('sendRequestReject')) {
    await disableButtons(interaction, [
      { customId: 'sendRequestConfirm', label: 'Confirm', style: ButtonStyle.Success },
      { customId: 'sendRequestReject', label: 'Reject', style: ButtonStyle.Danger }
    ]);

    await interaction.reply({ content: '[info] Please type `!close`, if you want to close the issue.', ephemeral: true });
  }



  // Buttton Interaction from the targetChannel
  // -------------------------------------------------------------------------------------------------------------------
  if ( interaction.customId.startsWith('replyRequestConfirm') ) {
    await disableButtons(interaction, [
      { customId: 'sendRequestConfirm', label: 'Confirm', style: ButtonStyle.Success },
      { customId: 'sendRequestReject', label: 'Reject', style: ButtonStyle.Danger }
    ]);
    const issueId = interaction.customId.split('_')[1];

    const openIssueRef = ref(db, `issues/${issueId}`);
    const issueSnapshot = await get(openIssueRef);
    let openIssue = issueSnapshot.exists() ? issueSnapshot.val() : null;

    if ( openIssue ) {
      await client.channels.cache.get( openIssue.originChannelId ).send( openIssue.replyMessage );
      openIssue.issueReplied = true;
      await update(openIssueRef, openIssue);

      await interaction.reply({ content: '[info] Message has been forwarded!', ephemeral: false });

      if ( openIssue.issueArrived && openIssue.issueReplied ) {
        openIssue.status = 'closed';
        openIssue.issueCritique = await GPT.promptCritique(openIssue.messages); // may not be used (beta)
        await update(openIssueRef, openIssue);
        // await client.channels.cache.get(openIssue.originChannelId).send('[info] GPT critique has been generated and the issue has been closed.');
        // await client.channels.cache.get(openIssue.targetChannelId).send('[info] GPT critique has been generated and the issue has been closed.');
      }

    } else {
      console.log('Error in getting firebase in button interaction')
    }
  } 

  if (interaction.customId.startsWith('replyRequestReject')) {
    await disableButtons(interaction, [
      { customId: 'replyRequestConfirm', label: 'Confirm', style: ButtonStyle.Success },
      { customId: 'replyRequestReject', label: 'Reject', style: ButtonStyle.Danger }
    ]);
    await interaction.reply({ content: 'Reject', ephemeral: true });
  }

  
});


client.login(process.env.DISCORD_TOKEN);
