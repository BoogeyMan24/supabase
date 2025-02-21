import { type NextRequest } from 'next/server'
import { createHash } from 'node:crypto'

import { fetchSources } from '~/scripts/search/sources'

export const GET = handleError(_handleLlmsTxt)

export async function _handleLlmsTxt(request: NextRequest) {
  let res = '# Supabase Docs'

  const sources = await fetchSources()
  const sourceTexts = sources
    .map((source) => {
      source.process()
      return source.extractIndexedContent()
    })
    .join('\n\n')

  res += '\n\n' + sourceTexts

  const etag = createHash('sha256').update(res).digest('hex')

  return new Response(res, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400, stale-if-error=86400',
      ETag: etag,
    },
  })
}

function handleError(handleRequest: (request: NextRequest) => Promise<Response>) {
  return async function (request: NextRequest) {
    try {
      const response = await handleRequest(request)
      return response
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', { status: 500 })
    }
  }
}
