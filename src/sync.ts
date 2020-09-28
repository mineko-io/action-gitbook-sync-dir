import GitBookAPI from 'gitbook-api'
import fs from 'fs'

export interface SyncRequest {
  token: string
  dir: string
  org: string
  space: string
  apiEndpoint?: string
  group?: string
}

export async function sync(request: SyncRequest): Promise<void> {
  const {token, dir, org, space, apiEndpoint, group} = request
  const client = new GitBookAPI(
    {token},
    {host: apiEndpoint || 'https://api-beta.gitbook.com/v1'}
  )

  const organizations = await client.get('orgs')

  if (
    !organizations ||
    !organizations.items ||
    organizations.items.length === 0
  ) {
    throw new Error(`No organization found`)
  }

  const orgItem = organizations.items.find(
    (item: {title: string}) => item.title === org
  )

  if (!orgItem) {
    throw new Error(`No organization with title ${org} found`)
  }

  const spaces = await client.get(`owners/${orgItem.uid}/spaces`)

  if (!spaces || !spaces.items || spaces.items.length === 0) {
    throw new Error('No spaces found')
  }

  const spaceItem = spaces.items.find(
    (item: {name: string}) => item.name === space
  )

  if (!spaceItem) {
    throw new Error(`No space with name ${space} found`)
  }

  let syncUrl = `spaces/${spaceItem.uid}/content/v/master/url/`

  if (group) {
    const groupUrl = group?.toLowerCase()
    let groupItem = await client.get(`${syncUrl}${groupUrl}/`)

    if (!groupItem || groupItem.error) {
      groupItem = await client.put(syncUrl, {
        pages: [
          {
            kind: 'group',
            title: group,
            url: groupUrl
          }
        ]
      })
    }

    syncUrl = `${syncUrl}${groupUrl}/`
  }

  const files: string[] = fs.readdirSync(dir) || []
  files.sort()
  await Promise.all(
    files.map(async (file: string) => {
      let remoteFileUrl = syncUrl
      const filePath = `${dir}/${file}`
      const fileUrl = file.split('.')[0]
      const content = fs.readFileSync(filePath, {encoding: 'utf-8'}).toString()

      const existingFile = await client.get(`${syncUrl}${fileUrl}`)

      if (existingFile && existingFile.uid) {
        remoteFileUrl = `${syncUrl}${fileUrl}`
      }

      await client.put(remoteFileUrl, {
        pages: [
          {
            kind: 'document',
            url: fileUrl,
            title: fileUrl.replace('-', ' '),
            document: {
              markdown: content
            }
          }
        ]
      })
    })
  )
}
