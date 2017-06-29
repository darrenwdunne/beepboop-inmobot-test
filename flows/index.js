'use strict'

module.exports = (slapp) => {
  require('./createIssue')(slapp)
  require('./timeout')(slapp) // TODO: remove this (and remove the /timeoff slash command from api.slack.com)
  // require('./fetchIssue')(slapp) // TODO: reenable this
}
