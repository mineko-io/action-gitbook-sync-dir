import * as core from '@actions/core'
import {sync} from './sync'

export async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token', {required: true})
    const dir: string = core.getInput('dir', {required: true})
    const org: string = core.getInput('org', {required: true})
    const space: string = core.getInput('space', {required: true})
    const apiEndpoint: string = core.getInput('apiEndpoint')
    const group: string = core.getInput('group')

    core.debug(`Syncing ${dir} to space ${space} ...`)

    await sync({
      token,
      dir,
      org,
      space,
      apiEndpoint,
      group
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}
