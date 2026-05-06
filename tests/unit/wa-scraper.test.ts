import { describe, test, expect } from 'vitest'
import { parseMark, scrapeWaProfile } from '../../src/api/services/wa-scraper'
import type { DisciplineMapping } from '../../src/api/services/wa-scraper'

const TEST_MAPPINGS: DisciplineMapping[] = [
  { waName: '100 Metres', waRankingSlug: '100m', catalogName: '100m', isField: false },
  { waName: '200 Metres', waRankingSlug: '200m', catalogName: '200m', isField: false },
  { waName: '400 Metres', waRankingSlug: '400m', catalogName: '400m', isField: false },
  { waName: '800 Metres', waRankingSlug: '800m', catalogName: '800m', isField: false },
  { waName: '1500 Metres', waRankingSlug: '1500m', catalogName: '1500m', isField: false },
  { waName: '5000 Metres', waRankingSlug: '5000m', catalogName: '5000m', isField: false },
  { waName: 'High Jump', waRankingSlug: 'high-jump', catalogName: 'High Jump', isField: true },
  { waName: 'Long Jump', waRankingSlug: 'long-jump', catalogName: 'Long Jump', isField: true },
  { waName: 'Pole Vault', waRankingSlug: 'pole-vault', catalogName: 'Pole Vault', isField: true },
  { waName: 'Shot Put', waRankingSlug: 'shot-put', catalogName: 'Shot Put', isField: true },
]

describe('WA Scraper', () => {
  describe('parseMark', () => {
    test('parses simple track time', () => {
      expect(parseMark('9.80', false)).toBe(9.80)
      expect(parseMark('19.67', false)).toBe(19.67)
      expect(parseMark('43.03', false)).toBe(43.03)
    })

    test('parses mm:ss.cc track time', () => {
      expect(parseMark('3:26.00', false)).toBe(206.00)
      expect(parseMark('1:43.50', false)).toBe(103.50)
      expect(parseMark('12:35.36', false)).toBe(755.36)
    })

    test('parses field event marks as centimeters', () => {
      expect(parseMark('2.35', true)).toBe(235)
      expect(parseMark('8.50', true)).toBe(850)
      expect(parseMark('6.15', true)).toBe(615)
      expect(parseMark('22.63', true)).toBe(2263)
    })

    test('returns null for empty/invalid marks', () => {
      expect(parseMark('', false)).toBeNull()
      expect(parseMark('abc', false)).toBeNull()
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
        const result = await scrapeWaProfile('https://worldathletics.org/athletes/test/test-runner-12345', TEST_MAPPINGS)

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
