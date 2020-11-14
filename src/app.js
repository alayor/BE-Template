const express = require('express')
const bodyParser = require('body-parser')
const _ = require('lodash')
const Sequelize = require('sequelize')
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const { authorizeClient } = require('./middleware/authorizeClient')
const { authorizeAdmin } = require('./middleware/authorizeAdmin')
const { getUnpaidJobs, getSumOfPaidJobsByProfession } = require('./services')
const app = express()
app.use(bodyParser.json())
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
const Op = Sequelize.Op
//TODO: delete me
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

/**
 * Returns the non-terminated contracts that belongs to the profile.
 * @returns non-terminated contracts.
 */
app.get('/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models')
  const { id: profileId } = req.profile
  const contracts = await Contract.findAll({
    where: {
      status: {
        [Op.not]: 'terminated',
      },
      [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
    },
  })
  if (!contracts) return res.status(404).end()
  res.json(contracts)
})

/**
 * Returns the unpaid jobs that belong to the profile.
 * @returns unpaid jobs.
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
  const { id: profileId } = req.profile
  const jobs = await getUnpaidJobs(req, profileId, ['in_progress'])
  if (!jobs) return res.status(404).end()
  res.json(jobs)
})

//TODO: delete me
app.get('/jobs', async (req, res) => {
  const { Job } = req.app.get('models')
  const jobs = await Job.findAll()
  res.json(jobs)
})
//TODO: delete me
app.get('/profiles', async (req, res) => {
  const { Profile } = req.app.get('models')
  const profiles = await Profile.findAll()
  res.json(profiles)
})

/**
 * Pay for a job.
 */
app.post('/jobs/:job_id/pay', getProfile, authorizeClient, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get('models')
  const { job_id: jobId } = req.params
  const { id: profileId } = req.profile
  const job = await Job.findOne({
    where: {
      id: jobId,
      paid: { [Op.not]: true },
    },
    include: [
      {
        model: Contract,
        required: true,
        where: {
          [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        },
      },
    ],
  })
  if (!job) {
    res.json({ success: false, error: 'unpaid.job.not.found' })
  }
  const { balance } = req.profile
  if (balance >= job.price) {
    const transaction = await sequelize.transaction()
    await Profile.increment('balance', {
      by: job.price,
      where: { id: job.Contract.ContractorId },
      transaction,
    })
    await Profile.decrement('balance', {
      by: job.price,
      where: { id: job.Contract.ClientId },
      transaction,
    })
    await transaction.commit()
    try {
    } catch (error) {
      await transaction.rollback()
      throw error
    }
    res.json({ success: true })
  } else {
    res.json({ success: false, error: 'not.enough.balance' })
  }
})

/**
 * Deposits money into the the the balance of a client.
 */
app.post('/balances/deposit/:userId', getProfile, authorizeClient, async (req, res) => {
  const { userId: clientId } = req.params
  const { amount } = req.body
  if (!amount || amount <= 0) {
    res.json({ success: false, error: 'invalid.amount' })
  }
  const jobs = await getUnpaidJobs(req, clientId, ['new', 'in_progress'])
  const limit =
    jobs.reduce((acc, val) => {
      acc += val.price
      return acc
    }, 0) * 0.25
  if (amount > limit) {
    res.json({ success: false, error: 'invalid.amount' })
  } else {
    res.json({ amount, limit })
  }
})

/**
 * Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
 * @returns the best profession
 */
app.get('/admin/best-profession', authorizeAdmin, async (req, res) => {
  const jobs = await getSumOfPaidJobsByProfession(req)
  const professions = jobs.reduce((acc, job) => {
    const current = acc[job.Contract.Contractor.profession] || 0
    acc[job.Contract.Contractor.profession] = current + job.price
    return acc
  }, {})
  const profession = Object.keys(professions).sort((a, b) => professions[b] - professions[a])[0]
  res.json({
    profession,
  })
})

module.exports = app
