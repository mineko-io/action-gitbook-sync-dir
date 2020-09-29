import axios, {AxiosInstance, AxiosResponse} from 'axios'
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

interface Request<T> {
  items: T[]
}

async function getOrganziation(
  client: AxiosInstance,
  org: string
): Promise<Organization> {
  core.startGroup('Requesting organizations')

  const error = new Error(`No organization found`)
  const organizations = await client
    .get<Request<Organization>>('orgs')
    .then((res: AxiosResponse<Request<Organization>>) => res.data)
    .catch(() => {
      throw error
    })

  if (
    !organizations ||
    !organizations.items ||
    organizations.items.length === 0
  ) {
    throw error
  }

  const orgItem: Organization | undefined = organizations.items.find(
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
  client: AxiosInstance,
  space: string,
  org: Organization
): Promise<Space> {
  core.startGroup(`Requesting spaces for org ${org.title}`)
  const error = new Error('No spaces found')
  const spaces = await client
    .get<Request<Space>>(`owners/${org.uid}/spaces`)
    .then((res: AxiosResponse<Request<Space>>) => res.data)
    .catch(() => {
      throw error
    })

  if (!spaces || !spaces.items || spaces.items.length === 0) {
    throw error
  }

  const spaceItem: Space | undefined = spaces.items.find(
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
  const client = axios.create({
    baseURL: apiEndpoint,
    timeout: 10000,
    headers: {Authorization: `Bearer ${token}`}
  })

  const orgItem = await getOrganziation(client, org)
  const spaceItem = await getSpace(client, space, orgItem)

  let syncUrl = `spaces/${spaceItem.uid}/content/v/master/url/`

  core.endGroup()

  if (group) {
    core.startGroup(`checking if group ${group} exists`)
    const groupUrl = group?.toLowerCase()

    let groupItem = await client
      .get<Item>(`${syncUrl}${groupUrl}/`)
      .then((res: AxiosResponse<Item>) => {
        core.info(`group ${group} exist`)
        return res.data
      })
      .catch(() => {
        core.info(`group ${group} doesn't exist`)
      })
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

      core.info(`checking if file ${fileUrl} exists`)
      const existingFile = await client
        .get<Item>(`${syncUrl}${fileUrl}/`)
        .then((res: AxiosResponse<Item>) => {
          core.info(`fiel ${fileUrl} exists`)
          return res.data
        })
        .catch(() => {
          core.info(`file ${fileUrl} doesn't exists`)
        })

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
