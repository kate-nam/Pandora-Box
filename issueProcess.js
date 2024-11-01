import { get } from 'firebase/database';

export async function formatIssueToString( issue ) {
    let resultString = `      originChannel: ${issue.originChannel}\n`;
    resultString += `      targetChannel: ${issue.targetChannel}\n`;
    resultString += `      All Messages:\n`;
      resultString += `        Origin Channel:\n`;
      issue.messages.originChannel.forEach((message, msgIndex) => {
        if (message.role === 'user' && message.content !== '') {
        resultString += `          ${msgIndex + 1}. [${issue.originChannel}] ${message.content}\n`;
        }
      });
      resultString += `        Target Channel:\n`;
      issue.messages.targetChannel.forEach((message, msgIndex) => {
        if (message.role === 'user' && message.content !== '') {
        resultString += `          ${msgIndex + 1}. [${issue.targetChannel}] ${message.content}\n`;
        }
      });
    return resultString
  }


export async function formatIssueToStringCritique( issue ) {
  let resultString = `      issueStarter: ${issue.originChannel}\n`;
  resultString += `      issueTarget: ${issue.targetChannel}\n`;
  resultString += `      issueCritique: ${issue.issueCritique}\n`;
  return resultString
}


export async function retrieveIssues ( issuesRef ) {
  let issues = [];

    try {

      const snapshot = await get(issuesRef);

      // Loop through all issues and find the ones with status 'closed'
      snapshot.forEach((childSnapshot) => {
          const issue = childSnapshot.val();
          if (issue.status === 'closed') { issues.push( issue ); }
      });

      return issues

  } catch (error) {
      console.error("Error retrieving issues from Firebase:", error);
  }
}