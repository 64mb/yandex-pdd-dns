/* eslint-disable no-console */

require('dotenv').config()
const axios = require('axios')

axios.defaults.baseURL = 'https://pddimp.yandex.ru'
axios.defaults.headers.common.PddToken = process.env.PDD_TOKEN
const DOMAIN = process.env.DOMAIN

async function main(record) {
  console.log('start update records for domain:\n', DOMAIN, '\nrecord:\n', JSON.stringify(record))

  const { data: { records } } = await axios.get(`/api2/admin/dns/list?domain=${DOMAIN}`)

  record.host = record.host
    .toLowerCase()
    .replace(new RegExp(`[.]*${DOMAIN}$`, 'g'), '')

  let types = []
  let hosts = []

  if (record.type === 'HOST') {
    types = ['A', 'AAAA']
    hosts = [record.host, `*.${record.host}`]
  } else {
    types = [record.type]
    hosts = [record.host]
  }

  record.value = record.value.filter((r) => r != null)

  const newRecords = types.reduce(
    (a, v) => [...a, ...hosts.map((x) => [
      v,
      x,
      v === 'AAAA' && record.value.length > 1 ? record.value[1] : record.value[0],
    ])],
    [],
  )

  const promises = []
  newRecords.forEach(([type, host, value]) => {
    const finded = records.find((it) => it.subdomain === host && it.type === type)
    if (finded != null) {
      promises.push(axios.post('/api2/admin/dns/edit', [
        `domain=${DOMAIN}`,
        `record_id=${finded.record_id}`,
        `subdomain=${host}`,
        'ttl=14400',
        `content=${value}`,
      ].join('&')))
    } else {
      promises.push(axios.post('/api2/admin/dns/add', [
        `domain=${DOMAIN}`,
        `type=${type}`,
        `subdomain=${host}`,
        'ttl=14400',
        `content=${value}`,
      ].join('&')))
    }
  })

  await Promise.all(promises)
  console.log('')
  console.log('success update records for domain:\n', DOMAIN, '\nrecord:\n', JSON.stringify(record))
}

if (require.main === module) {
  const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'HOST']
  let type = null
  if (process.argv[4]) type = TYPES.includes(process.argv[4]) ? process.argv[4] : null
  if (process.argv[5] && !type) type = TYPES.includes(process.argv[5]) ? process.argv[5] : null

  const record = {
    type: type || 'HOST',
    host: process.argv[2],
    value: [process.argv[3], process.argv[4]],
  }

  main(record).catch((err) => {
    console.error('error update records for domain:',
      DOMAIN, '\nrecord:\n', JSON.stringify(record), 'error:', err)
    process.exit(1)
  })
}

module.exports = main
