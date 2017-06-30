'use strict'

module.exports = (slapp) => {
  require('./createIssue')(slapp)
  require('./fetchIssue')(slapp)
}
