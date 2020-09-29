import GitBookAPI from 'gitbook-api'
import * as core from '@actions/core'
import fs from 'fs'

export interface SyncRequest {
  token: string
  dir: string
  org: string
  space: string
  apiEndpoint: string
  group?: string
}

interface Item {
  uid: string
}

interface Organization extends Item {
  title: string
}

interface Space extends Item {
  name: string
}

interface Client {
  get: Function
}

async function getOrganziation(
  client: Client,
  org: string
): Promise<Organization> {
  core.startGroup('Requesting organizations')

  const error = new Error(`No organization found`)
  const organizations = await client.get('orgs').catch(() => {
    throw error
  })

  if (
    !organizations ||
    !organizations.items ||
    organizations.items.length === 0
  ) {
    throw error
  }

  const orgItem: Organization = organizations.items.find(
    (item: {title: string}) => item.title === org
  )

  if (!orgItem) {
    throw new Error(`No organization with title ${org} found`)
  }

  core.info(`Organization with title ${org} found.`)
  core.endGroup()
  return orgItem
}

async function getSpace(
  client: Client,
  space: string,
  org: Organization
): Promise<Space> {
  core.startGroup(`Requesting spaces for org ${org.title}`)
  const error = new Error('No spaces found')
  const spaces = await client.get(`owners/${org.uid}/spaces`).catch(() => {
    throw error
  })

  if (!spaces || !spaces.items || spaces.items.length === 0) {
    throw error
  }

  const spaceItem: Space = spaces.items.find(
    (item: {name: string}) => item.name === space
  )

  if (!spaceItem) {
    throw new Error(`No space with name ${space} found`)
  }
  core.info(`Space with name ${space} found.`)

  return spaceItem
}

export async function sync(request: SyncRequest): Promise<void> {
  const {token, dir, org, space, apiEndpoint, group} = request
  const client = new GitBookAPI({token}, {host: apiEndpoint})

  const orgItem = await getOrganziation(client, org)
  const spaceItem = await getSpace(client, space, orgItem)

  let syncUrl = `spaces/${spaceItem.uid}/content/v/master/url/`

  core.endGroup()

  if (group) {
    core.startGroup(`Checking if group ${group} exists`)
    const groupUrl = group?.toLowerCase()
    let groupItem = await client.get(`${syncUrl}${groupUrl}/`).catch(() => {})
    core.endGroup()

    if (!groupItem) {
      core.startGroup(`Creating group ${group}`)
      groupItem = await client.put(syncUrl, {
        pages: [
          {
            kind: 'group',
            title: group,
            url: groupUrl
          }
        ]
      })
      core.endGroup()
    }

    syncUrl = `${syncUrl}${groupUrl}/`
  }

  core.startGroup(`Synchronizing files of dir ${dir}`)
  const files: string[] = fs.readdirSync(dir) || []
  files.sort()
  await Promise.all(
    files.map(async (file: string) => {
      core.info(`start sync of file ${file}`)
      let remoteFileUrl = syncUrl
      const filePath = `${dir}/${file}`
      const fileUrl = file.split('.')[0]
      const content = fs.readFileSync(filePath, {encoding: 'utf-8'}).toString()

      core.info(`checking if file ${file} exists`)
      const existingFile = await client
        .get(`${syncUrl}${fileUrl}`)
        .catch(() => {})

      if (existingFile && existingFile.uid) {
        core.info('file exist, updating it...')
        remoteFileUrl = `${syncUrl}${fileUrl}`
      }

      core.debug(`creating / updating file at url ${remoteFileUrl}`)

      await client.put(remoteFileUrl, {
        pages: [
          {
            kind: 'document',
            url: fileUrl,
            title: fileUrl.replace(/-/g, ' '),
            document: {
              markdown: content
            }
          }
        ]
      })
    })
  )
  core.endGroup()
}
