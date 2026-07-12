import { defineEventContract } from '../common'
import { WindowFollowerDebugDtoSchema } from '../../windowFollower'

export const windowFollowerStateChangedEvent = defineEventContract({
  name: 'windowFollower.stateChanged',
  payload: WindowFollowerDebugDtoSchema
})
