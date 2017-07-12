const request = require('request')
const Fuse = require('fuse.js')

const CUSTOM_FIELD_ACCOUNT = 'customfield_11501'
var accountsCache = null

const CUSTOM_FIELD_SEGMENT = 'customfield_11600'
var segmentsCache = null

const CUSTOM_FIELD_DEAL_VALUE = 'customfield_10006'

const CUSTOM_FIELD_PRODUCT = 'customfield_11700'

var getIssue = function (jiraurl, jirau, jirap, issue) {
  return new Promise((resolve, reject) => {
    if (issue === undefined) {
      reject(new Error('ERROR: need to provide issue'))
    } else {
      const URL = `${jiraurl}/rest/api/2/search?jql=key=${issue}&startAt=0&maxResults=15&fields=summary,issuetype,assignee,status,priority,key,duedate,changelog&expand=changelog`
      console.log('fetching issue ' + issue)
      request(
        {
          url: URL,
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${jirau}:${jirap}`).toString('base64')
          }
        },
        function (error, response, results) {
          if (error) {
            console.error('Error: ' + error)
          } else {
            var jiraData = JSON.parse(results)
            if (jiraData.issues === undefined) {
              reject(new Error('Error: Issue ' + issue + ' not found'))
            } else {
              // var changelog = jiraData.issues[0].changelog
              resolve(jiraData.issues[0])
            }
          }
        }
      )
    }
  })
}

// Developers usually paste the diff url into Slack:
// https://bitbucket.org/REPNAME/web-vnow/pull-requests/290/username-vnow-6234-dropbox-develop/diff
// need to parse out:
//  - repo slug (e.g. web-vnow)
//  - the PR number (in this case, 290) so we can surf through the activity log to see who already approved
var getPRStatusString = function (bbUrl, jirau, jirap, bitBucketDiffURL) {
  return new Promise((resolve, reject) => {
    if (bitBucketDiffURL === undefined) {
      reject(new Error('Need to provide a bitbucket diff url'))
    } else {
      if (process.env.BITBUCKET_DIFF_URL_PREFIX === undefined) {
        reject(new Error('BITBUCKET_DIFF_URL_PREFIX env variable not set'))
      } else {
        if (bitBucketDiffURL.indexOf(process.env.BITBUCKET_DIFF_URL_PREFIX) !== 0) {
          reject(new Error('Error: given URL did not start with BITBUCKET_DIFF_URL_PREFIX'))
        }
        var projectURL = bitBucketDiffURL
        var projectSlug = projectURL.replace(process.env.BITBUCKET_DIFF_URL_PREFIX, '')
        projectSlug = projectSlug.substr(0, projectSlug.indexOf('/'))
        // get the PR (it's the first number between slashes)
        projectURL.replace(projectSlug + '/', '')

        var pattern = /(\d+)/gi
        var match = projectURL.match(pattern)

        if (match === undefined) {
          reject(new Error('Cannot find the pr number in [' + projectURL + ']'))
        }

        // this URL shows the activity (comments, history of reviewers, etc...)
        // const URL = process.env.BITBUCKET_URL + projectSlug + '/pullrequests/' + match[0] + '/activity'
        const URL = process.env.BITBUCKET_URL + projectSlug + '/pullrequests/' + match[0]
        // console.log('fetching pull requests URL: ' + URL)
        request(
          {
            url: URL,
            headers: {
              Authorization: 'Basic ' + Buffer.from(`${jirau}:${jirap}`).toString('base64')
            }
          },
          function (error, response, results) {
            if (error) {
              console.error('Error: ' + error)
            } else {
              var jiraData = JSON.parse(results)
              var retStr = ''
              for (let participant of jiraData.participants) {
                retStr += participant.approved ? ':white_check_mark:' : ':white_medium_square:'
                // lastname
                retStr += ' ' + participant.user.display_name.split(' ')[1] + '   '
              }
              resolve(retStr)
            }
          }
        )
      }
    }
  })
}

var getFieldAllowedValues = function (jiraurl, jirau, jirap, field) {
  return new Promise((resolve, reject) => {
    if (field === undefined) {
      reject(new Error('ERROR: need to provide field'))
    } else {
      const URL = `${jiraurl}/rest/api/2/issue/createmeta?projectKeys=CLW&issuetypeNames=Request&expand=projects.issuetypes.fields`
      // console.log(`Fetching allowedValues for field ${field}`)
      request(
        {
          url: URL,
          headers: { Authorization: 'Basic ' + Buffer.from(`${jirau}:${jirap}`).toString('base64') }
        },
        function (error, response, results) {
          if (error) {
            console.error('Error: ' + error)
          } else {
            var jiraData = JSON.parse(results)
            if (!jiraData.projects[0].issuetypes[0].fields[field].allowedValues) {
              reject(new Error(`Error: jiraData.projects[0].issuetypes[0].fields[${field}].allowedValues not found`))
            } else {
              var allowedValues = jiraData.projects[0].issuetypes[0].fields[field].allowedValues
              resolve(allowedValues)
            }
          }
        }
      )
    }
  })
}

// refresh the global accountsCache (we want this to be available for menu selection)
var refreshAccountsCache = function () {
  getFieldAllowedValues(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, CUSTOM_FIELD_ACCOUNT)
    .then((allowedValues) => {
      accountsCache = allowedValues
      console.log(`Refreshed accountsCache = ${accountsCache.length} accounts`)
    })
    .catch((err) => {
      console.log('Error refreshing accountsCache: ' + err)
    })
}

// refresh the global segmentsCache (we want this to be available for menu selection)
var refreshSegmentsCache = function () {
  getFieldAllowedValues(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, CUSTOM_FIELD_SEGMENT)
    .then((allowedValues) => {
      segmentsCache = allowedValues
      console.log(`Refreshed segmentsCache = ${segmentsCache.length} segments`)
    })
    .catch((err) => {
      console.log('Error refreshing segmentsCache: ' + err)
    })
}

var getSegmentsCache = function () {
  return segmentsCache
}

// do a fuzzy search on Accounts
var searchAccounts = function (searchString) {
  var options = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [ 'value' ]
  }
  var fuse = new Fuse(accountsCache, options)
  var result = fuse.search(searchString)
  return result
}

var buildAccountsOptionsArray = function (filteredAccountsArray) {
  var arr = []
  for (let i = 0; i < filteredAccountsArray.length; i++) {
    var obj = { text: filteredAccountsArray[i].value, value: filteredAccountsArray[i].value }
    arr.push(obj)
  }
  return arr
}

function getPriorityLabel (priorityName, includeText) {
  var text = includeText ? priorityName : ''
  switch (priorityName) {
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

function getIssueColor (issuetype, priority) {
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

exports.getIssue = getIssue
exports.getPRStatusString = getPRStatusString
exports.getPriorityLabel = getPriorityLabel
exports.getIssueColor = getIssueColor
exports.getFieldAllowedValues = getFieldAllowedValues
exports.searchAccounts = searchAccounts
exports.refreshAccountsCache = refreshAccountsCache
exports.refreshSegmentsCache = refreshSegmentsCache
exports.buildAccountsOptionsArray = buildAccountsOptionsArray
exports.getSegmentsCache = getSegmentsCache
exports.CUSTOM_FIELD_ACCOUNT = CUSTOM_FIELD_ACCOUNT
exports.CUSTOM_FIELD_SEGMENT = CUSTOM_FIELD_SEGMENT
exports.CUSTOM_FIELD_DEAL_VALUE = CUSTOM_FIELD_DEAL_VALUE
exports.CUSTOM_FIELD_PRODUCT = CUSTOM_FIELD_PRODUCT
