const moment = require('moment')

const jiraUtils = require('./../jiraUtils')

global.previousIssue = ''

module.exports = (slapp) => {
  // Respond to a JIRA issue (e.g. PX-1234)
  slapp.message(/(clw-|cs-|jl-|mds-|px-|ra16-|rel-|vm-|vnow-)(\d+)/i, [ 'mention', 'direct_message', 'ambient' ], (msg) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    var prPattern = /pull-requests/gi
    var pattern = /(clw-|cs-|jl-|mds-|px-|ra16-|rel-|vm-|vnow-)(\d+)/gi
    var prMatch = text.match(prPattern)
    var match = text.match(pattern)

    if (prMatch !== null && prMatch.length > 0) {
      // process as a pull request - need to extract the url that was pasted
      var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/ // eslint-disable-line
      var urlMatch = text.match(urlPattern)
      jiraUtils.getPRStatusString(process.env.BITBUCKET_URL, process.env.JIRA_U, process.env.JIRA_P, urlMatch[0]).then((bbStr) => {
        // what if user posted PX-123 and then a separate PR url? Need to make sure we only return the text for the pr (not the random issue number)
        if (match.length > 1) {
          match = urlMatch[0].match(pattern)
        }
        // outputMessage(msg, match[0].toUpperCase(), bbStr)
        module.exports.outputJiraIssueMessage(msg, match[0], '', 'Reviewers: ' + bbStr)
      })
    } else {
      // treat is as a regular text issue
      // there may be multiple issues in the text
      for (var i = 0; i < match.length; i++) {
        const issueKey = match[i].toUpperCase()
        module.exports.outputJiraIssueMessage(msg, issueKey, '', '')
      }
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
              title: jiraIssue.fields.issuetype.name + ' ' + issueKey + ': ' + jiraIssue.fields.summary,
              // thumb_url: avatarUrl,
              author_name: getAttributesText(jiraIssue),
              author_icon: avatarUrl,
              footer: footerText,
              title_link: 'https://inmotionnow.atlassian.net/browse/' + issueKey,
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
