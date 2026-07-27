import { describe, test, expect } from 'vitest'
import { extractWaAthleteId, scrapeEaProfile } from '../../src/api/services/ea-scraper'
import type { EaDisciplineMapping } from '../../src/api/services/ea-scraper'

const TEST_MAPPINGS: EaDisciplineMapping[] = [
  { eaDiscipline: "Women's 400mH", catalogName: '400m Haies' },
  { eaDiscipline: "Women's 800m", catalogName: '800m' },
]

describe('EA Scraper', () => {
  describe('extractWaAthleteId', () => {
    test('extracts numeric id from a WA profile URL', () => {
      expect(extractWaAthleteId('https://worldathletics.org/athletes/netherlands/femke-broeders-bol-14707010'))
        .toBe('14707010')
    })

    test('extracts numeric id with trailing slash', () => {
      expect(extractWaAthleteId('https://worldathletics.org/athletes/test/test-runner-12345/'))
        .toBe('12345')
    })

    test('returns null when no trailing digits', () => {
      expect(extractWaAthleteId('https://worldathletics.org/athletes/test/test-runner')).toBeNull()
    })
  })

  describe('scrapeEaProfile', () => {
    test('parses mock __NEXT_DATA__ HTML', async () => {
      const mockHtml = `
        <html><body>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              athleteId: '14707010',
              athleteInfo: {
                europeanRankings: {
                  current: [
                    { discipline: "Women's 400mH", place: 1, score: 1424 },
                    { discipline: "Women's Overall Ranking", place: 1, score: 1424 },
                    { discipline: "Women's 800m", place: 5, score: 1317 },
                  ],
                },
              },
            },
          },
        })}</script>
        </body></html>
      `

      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response(mockHtml, { status: 200 })

      try {
        const result = await scrapeEaProfile('14707010', TEST_MAPPINGS)

        expect(result.rankings).toHaveLength(2) // Overall Ranking has no mapping, so it's skipped

        const hurdles = result.rankings.find(r => r.catalogName === '400m Haies')
        expect(hurdles).toBeDefined()
        expect(hurdles!.eaRanking).toBe(1)

        const eight = result.rankings.find(r => r.catalogName === '800m')
        expect(eight).toBeDefined()
        expect(eight!.eaRanking).toBe(5)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('matches when catalog mapping omits the gender prefix', async () => {
      const mockHtml = `
        <html><body>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              athleteId: '14707010',
              athleteInfo: {
                europeanRankings: {
                  current: [
                    { discipline: "Women's 400mH", place: 1, score: 1424 },
                    { discipline: "Women's 800m", place: 5, score: 1317 },
                  ],
                },
              },
            },
          },
        })}</script>
        </body></html>
      `

      // Catalog configured without the "Women's"/"Men's" prefix, as the UI now suggests
      const unprefixedMappings: EaDisciplineMapping[] = [
        { eaDiscipline: '400mH', catalogName: '400m Haies' },
        { eaDiscipline: '800m', catalogName: '800m' },
      ]

      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response(mockHtml, { status: 200 })

      try {
        const result = await scrapeEaProfile('14707010', unprefixedMappings)

        expect(result.rankings).toHaveLength(2)
        expect(result.rankings.find(r => r.catalogName === '400m Haies')?.eaRanking).toBe(1)
        expect(result.rankings.find(r => r.catalogName === '800m')?.eaRanking).toBe(5)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('throws when __NEXT_DATA__ is missing', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response('<html><body>no data</body></html>', { status: 200 })

      try {
        await expect(scrapeEaProfile('14707010', TEST_MAPPINGS)).rejects.toThrow('Could not find __NEXT_DATA__')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
