import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * An API route. `pages/api/**` holds handlers, not pages, so `assertRoutesMatchPagesDir`
 * skips it and the tree never declares it.
 */
export default function handler(_request: NextApiRequest, response: NextApiResponse) {
  response.status(200).json({ ok: true });
}
