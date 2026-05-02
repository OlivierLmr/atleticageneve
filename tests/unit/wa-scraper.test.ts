import { describe, test, expect } from 'vitest'
import { parseMark, DEFAULT_DISCIPLINE_MAPPINGS, scrapeWaProfile } from '../../src/api/services/wa-scraper'
import type { DisciplineMapping } from '../../src/api/services/wa-scraper'

const MAPPINGS: DisciplineMapping[] = DEFAULT_DISCIPLINE_MAPPINGS

describe('WA Scraper', () => {
  describe('parseMark', () => {
    test('parses simple track time', () => {
      expect(parseMark('9.80', '100m')).toBe(9.80)
      expect(parseMark('19.67', '200m')).toBe(19.67)
      expect(parseMark('43.03', '400m')).toBe(43.03)
    })

    test('parses mm:ss.cc track time', () => {
      expect(parseMark('3:26.00', '1500m')).toBe(206.00)
      expect(parseMark('1:43.50', '800m')).toBe(103.50)
      expect(parseMark('12:35.36', '5000m')).toBe(755.36)
    })

    test('parses field event marks as centimeters', () => {
      expect(parseMark('2.35', 'High Jump')).toBe(235)
      expect(parseMark('8.50', 'Long Jump')).toBe(850)
      expect(parseMark('6.15', 'Pole Vault')).toBe(615)
      expect(parseMark('22.63', 'Shot Put')).toBe(2263)
    })

    test('returns null for empty/invalid marks', () => {
      expect(parseMark('', '100m')).toBeNull()
      expect(parseMark('abc', '100m')).toBeNull()
    })
  })

  describe('DEFAULT_DISCIPLINE_MAPPINGS', () => {
    test('covers all catalog events', () => {
      const catalogNames = new Set(DEFAULT_DISCIPLINE_MAPPINGS.map(m => m.catalogName))
      for (const name of ['100m', '200m', '400m', '400mH', '800m', '1500m', '5000m', 'High Jump', 'Long Jump', 'Pole Vault', 'Shot Put']) {
        expect(catalogNames.has(name)).toBe(true)
      }
    })

    test('all entries have both waName and waRankingSlug', () => {
      for (const m of DEFAULT_DISCIPLINE_MAPPINGS) {
        expect(m.waName).toBeTruthy()
        expect(m.waRankingSlug).toBeTruthy()
        expect(m.catalogName).toBeTruthy()
      }
    })
  })

  describe('scrapeWaProfile', () => {
    test('parses mock __NEXT_DATA__ HTML', async () => {
      const mockHtml = `
        <html><body>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              competitor: {
                basicData: { givenName: 'Test', familyName: 'RUNNER' },
                personalBests: {
                  results: [
                    { discipline: '100 Metres', mark: '10.05', notLegal: false, indoor: false },
                    { discipline: '100 Metres', mark: '9.99', notLegal: true, indoor: false },
                    { discipline: '200 Metres', mark: '20.10', notLegal: false, indoor: true },
                    { discipline: '200 Metres', mark: '20.30', notLegal: false, indoor: false },
                    { discipline: 'High Jump', mark: '2.30', notLegal: false, indoor: false },
                  ],
                },
                seasonsBests: {
                  results: [
                    { discipline: '100 Metres', mark: '10.12', notLegal: false, indoor: false },
                    { discipline: 'High Jump', mark: '2.28', notLegal: false, indoor: false },
                  ],
                },
                worldRankings: {
                  current: [
                    { eventGroup: "Men's 100m", urlSlug: '100m', place: 42 },
                    { eventGroup: "Men's High Jump", urlSlug: 'high-jump', place: 15 },
                    { eventGroup: "Men's Overall Ranking", urlSlug: 'overall-ranking', place: 100 },
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
        const result = await scrapeWaProfile('https://worldathletics.org/athletes/test/test-runner-12345', MAPPINGS)

        expect(result.athleteName).toBe('Test RUNNER')
        expect(result.performances).toHaveLength(3) // 100m, 200m, High Jump

        const p100 = result.performances.find(p => p.catalogName === '100m')
        expect(p100).toBeDefined()
        expect(p100!.personalBest).toBe(10.05) // notLegal one filtered
        expect(p100!.seasonBest).toBe(10.12)
        expect(p100!.worldRanking).toBe(42)

        const p200 = result.performances.find(p => p.catalogName === '200m')
        expect(p200).toBeDefined()
        expect(p200!.personalBest).toBe(20.30) // indoor one filtered
        expect(p200!.seasonBest).toBeNull()
        expect(p200!.worldRanking).toBeNull()

        const hj = result.performances.find(p => p.catalogName === 'High Jump')
        expect(hj).toBeDefined()
        expect(hj!.personalBest).toBe(230) // cm
        expect(hj!.seasonBest).toBe(228) // cm
        expect(hj!.worldRanking).toBe(15)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
