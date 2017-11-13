const moment = require('moment')

const jiraUtils = require('./../jiraUtils')

global.previousIssue = ''

module.exports = (slapp) => {
  // respond to Bitbucket Pull Request URLs
  const regex = new RegExp(`(${process.env.BITBUCKET_DIFF_URL_PREFIX})`, 'i')
  slapp.message(regex, [ 'mention', 'direct_message', 'ambient' ], (msg) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    var prPattern = /pull-requests/gi
    var prMatch = text.match(prPattern)

    if (prMatch !== null && prMatch.length > 0) {
      // process as a pull request - need to extract the url that was pasted
      var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/g // eslint-disable-line
      var urlMatch = text.match(urlPattern)
      for (var i = 0; i < urlMatch.length; i++) {
        jiraUtils.getPRStatusString(process.env.BITBUCKET_URL, process.env.JIRA_U, process.env.JIRA_P, urlMatch[i]).then((result) => {
          // what if user posted PX-123 and then a separate PR url? Need to make sure we only return the text for the pr (not the random issue number)
          // outputMessage(msg, match[0].toUpperCase(), bbStr)
          module.exports.outputPRMessage(msg, result.issueStr, result.prTitle, result.prURL, `Reviewers: ${result.approverStr}`)
        })
      }
    }
  })

  // Respond to a JIRA issue (e.g. PX-1234)
  slapp.message(/(clw-|cs-|jl-|mds-|px-|ra-|rel-|vm-|vnow-)(\d+)/i, [ 'mention', 'direct_message', 'ambient' ], (msg) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    var pattern = /(clw-|cs-|jl-|mds-|px-|ra-|rel-|vm-|vnow-)(\d+)/gi
    var match = text.match(pattern)

    // there may be multiple issues in the text
    for (var i = 0; i < match.length; i++) {
      const issueKey = match[i].toUpperCase()
      module.exports.outputJiraIssueMessage(msg, issueKey, '', '')
    }
  })

  // return a random Spark low priority bug from the backlog
  slapp.message('rand', [ 'mention', 'direct_message' ], (msg) => {
    const bugs = [ 'VNOW-6343', 'VNOW-6340', 'VNOW-6338', 'VNOW-6334' ]
    const issueKey = Math.floor(Math.random() * bugs.length)
    module.exports.outputJiraIssueMessage(msg, bugs[issueKey], "Here's a random Low priority bug from the Spark backlog")
  })
}
var outputJiraIssueMessage = function (msg, issueKey, introText, footerText) {
  if (global.previousIssue !== issueKey) {
    // don't want to be "chatty" - if a user keeps mentioning a single issue, only report back on it once
    global.previousIssue = issueKey
    // these env vars are configured during bot installation and passed in during initialization
    jiraUtils
      .getIssue(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, issueKey)
      .then((jiraIssue) => {
        var avatarUrl = null
        if (jiraIssue.fields.assignee != null) {
          avatarUrl = jiraIssue.fields.assignee.avatarUrls['48x48']
        }

        msg.say({
          text: introText,
          attachments: [
            {
              fallback: '',
              text: '',
              title: `${jiraIssue.fields.issuetype.name} ${issueKey}: ${jiraIssue.fields.summary}`,
              title_link: 'https://inmotionnow.atlassian.net/browse/' + issueKey,
              // thumb_url: avatarUrl,
              author_name: getAttributesText(jiraIssue),
              author_icon: avatarUrl,
              footer: footerText,
              // mrkdwn_in: ['fields'],
              // 'fields': [
              //   {
              //     'title': 'Status',
              //     'value': '`' + jiraIssue.fields.status.name + '`',
              //     'short': true
              //   },
              //   // {
              //   //   'title': 'Assignee',
              //   //   'value': jiraIssue.fields.assignee === null ? 'Unassigned' : jiraIssue.fields.assignee.displayName,
              //   //   'short': true
              //   // },
              //   {
              //     'title': 'Priority',
              //     'value': '`' + jiraIssue.fields.priority.name + '`',
              //     'short': true
              //   }
              // ],
              color: jiraUtils.getIssueColor(jiraIssue.fields.issuetype.name, jiraIssue.fields.priority.name)
            }
          ]
        })
      })
      .catch((err) => {
        console.log(err)
        msg.say({
          text: "Sorry, couldn't find " + issueKey + ' :cry:'
        })
      })
  }
}

var outputPRMessage = function (msg, issueKey, prTitle, prURL, approversStr) {
  if (global.previousIssue !== prTitle) {
    // don't want to be "chatty" - if a user keeps mentioning a single issue, only report back on it once
    global.previousIssue = prTitle
    if (!issueKey) {
      // it's a PR that had no associated Jira issue, so can't display the avatar, status, etc...
      msg.say({
        text: '',
        attachments: [
          {
            fallback: '',
            text: '',
            title: prTitle,
            title_link: prURL,
            footer: approversStr
          }
        ]
      })
    } else {
      // these env vars are configured during bot installation and passed in during initialization
      jiraUtils
        .getIssue(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, issueKey)
        .then((jiraIssue) => {
          var avatarUrl = null
          if (jiraIssue.fields.assignee != null) {
            avatarUrl = jiraIssue.fields.assignee.avatarUrls['48x48']
          }

          msg.say({
            text: `${jiraIssue.fields.issuetype.name} ${issueKey}: ${jiraIssue.fields.summary}`,
            attachments: [
              {
                fallback: '',
                text: '',
                title: prTitle,
                title_link: prURL,
                author_name: getAttributesText(jiraIssue),
                author_icon: avatarUrl,
                footer: approversStr,
                color: jiraUtils.getIssueColor(jiraIssue.fields.issuetype.name, jiraIssue.fields.priority.name)
              }
            ]
          })
        })
        .catch((err) => {
          console.log(err)
        })
    }
  }
}

function getAttributesText (jiraIssue) {
  var text = jiraIssue.fields.assignee === null ? 'Unassigned' : jiraIssue.fields.assignee.displayName
  text += ' | ' + jiraIssue.fields.status.name + ' | ' + jiraUtils.getPriorityLabel(jiraIssue.fields.priority.name, true)
  if (jiraIssue.fields.duedate !== undefined && jiraIssue.fields.duedate !== null) {
    var due = moment(jiraIssue.fields.duedate)
    text += ' | Due: ' + due.format('MMM DD')
  }
  return text
}

module.exports.outputJiraIssueMessage = outputJiraIssueMessage
module.exports.outputPRMessage = outputPRMessage
