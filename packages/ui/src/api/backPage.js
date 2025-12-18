import client from './client'

const back = () => client.get('/back/previous')

export default { back }

