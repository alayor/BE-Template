const Sequelize = require('sequelize')
const { sequelize } = require('./model')
const Op = Sequelize.Op
//TODO: delete me
sequelize.sync({ logging: console.log })

const getUnpaidJobs = async (req, profileId, statuses) => {
  const { Job, Contract } = req.app.get('models')
  return await Job.findAll({
    where: {
      paid: {[Op.not]: true},
    },
    include: [
      {
        model: Contract,
        required: true,
        where: {
          status: statuses,
          [Op.or]: [{ClientId: profileId}, {ContractorId: profileId}],
        },
      },
    ],
  })
}

module.exports = {
  getUnpaidJobs,
}
