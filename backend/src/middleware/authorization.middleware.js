// Single implementation of community authorization. Every route guarded by these
// middlewares carries the community in `:communityId`.
module.exports = require('../modules/authorization/authorization.middleware');
