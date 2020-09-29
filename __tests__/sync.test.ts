import mockyeah from '@mockyeah/test-server-jest'
import fs from 'fs'
import {sync} from '../src/sync'

jest.mock('fs')

const defaultSyncRequest = {
  token: 'token',
  dir: 'foo/bar',
  org: 'FooBarOrg',
  space: 'FooSpace'
}

const mockedOrganization = {
  uid: 'org-uid',
  kind: 'org',
  title: 'FooBarOrg',
  baseDomain: 'foo-bar-org'
}

const mockedSpace = {
  uid: 'space-uid',
  name: 'FooSpace',
  baseName: 'foo-space',
  private: true,
  unlisted: false
}

const getCurrentSyncRequest = (): typeof defaultSyncRequest & {
  apiEndpoint: string
} => ({
  ...defaultSyncRequest,
  apiEndpoint: `${mockyeah.server.url}/v1`
})

test('token is set to header', async () =>
  mockyeah
    .get('v1/orgs', {
      json: {
        items: []
      }
    })
    .expect((data: {headers: {authorization: string}}) => {
      expect(data.headers.authorization).toEqual('Bearer token')
    })
    .once()
    .run(sync(getCurrentSyncRequest()).catch(() => {})) // eslint-disable-line github/no-then
    .verify())

test('throws error if no organization was found', async () => {
  await mockyeah.get('v1/orgs', {
    json: {
      error: {
        status: 404,
        message: 'Not Found'
      }
    },
    status: 404
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow(
    'No organization found'
  )
})

test('throws error if no organization in response', async () => {
  await mockyeah.get('v1/orgs', {
    json: {
      items: []
    }
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow(
    'No organization found'
  )
})

test('throws error if no organization with given title exist', async () => {
  await mockyeah.get('v1/orgs', {
    json: {
      items: [{...mockedOrganization, title: 'BarFoo'}]
    }
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow(
    'No organization with title FooBarOrg found'
  )
})

test('throws error if no spaces are in response', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: []
    }
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow('No spaces found')
})

test('throws error if no spaces found', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      error: {
        status: 404,
        message: 'Not Found'
      }
    },
    status: 404
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow('No spaces found')
})

test('throws error if no spaces with given name exist', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [{...mockedSpace, name: 'BarSpace'}]
    }
  })

  await expect(sync(getCurrentSyncRequest())).rejects.toThrow(
    'No space with name FooSpace found'
  )
})

test('creates group in space if group input is set', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [mockedSpace]
    }
  })
  mockyeah.get('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
    json: {
      error: {
        status: 404,
        message: 'Not Found'
      }
    },
    status: 404
  })

  return mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/', {
      json: {
        revision: '1'
      }
    })
    .expect({
      body: {
        pages: [
          {
            kind: 'group',
            url: 'foobargroup',
            title: 'FooBarGroup'
          }
        ]
      }
    })
    .once()
    .run(sync({...getCurrentSyncRequest(), group: 'FooBarGroup'}))
    .verify()
})

test('does not create group if already exist', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [mockedSpace]
    }
  })
  mockyeah.get('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
    json: {
      uid: 'group-uid',
      kind: 'group',
      url: 'foobargroup',
      title: 'FooBarGroup'
    }
  })

  return mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/', {
      json: {
        revision: '1'
      }
    })
    .expect({
      body: {
        pages: [
          {
            kind: 'group',
            url: 'foobargroup',
            title: 'FooBarGroup'
          }
        ]
      }
    })
    .never()
    .run(sync({...getCurrentSyncRequest(), group: 'FooBarGroup'}))
    .verify()
})

test('does not create group if input group is not given', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [mockedSpace]
    }
  })

  return mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/', {
      json: {
        revision: '1'
      }
    })
    .expect({
      body: {
        pages: [
          {
            kind: 'group',
            url: 'foobargroup',
            title: 'FooBarGroup'
          }
        ]
      }
    })
    .never()
    .run(sync(getCurrentSyncRequest()))
    .verify()
})

test('synchronizes files in dir sorted to gitbook under group path', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [mockedSpace]
    }
  })
  mockyeah.get('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
    json: {
      error: {
        status: 404
      }
    },
    status: 404
  })
  mockyeah.put('v1/spaces/space-uid/content/v/master/url/', {
    json: {
      revision: '1'
    }
  })
  mockyeah.get(
    'v1/spaces/space-uid/content/v/master/url/foobargroup/001-file',
    {
      json: {
        error: {
          status: 404
        }
      },
      status: 404
    }
  )
  mockyeah.get(
    'v1/spaces/space-uid/content/v/master/url/foobargroup/002-file',
    {
      json: {
        error: {
          status: 404
        }
      },
      status: 404
    }
  )
  ;(fs.readdirSync as jest.Mock).mockReturnValue(['002-file.md', '001-file.md'])
  ;(fs.readFileSync as jest.Mock).mockReturnValue('content')

  function* bodyMatcher(): Generator {
    yield {
      body: {
        pages: [
          {
            kind: 'document',
            url: '001-file',
            title: '001 file',
            document: {
              markdown: 'content'
            }
          }
        ]
      }
    }
    yield {
      body: {
        pages: [
          {
            kind: 'document',
            url: '002-file',
            title: '002 file',
            document: {
              markdown: 'content'
            }
          }
        ]
      }
    }
  }

  return mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
      json: {
        revision: '1'
      }
    })
    .expect(bodyMatcher)
    .twice()
    .run(sync({...getCurrentSyncRequest(), group: 'FooBarGroup'}))
    .verify()
})

test('synchronizes files and update existing ones', async () => {
  mockyeah.get('v1/orgs', {
    json: {
      items: [mockedOrganization]
    }
  })
  mockyeah.get('v1/owners/org-uid/spaces', {
    json: {
      items: [mockedSpace]
    }
  })

  mockyeah.get('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
    json: {
      error: {
        status: 404
      },
      status: 404
    }
  })

  mockyeah.put('v1/spaces/space-uid/content/v/master/url/', {
    json: {
      revision: '1'
    }
  })
  ;(fs.readdirSync as jest.Mock).mockReturnValue(['002-file.md', '001-file.md'])
  ;(fs.readFileSync as jest.Mock).mockReturnValue('content')

  mockyeah.get(
    'v1/spaces/space-uid/content/v/master/url/foobargroup/001-file',
    {
      json: {
        uid: '001-file-uid'
      }
    }
  )

  mockyeah.get(
    'v1/spaces/space-uid/content/v/master/url/foobargroup/002-file',
    {
      json: {
        error: {
          status: 404
        }
      },
      status: 404
    }
  )

  const expectation1 = mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/foobargroup/001-file', {
      json: {
        revision: '1'
      }
    })
    .expect({
      body: {
        pages: [
          {
            kind: 'document',
            url: '001-file',
            title: '001 file',
            document: {
              markdown: 'content'
            }
          }
        ]
      }
    })
    .once()

  const expectation2 = mockyeah
    .put('v1/spaces/space-uid/content/v/master/url/foobargroup/', {
      json: {
        revision: '1'
      }
    })
    .expect({
      body: {
        pages: [
          {
            kind: 'document',
            url: '002-file',
            title: '002 file',
            document: {
              markdown: 'content'
            }
          }
        ]
      }
    })
    .once()

  await sync({...getCurrentSyncRequest(), group: 'FooBarGroup'})

  expectation1.verify()
  expectation2.verify()
})
