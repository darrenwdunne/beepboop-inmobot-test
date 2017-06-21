const jira = require('./jira')

global.previousIssue = ''

var config = function (slapp) {
  // Respond to a JIRA issue (e.g. PX-1234)
  slapp.message(/(cs-|ra16-|mds-|px-|rel-|vm-|vnow-)(\d+)/i, ['mention', 'direct_message', 'ambient'], (msg) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    var prPattern = /pull-requests/ig
    var pattern = /(cs-|ra16-|mds-|px-|rel-|vm-|vnow-)(\d+)/ig
    var prMatch = text.match(prPattern)
    var match = text.match(pattern)

    if (prMatch !== null && prMatch.length > 0) {
      // process as a pull request - need to extract the url that was pasted
      var urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/ // eslint-disable-line
      var urlMatch = text.match(urlPattern)
      jira.getPRStatusString(process.env.BITBUCKET_URL, process.env.JIRA_U, process.env.JIRA_P, urlMatch[0])
        .then(bbStr => {
          // what if user posted PX-123 and then a separate PR url? Need to make sure we only return the text for the pr (not the random issue number)
          if (match.length > 1) {
            match = urlMatch[0].match(pattern)
          }
          // outputMessage(msg, match[0].toUpperCase(), bbStr)
          module.exports.outputMessage(msg, match[0], '', 'Reviewers: ' + bbStr)
        })
    } else {
      // treat is as a regular text issue
      // there may be multiple issues in the text
      for (var i = 0; i < match.length; i++) {
        const issueKey = match[i].toUpperCase()
        module.exports.outputMessage(msg, issueKey, '', '')
      }
    }
  })

  // return a random Spark low priority bug from the backlog
  slapp.message('rand', ['mention', 'direct_message'], (msg) => {
    const bugs = ['VNOW-6343', 'VNOW-6340', 'VNOW-6338', 'VNOW-6334', 'VNOW-6330', 'VNOW-6329', 'VNOW-6328', 'VNOW-6327', 'VNOW-6317', 'VNOW-6215', 'VNOW-6188', 'VNOW-6185', 'VNOW-6184', 'VNOW-6176', 'VNOW-6175', 'VNOW-6172', 'VNOW-6151', 'VNOW-6150', 'VNOW-6146', 'VNOW-6144', 'VNOW-6137', 'VNOW-6133', 'VNOW-6128', 'VNOW-6124', 'VNOW-6122', 'VNOW-6115', 'VNOW-6113', 'VNOW-6107', 'VNOW-6096', 'VNOW-6094', 'VNOW-6093', 'VNOW-6092', 'VNOW-6087', 'VNOW-6082', 'VNOW-6081', 'VNOW-6078', 'VNOW-6076', 'VNOW-6074', 'VNOW-6072', 'VNOW-6042', 'VNOW-6024', 'VNOW-6020', 'VNOW-5992', 'VNOW-5974', 'VNOW-5971', 'VNOW-5961', 'VNOW-5932', 'VNOW-5928', 'VNOW-5914', 'VNOW-5900', 'VNOW-5891', 'VNOW-5890', 'VNOW-5879', 'VNOW-5868', 'VNOW-5867', 'VNOW-5843', 'VNOW-5825', 'VNOW-5804', 'VNOW-5756', 'VNOW-5739', 'VNOW-5733', 'VNOW-5696', 'VNOW-5691', 'VNOW-5643', 'VNOW-5561', 'VNOW-5527', 'VNOW-5492', 'VNOW-5483', 'VNOW-5476', 'VNOW-5452', 'VNOW-5423', 'VNOW-5422', 'VNOW-5399', 'VNOW-5366', 'VNOW-5365', 'VNOW-5340', 'VNOW-5319', 'VNOW-5303', 'VNOW-5293', 'VNOW-5290', 'VNOW-5239', 'VNOW-5224', 'VNOW-5200', 'VNOW-5184', 'VNOW-5160', 'VNOW-5108', 'VNOW-5104', 'VNOW-5072', 'VNOW-5016', 'VNOW-4993', 'VNOW-4989', 'VNOW-4976', 'VNOW-4905', 'VNOW-4903', 'VNOW-4901', 'VNOW-4900', 'VNOW-4874', 'VNOW-4873', 'VNOW-4870', 'VNOW-4864', 'VNOW-4840', 'VNOW-4835', 'VNOW-4834', 'VNOW-4830', 'VNOW-4817', 'VNOW-4809', 'VNOW-4808', 'VNOW-4807', 'VNOW-4806', 'VNOW-4758', 'VNOW-4742', 'VNOW-4725', 'VNOW-4707', 'VNOW-4577', 'VNOW-4547', 'VNOW-4250', 'VNOW-3870', 'VNOW-3759', 'VNOW-3523', 'VNOW-2903']
    const issueKey = Math.floor(Math.random() * bugs.length)
    module.exports.outputMessage(msg, bugs[issueKey], "Here's a random Low priority bug from the Spark backlog")
  })
}
var outputMessage = function (msg, issueKey, introText, footerText) {
  if (global.previousIssue !== issueKey) {
    // don't want to be "chatty" - if a user keeps mentioning a single issue, only report back on it once
    global.previousIssue = issueKey
    // these env vars are configured during bot installation and passed in during initialization
    jira.getIssue(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, issueKey).then(jiraIssue => {
      var avatarUrl = null
      if (jiraIssue.fields.assignee != null) {
        avatarUrl = jiraIssue.fields.assignee.avatarUrls['48x48']
      }

      msg.say({
        text: introText,
        attachments: [{
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
          color: getColor(jiraIssue.fields.issuetype.name, jiraIssue.fields.priority.name)
        }]
      })
    }).catch((err) => {
      console.log(err)
      msg.say({
        text: "Sorry, couldn't find " + issueKey + ' :cry:'
      })
    })
  }
}

function getAttributesText (jiraIssue) {
  var text = jiraIssue.fields.assignee === null ? 'Unassigned' : jiraIssue.fields.assignee.displayName
  text += ' | ' + jiraIssue.fields.status.name + ' | ' + jiraIssue.fields.priority.name
  switch (jiraIssue.fields.priority.name) {
    case 'Critical':
      text += ' :jira-critical:'
      break
    case 'High':
      text += ' :jira-high:'
      break
    case 'Medium':
      text += ' :jira-medium:'
      break
    case 'Low':
      text += ' :jira-low:'
      break
    case 'Open':
      text += ' :jira-open:'
      break
  }
  return text
}

function getColor (issuetype, priority) {
  var color = 'good'
  switch (issuetype) {
    case 'Bug':
    case 'Bug-task':
      switch (priority) {
        case 'Open':
          color = 'good'
          break
        case 'High':
          color = 'danger'
          break
        case 'Medium':
          color = 'warning'
          break
      }
      break
    case 'Story':
      color = '#63BA3C'
      break
    case 'Task':
    case 'Sub-task':
      color = '#4BADE8'
      break
    case 'Epic':
      color = '#904EE2'
      break
  }
  return color
}

exports.config = config
exports.outputMessage = outputMessage
