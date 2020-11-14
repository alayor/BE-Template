const authorizeAdmin = async (req, res, next) => {
  if (req.get('admin_pass') !== '1234') return res.status(401).end()
  next()
}
module.exports = { authorizeAdmin }
