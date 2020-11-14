const authorizeClient = async (req, res, next) => {
  if (req.profile.type !== 'client') return res.status(401).end()
  next()
}
module.exports = { authorizeClient }
