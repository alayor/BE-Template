const express = require('express')
const bodyParser = require('body-parser')
const Sequelize = require('sequelize')
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express()
app.use(bodyParser.json())
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
const Op = Sequelize.Op
sequelize.sync({ logging: console.log })

/**
 * Returns the contract that belongs to the profile.
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models')
  const { id } = req.params
  const { id: profileId } = req.profile
  const contract = await Contract.findOne({
    where: {
      id,
      [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
    },
  })
  if (!contract) return res.status(404).end()
  res.json(contract)
})
module.exports = app
