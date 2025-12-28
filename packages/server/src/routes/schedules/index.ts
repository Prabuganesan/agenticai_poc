import express from 'express'
import schedulesController from '../../controllers/schedules'
const router = express.Router()

// CREATE
router.post('/', schedulesController.createSchedule as express.RequestHandler)

// READ
router.get('/', schedulesController.getAllSchedules as express.RequestHandler)
router.get('/:id', schedulesController.getScheduleById as express.RequestHandler)

// UPDATE
router.put('/:id', schedulesController.updateSchedule as express.RequestHandler)

// DELETE
router.delete('/:id', schedulesController.deleteSchedule as express.RequestHandler)

export default router
