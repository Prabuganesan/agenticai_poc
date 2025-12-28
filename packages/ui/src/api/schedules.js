import client from './client'

const getAllSchedules = (page, limit) => client.get('/schedules', { params: { page, limit } })

const getScheduleById = (id) => client.get(`/schedules/${id}`)

const createSchedule = (body) => client.post('/schedules', body)

const updateSchedule = (id, body) => client.put(`/schedules/${id}`, body)

const deleteSchedule = (id) => client.delete(`/schedules/${id}`)

export default {
    getAllSchedules,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule
}
